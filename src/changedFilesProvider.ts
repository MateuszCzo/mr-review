import * as vscode from 'vscode';
import * as path from 'path';
import { DiffFile, GitService } from './gitService';

interface DirNode {
  children: Map<string, DirNode>;
  files: ChangedFileItem[];
}

function buildTree(files: DiffFile[], workspaceRoot: string): DirNode {
  const root: DirNode = { children: new Map(), files: [] };

  for (const f of files) {
    const parts = path.dirname(f.path).split('/');
    const isRoot = parts.length === 1 && parts[0] === '.';

    let node = root;

    if (!isRoot) {
      for (const part of parts) {
        if (!node.children.has(part)) {
          node.children.set(part, { children: new Map(), files: [] });
        }
        node = node.children.get(part)!;
      }
    }

    node.files.push(new ChangedFileItem(f, workspaceRoot));
  }

  return root;
}

function collapseTree(node: DirNode, name: string): FolderItem {
  let label = name;
  let current = node;

  while (current.children.size === 1 && current.files.length === 0) {
    const [childName, childNode] = [...current.children.entries()][0];
    label += '/' + childName;
    current = childNode;
  }

  const children: TreeNode[] = [
    ...current.files,
    ...[...current.children.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([childName, childNode]) => collapseTree(childNode, childName))
  ];

  return new FolderItem(label, children);
}

export type TreeNode = FolderItem | ChangedFileItem;

export class FolderItem extends vscode.TreeItem {
  constructor(
    public readonly folderPath: string,
    public readonly children: TreeNode[]
  ) {
    super(folderPath, vscode.TreeItemCollapsibleState.Expanded);
    this.tooltip = folderPath;
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = 'folder';
  }
}

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

export class ChangedFilesProvider implements vscode.TreeDataProvider<TreeNode> {
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

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!this.workspaceRoot) return [];

    if (element instanceof FolderItem) {
      return element.children;
    }

    const root = buildTree(this.files, this.workspaceRoot);

    return [
      ...root.files,
      ...[...root.children.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, node]) => collapseTree(node, name))
    ];
  }
}
