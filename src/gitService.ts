import * as vscode from 'vscode';
import { execSync, exec } from 'child_process';
import * as path from 'path';

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
}

export class GitService {
  private baseBranch: string | null = null;
  private workspaceRoot: string | null = null;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  }

  getWorkspaceRoot(): string | null {
    return this.workspaceRoot;
  }

  getCurrentBaseBranch(): string | null {
    return this.baseBranch;
  }

  setBaseBranch(branch: string): void {
    this.baseBranch = branch;
  }

  async getLocalBranches(): Promise<string[]> {
    if (!this.workspaceRoot) return [];
    try {
      const output = this.exec('git branch --format="%(refname:short)"');
      return output.split('\n').map(b => b.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  async getRemoteBranches(): Promise<string[]> {
    if (!this.workspaceRoot) return [];
    try {
      const output = this.exec('git branch -r --format="%(refname:short)"');
      return output.split('\n')
        .map(b => b.trim())
        .filter(b => b && !b.includes('HEAD'))
        .map(b => b.replace(/^origin\//, ''));
    } catch {
      return [];
    }
  }

  async getAllBranches(): Promise<string[]> {
    const [local, remote] = await Promise.all([
      this.getLocalBranches(),
      this.getRemoteBranches()
    ]);
    const all = new Set([...local, ...remote]);
    return Array.from(all).sort();
  }

  async getCurrentBranch(): Promise<string> {
    if (!this.workspaceRoot) return '';
    try {
      return this.exec('git rev-parse --abbrev-ref HEAD').trim();
    } catch {
      return '';
    }
  }

  async getChangedFiles(baseBranch: string): Promise<DiffFile[]> {
    if (!this.workspaceRoot) return [];
    try {
      try { this.exec(`git fetch origin ${baseBranch} --quiet`); } catch {}

      let ref = baseBranch;
      try {
        this.exec(`git rev-parse --verify origin/${baseBranch}`);
        ref = `origin/${baseBranch}`;
      } catch {
        this.exec(`git rev-parse --verify ${baseBranch}`);
      }

      const mergeBase = this.exec(`git merge-base HEAD ${ref}`).trim();
      const output = this.exec(`git diff --name-status ${mergeBase} HEAD`);

      return output.split('\n')
        .filter(Boolean)
        .map(line => {
          const parts = line.split('\t');
          const statusChar = parts[0][0];
          const filePath = parts[parts.length - 1];
          const oldPath = parts.length === 3 ? parts[1] : undefined;

          let status: DiffFile['status'] = 'modified';
          if (statusChar === 'A') status = 'added';
          else if (statusChar === 'D') status = 'deleted';
          else if (statusChar === 'R') status = 'renamed';

          return { path: filePath, status, oldPath };
        });
    } catch (e) {
      throw new Error(`Git error: ${e}`);
    }
  }

  async getFileContentAtRef(ref: string, filePath: string): Promise<string> {
    if (!this.workspaceRoot) return '';
    try {
      let resolvedRef = ref;
      try {
        this.exec(`git rev-parse --verify origin/${ref}`);
        resolvedRef = `origin/${ref}`;
      } catch {}

      let mergeBase: string;
      try {
        mergeBase = this.exec(`git merge-base HEAD ${resolvedRef}`).trim();
      } catch {
        mergeBase = resolvedRef;
      }

      return this.exec(`git show ${mergeBase}:${filePath}`);
    } catch {
      return '';
    }
  }

  async getDiffStats(baseBranch: string): Promise<{ added: number; removed: number; files: number }> {
    if (!this.workspaceRoot) return { added: 0, removed: 0, files: 0 };
    try {
      let ref = baseBranch;
      try {
        this.exec(`git rev-parse --verify origin/${baseBranch}`);
        ref = `origin/${baseBranch}`;
      } catch {}

      const mergeBase = this.exec(`git merge-base HEAD ${ref}`).trim();
      const output = this.exec(`git diff --shortstat ${mergeBase} HEAD`);

      const filesMatch = output.match(/(\d+) file/);
      const addedMatch = output.match(/(\d+) insertion/);
      const removedMatch = output.match(/(\d+) deletion/);

      return {
        files: filesMatch ? parseInt(filesMatch[1]) : 0,
        added: addedMatch ? parseInt(addedMatch[1]) : 0,
        removed: removedMatch ? parseInt(removedMatch[1]) : 0,
      };
    } catch {
      return { added: 0, removed: 0, files: 0 };
    }
  }

  private exec(command: string): string {
    if (!this.workspaceRoot) throw new Error('No workspace');
    return execSync(command, {
      cwd: this.workspaceRoot,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
  }
}
