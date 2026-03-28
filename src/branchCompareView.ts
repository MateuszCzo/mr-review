import * as vscode from 'vscode';
import { GitService } from './gitService';
import { ChangedFilesProvider } from './changedFilesProvider';

export class BranchCompareViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly gitService: GitService,
    private readonly changedFilesProvider: ChangedFilesProvider
  ) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true
    };

    const currentBranch = await this.gitService.getCurrentBranch();
    const branches = await this.gitService.getAllBranches();

    webviewView.webview.html = this.getHtml(currentBranch, branches);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'compare':
          await this.runComparison(message.branch, webviewView.webview);
          break;
        case 'getBranches':
          const updated = await this.gitService.getAllBranches();
          webviewView.webview.postMessage({ command: 'branches', branches: updated });
          break;
      }
    });
  }

  private async runComparison(branch: string, webview: vscode.Webview) {
    if (!branch.trim()) {
      webview.postMessage({ command: 'error', message: 'Enter the branch name.' });
      return;
    }

    webview.postMessage({ command: 'loading', message: `Downloading changes relative to "${branch}"...` });

    try {
      this.gitService.setBaseBranch(branch);
      const files = await this.gitService.getChangedFiles(branch);
      const stats = await this.gitService.getDiffStats(branch);

      await this.changedFilesProvider.setFiles(files);
      await vscode.commands.executeCommand('setContext', 'mrReview.hasComparison', true);

      webview.postMessage({
        command: 'done',
        stats,
        branch
      });

      await vscode.commands.executeCommand('mrReview.changedFiles.focus');

    } catch (e: any) {
      this.gitService.setBaseBranch('');
      webview.postMessage({ command: 'error', message: e.message || 'Unknown error.' });
    }
  }

  private getHtml(currentBranch: string, branches: string[]): string {
    const optionsHtml = branches
      .map(b => `<option value="${this.escapeHtml(b)}">${this.escapeHtml(b)}</option>`)
      .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
    }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
      opacity: 0.7;
      margin-bottom: 8px;
    }

    .current-branch {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: var(--vscode-editor-background);
      border-radius: 4px;
      margin-bottom: 14px;
      font-size: 12px;
    }

    .branch-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #4ec9b0;
      flex-shrink: 0;
    }

    .branch-name {
      font-weight: 600;
      color: #4ec9b0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .form-group { margin-bottom: 10px; }

    .form-group label {
      display: block;
      font-size: 11px;
      margin-bottom: 4px;
      opacity: 0.75;
    }

    .input-row {
      display: flex;
      gap: 6px;
    }

    input[type="text"], select {
      flex: 1;
      padding: 5px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 3px;
      font-family: inherit;
      font-size: 12px;
      outline: none;
    }

    input[type="text"]:focus, select:focus {
      border-color: var(--vscode-focusBorder);
    }

    #branchInput {
      width: 100%;
    }

    .autocomplete-wrapper {
      position: relative;
      width: 100%;
    }

    .dropdown {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 3px;
      max-height: 180px;
      overflow-y: auto;
      z-index: 100;
      margin-top: 2px;
    }

    .dropdown.open { display: block; }

    .dropdown-item {
      padding: 5px 8px;
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dropdown-item:hover,
    .dropdown-item.active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }

    button {
      padding: 5px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }

    button:hover { background: var(--vscode-button-hoverBackground); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-full {
      width: 100%;
      padding: 7px;
      margin-top: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .status-box {
      margin-top: 14px;
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.5;
      display: none;
    }

    .status-box.loading {
      display: block;
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      opacity: 0.8;
    }

    .status-box.error {
      display: block;
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      color: var(--vscode-inputValidation-errorForeground, #f48771);
    }

    .status-box.success {
      display: block;
      background: var(--vscode-editor-background);
    }

    .stats-row {
      display: flex;
      gap: 10px;
      margin-top: 6px;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
    }

    .stat .num { font-weight: 700; }
    .stat.added .num { color: #4caf50; }
    .stat.removed .num { color: #f44336; }
    .stat.files .num { color: var(--vscode-foreground); }

    .spinner {
      display: inline-block;
      width: 12px; height: 12px;
      border: 2px solid var(--vscode-foreground);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .arrow { font-size: 14px; opacity: 0.5; }
    .separator { height: 1px; background: var(--vscode-sideBarSectionHeader-border, rgba(255,255,255,0.1)); margin: 14px 0; }

    .hint {
      font-size: 11px;
      opacity: 0.5;
      margin-top: 6px;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="section-label">Current branch</div>
  <div class="current-branch">
    <div class="branch-dot"></div>
    <div class="branch-name">${this.escapeHtml(currentBranch || '(unknown)')}</div>
  </div>

  <div class="separator"></div>

  <div class="section-label">Compare with branch</div>

  <div class="form-group">
    <label>Type or select a base branch:</label>
    <div class="autocomplete-wrapper">
      <input
        type="text"
        id="branchInput"
        placeholder="e.g. main, develop, feature/xyz"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="dropdown" id="dropdown"></div>
    </div>
  </div>

  <button class="btn-full" id="compareBtn" onclick="compare()">
    <span>⇄</span> Compare
  </button>

  <div class="hint">Click a file in the tree below to open the diff in the editor.</div>

  <div class="status-box" id="statusBox"></div>

  <script>
    const vscode = acquireVsCodeApi();
    let allBranches = ${JSON.stringify(branches)};
    let activeIndex = -1;

    const input = document.getElementById('branchInput');
    const dropdown = document.getElementById('dropdown');

    function renderDropdown(filter) {
      const filtered = allBranches
        .filter(b => b.toLowerCase().includes(filter.toLowerCase()))
        .slice(0, 50);

      if (!filtered.length || !filter) {
        closeDropdown();
        return;
      }

      activeIndex = -1;
      dropdown.innerHTML = filtered.map((b, i) =>
        \`<div class="dropdown-item" data-index="\${i}" onmousedown="pickBranch('\${b}')">\${b}</div>\`
      ).join('');
      dropdown.classList.add('open');
    }

    function pickBranch(branch) {
      input.value = branch;
      closeDropdown();
    }

    function closeDropdown() {
      dropdown.classList.remove('open');
      activeIndex = -1;
    }

    input.addEventListener('input', () => renderDropdown(input.value));
    input.addEventListener('focus', () => { if (input.value) renderDropdown(input.value); });
    input.addEventListener('blur', () => setTimeout(closeDropdown, 150));

    input.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.dropdown-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && items[activeIndex]) {
          pickBranch(items[activeIndex].dataset.value || items[activeIndex].textContent);
        } else {
          compare();
        }
        return;
      } else if (e.key === 'Escape') {
        closeDropdown();
        return;
      }
      items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
      if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
    });

    function compare() {
      const branch = input.value.trim();
      if (!branch) { showError('Please enter a branch name.'); return; }
      document.getElementById('compareBtn').disabled = true;
      vscode.postMessage({ command: 'compare', branch });
    }

    function showError(msg) {
      const box = document.getElementById('statusBox');
      box.className = 'status-box error';
      box.innerHTML = '⚠️ ' + msg;
      document.getElementById('compareBtn').disabled = false;
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      const box = document.getElementById('statusBox');
      if (msg.command === 'loading') {
        box.className = 'status-box loading';
        box.innerHTML = '<span class="spinner"></span> ' + msg.message;
      } else if (msg.command === 'error') {
        showError(msg.message);
      } else if (msg.command === 'done') {
        document.getElementById('compareBtn').disabled = false;
        box.className = 'status-box success';
        box.innerHTML = \`
          ✓ Compared with <strong>\${msg.branch}</strong>
          <div class="stats-row">
            <span class="stat files">📄 <span class="num">\${msg.stats.files}</span> files</span>
            <span class="stat added">＋<span class="num">\${msg.stats.added}</span></span>
            <span class="stat removed">－<span class="num">\${msg.stats.removed}</span></span>
          </div>
        \`;
      } else if (msg.command === 'branches') {
        allBranches = msg.branches;
      }
    });
  </script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
