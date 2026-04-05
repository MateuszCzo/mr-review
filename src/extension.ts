import * as vscode from 'vscode';
import { BranchCompareViewProvider } from './branchCompareView';
import { ChangedFilesProvider, ChangedFileItem, TreeNode } from './changedFilesProvider';
import { DiffContentProvider } from './diffContentProvider';
import { GitService } from './gitService';

export function activate(context: vscode.ExtensionContext) {
  console.log('MR Review activated');

  const gitService = new GitService();
  const diffContentProvider = new DiffContentProvider(gitService);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('mr-review-diff', diffContentProvider)
  );

  const changedFilesProvider = new ChangedFilesProvider(gitService);
  const treeView = vscode.window.createTreeView('mrReview.changedFiles', {
    treeDataProvider: changedFilesProvider as vscode.TreeDataProvider<TreeNode>,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  const branchCompareProvider = new BranchCompareViewProvider(
    context.extensionUri,
    gitService,
    changedFilesProvider
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('mrReview.branchCompare', branchCompareProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mrReview.openDiff', async (item: ChangedFileItem) => {
      if (!item) return;

      const baseBranch = gitService.getCurrentBaseBranch();
      if (!baseBranch) {
        vscode.window.showWarningMessage('Select branch to compare.');
        return;
      }

      await openFileDiff(item, baseBranch, gitService, diffContentProvider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mrReview.openPanel', () => {
      vscode.commands.executeCommand('workbench.view.extension.mrReview');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mrReview.refresh', () => {
      changedFilesProvider.refresh();
    })
  );

  vscode.commands.executeCommand('setContext', 'mrReview.hasComparison', false);
}

async function openFileDiff(
  item: ChangedFileItem,
  baseBranch: string,
  gitService: GitService,
  diffContentProvider: DiffContentProvider
) {
  const workspaceRoot = gitService.getWorkspaceRoot();
  if (!workspaceRoot) return;

  const filePath = item.resourceUri?.fsPath || item.label as string;
  const relPath = filePath.startsWith(workspaceRoot)
    ? filePath.slice(workspaceRoot.length + 1)
    : filePath;

  const baseUri = vscode.Uri.parse(
    `mr-review-diff:${encodeURIComponent(baseBranch)}/${encodeURIComponent(relPath)}`
  );

  const currentUri = vscode.Uri.file(filePath.startsWith(workspaceRoot) ? filePath : `${workspaceRoot}/${relPath}`);

  const status = item.description as string || '';
  const label = `${relPath} (${baseBranch} ↔ HEAD)`;

  await vscode.commands.executeCommand(
    'vscode.diff',
    baseUri,
    currentUri,
    label,
    {
      preview: true,
      preserveFocus: false
    }
  );
}

export function deactivate() {}