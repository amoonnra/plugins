import * as path from 'node:path';
import * as vscode from 'vscode';
import { readText, resourceKey } from './manifest';

/** Watches Git HEAD directly, including nested repositories and linked worktrees. */
export class GitWatcher implements vscode.Disposable {
  private readonly watchers = new Map<string, vscode.Disposable>();
  private readonly heads = new Map<string, string | undefined>();
  private disposed = false;

  constructor(private readonly changed: () => void) {}

  async update(manifests: readonly vscode.Uri[]): Promise<readonly vscode.Uri[]> {
    const roots = new Map<string, vscode.Uri[]>();
    const cache = new Map<string, Promise<vscode.Uri | undefined>>();
    for (const manifest of manifests) {
      if (this.disposed) return [];
      let directory = vscode.Uri.joinPath(manifest, '..');
      for (;;) {
        const marker = vscode.Uri.joinPath(directory, '.git');
        const key = resourceKey(marker);
        let pending = cache.get(key);
        if (pending === undefined) {
          pending = this.gitDirectory(marker);
          cache.set(key, pending);
        }
        const git = await pending;
        if (git !== undefined) {
          const key = resourceKey(git);
          const projects = roots.get(key) ?? [];
          projects.push(manifest);
          roots.set(key, projects);
          break;
        }
        const parent = vscode.Uri.joinPath(directory, '..');
        if (parent.path === directory.path) break;
        directory = parent;
      }
    }
    if (this.disposed) return [];
    for (const [key, watcher] of this.watchers) {
      if (!roots.has(key)) {
        watcher.dispose();
        this.watchers.delete(key);
        this.heads.delete(key);
      }
    }
    const changed: vscode.Uri[] = [];
    for (const [key, projects] of roots) {
      const head = await readText(vscode.Uri.joinPath(vscode.Uri.parse(key), 'HEAD'));
      if (this.disposed) return [];
      if (this.heads.has(key) && head !== this.heads.get(key)) changed.push(...projects);
      this.heads.set(key, head);
      if (this.watchers.has(key)) continue;
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.parse(key), 'HEAD'),
      );
      this.watchers.set(
        key,
        vscode.Disposable.from(
          watcher,
          watcher.onDidChange(this.changed),
          watcher.onDidCreate(this.changed),
          watcher.onDidDelete(this.changed),
        ),
      );
    }
    return changed;
  }

  private async gitDirectory(marker: vscode.Uri): Promise<vscode.Uri | undefined> {
    try {
      const stat = await vscode.workspace.fs.stat(marker);
      if ((stat.type & vscode.FileType.Directory) !== 0) return marker;
      const text = await readText(marker);
      const gitdir = /^gitdir:\s*(.+)$/m.exec(text ?? '')?.[1]?.trim();
      return gitdir === undefined
        ? undefined
        : vscode.Uri.file(path.resolve(vscode.Uri.joinPath(marker, '..').fsPath, gitdir));
    } catch (error: unknown) {
      if (
        error instanceof vscode.FileSystemError &&
        ['FileNotFound', 'FileNotADirectory'].includes(error.code)
      )
        return undefined;
      throw error;
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const watcher of this.watchers.values()) watcher.dispose();
    this.watchers.clear();
    this.heads.clear();
  }
}
