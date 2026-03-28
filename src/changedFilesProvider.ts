import * as vscode from 'vscode';
import * as path from 'path';
import { DiffFile, GitService } from './gitService';

export class ChangedFileItem extends vscode.TreeItem {
  constructor(
    public readonly diffFile: DiffFile,
    workspaceRoot: string
  ) {
    const filename = path.basename(diffFile.path);
    const dir = path.dirname(diffFile.path);

    super(filename, vscode.TreeItemCollapsibleState.None);

    this.description = dir !== '.' ? dir : '';
    this.tooltip = diffFile.path;

    const fullPath = path.join(workspaceRoot, diffFile.path);
    this.resourceUri = vscode.Uri.file(fullPath);

    const iconMap: Record<DiffFile['status'], vscode.ThemeIcon> = {
      added:    new vscode.ThemeIcon('diff-added',    new vscode.ThemeColor('gitDecoration.addedResourceForeground')),
      modified: new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')),
      deleted:  new vscode.ThemeIcon('diff-removed',  new vscode.ThemeColor('gitDecoration.deletedResourceForeground')),
      renamed:  new vscode.ThemeIcon('diff-renamed',  new vscode.ThemeColor('gitDecoration.renamedResourceForeground')),
    };
    this.iconPath = iconMap[diffFile.status];

    const badgeMap: Record<DiffFile['status'], string> = {
      added: 'A', modified: 'M', deleted: 'D', renamed: 'R'
    };
    this.description = `${badgeMap[diffFile.status]}  ${this.description}`;

    this.command = {
      command: 'mrReview.openDiff',
      title: 'Pokaż diff',
      arguments: [this]
    };

    this.contextValue = `changedFile.${diffFile.status}`;
  }
}

export class ChangedFilesProvider implements vscode.TreeDataProvider<ChangedFileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ChangedFileItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private files: DiffFile[] = [];
  private workspaceRoot: string;

  constructor(private readonly gitService: GitService) {
    this.workspaceRoot = gitService.getWorkspaceRoot() ?? '';
  }

  async setFiles(files: DiffFile[]): Promise<void> {
    this.files = files;
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    const base = this.gitService.getCurrentBaseBranch();
    if (base) {
      this.gitService.getChangedFiles(base).then(files => {
        this.files = files;
        this._onDidChangeTreeData.fire();
      }).catch(e => {
        vscode.window.showErrorMessage(`Refresh error: ${e.message}`);
      });
    }
  }

  getTreeItem(element: ChangedFileItem): vscode.TreeItem {
    return element;
  }

  getChildren(_element?: ChangedFileItem): ChangedFileItem[] {
    if (!this.workspaceRoot) return [];

    if (this.files.length === 0) {
      return [];
    }

    const sorted = [...this.files].sort((a, b) => {
      const dirA = a.path.split('/').slice(0, -1).join('/');
      const dirB = b.path.split('/').slice(0, -1).join('/');
      if (dirA !== dirB) return dirA.localeCompare(dirB);
      return a.path.localeCompare(b.path);
    });

    return sorted.map(f => new ChangedFileItem(f, this.workspaceRoot));
  }
}
