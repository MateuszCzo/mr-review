import * as vscode from 'vscode';
import { GitService } from './gitService';

export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  private cache = new Map<string, string>();

  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly gitService: GitService) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const cacheKey = uri.toString();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const rawPath = decodeURIComponent(uri.path.startsWith('/') ? uri.path.slice(1) : uri.path);

    const firstSlash = rawPath.indexOf('/');
    if (firstSlash === -1) return '';

    const branch = decodeURIComponent(rawPath.slice(0, firstSlash));
    const filePath = decodeURIComponent(rawPath.slice(firstSlash + 1));

    try {
      const content = await this.gitService.getFileContentAtRef(branch, filePath);
      this.cache.set(cacheKey, content);
      return content;
    } catch {
      return '';
    }
  }

  invalidateCache(): void {
    this.cache.clear();
  }

  notifyChange(uri: vscode.Uri): void {
    this.cache.delete(uri.toString());
    this._onDidChange.fire(uri);
  }
}
