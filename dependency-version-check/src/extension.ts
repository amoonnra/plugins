import * as vscode from 'vscode';
import { checkProject } from './dependencyChecker';
import type { InstalledCache, ProjectResult } from './dependencyChecker';
import { GitWatcher } from './gitWatcher';
import { createInstallationTask, resolveInstallation } from './installer';
import type { Installation } from './installer';
import { findNearestManifest, isProjectManifest, readManifest, resourceKey } from './manifest';
import type { Manifest } from './manifest';
import { dependencyHover, issueSummary, projectTitle } from './presentation';

const INSTALL = 'dependencyVersionCheck.install';
const SHOW = 'dependencyVersionCheck.showProblems';
const SELECTOR: vscode.DocumentSelector = [
  { scheme: 'file', language: 'json', pattern: '**/package.json' },
  { scheme: 'file', language: 'jsonc', pattern: '**/package.json' },
];

/** Coordinates discovery, diagnostics and user-initiated installation without executing code during checks. */
class DependencyMonitor implements vscode.Disposable {
  private readonly diagnostics = vscode.languages.createDiagnosticCollection(
    'dependency-version-check',
  );
  private readonly status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 40);
  private readonly output = vscode.window.createOutputChannel('Dependency Version Check');
  private readonly disposables: vscode.Disposable[] = [];
  private readonly results = new Map<string, ProjectResult>();
  private readonly manifestUris = new Set<string>();
  private readonly notified = new Map<string, string>();
  private readonly branchRevisions = new Map<string, number>();
  private readonly running = new Set<string>();
  private readonly errors = new Set<string>();
  private readonly git = new GitWatcher(() => this.schedule());
  private generation = 0;
  private refreshing = false;
  private pending = false;
  private disposed = false;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private poll: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.status.name = 'Dependency Version Check';
    this.status.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    this.status.command = SHOW;
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/{package.json,package-lock.json,pnpm-lock.yaml,yarn.lock,bun.lock,bun.lockb,pnpm-workspace.yaml}',
    );
    this.disposables.push(
      watcher,
      watcher.onDidChange(() => this.schedule()),
      watcher.onDidCreate(() => this.schedule()),
      watcher.onDidDelete(() => this.schedule()),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (isProjectManifest(event.document.uri) && event.contentChanges.length > 0) {
          this.results.delete(resourceKey(event.document.uri));
          this.diagnostics.delete(event.document.uri);
          this.schedule();
        }
      }),
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (isProjectManifest(document.uri)) this.schedule();
      }),
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (isProjectManifest(document.uri)) this.schedule();
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (isProjectManifest(document.uri)) this.schedule();
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.schedule()),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('dependencyVersionCheck')) {
          this.configurePoll();
          this.schedule();
        }
      }),
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.schedule();
      }),
      vscode.window.tabGroups.onDidChangeTabs(() => this.schedule()),
      vscode.window.tabGroups.onDidChangeTabGroups(() => this.schedule()),
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) this.schedule();
      }),
      vscode.commands.registerCommand('dependencyVersionCheck.refresh', () => this.refresh()),
      vscode.commands.registerCommand(INSTALL, (argument: unknown) =>
        this.install(typeof argument === 'string' ? argument : undefined),
      ),
      vscode.commands.registerCommand(SHOW, () => this.showProjects()),
      vscode.languages.registerHoverProvider(SELECTOR, {
        provideHover: (document, position) => this.hover(document, position),
      }),
      vscode.languages.registerCodeActionsProvider(
        SELECTOR,
        { provideCodeActions: (document, range) => this.actions(document, range) },
        { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
      ),
      vscode.tasks.onDidEndTaskProcess((event) => {
        if (event.execution.task.definition.type !== 'dependencyVersionCheck') return;
        if (event.exitCode !== 0)
          this.background(
            vscode.window.showWarningMessage(
              `Dependency installation failed or was interrupted (exit ${event.exitCode ?? 'unknown'}). See the task terminal.`,
            ),
          );
        this.schedule();
      }),
      vscode.tasks.onDidEndTask((event) => {
        if (event.execution.task.definition.type !== 'dependencyVersionCheck') return;
        const directory: unknown = event.execution.task.definition.directory;
        if (typeof directory === 'string')
          this.running.delete(resourceKey(vscode.Uri.parse(directory)));
        this.schedule();
      }),
    );
    this.configurePoll();
    this.schedule();
  }

  private background(promise: Thenable<unknown>): void {
    void Promise.resolve(promise).catch((error: unknown) => this.log(error));
  }

  private log(error: unknown): void {
    // Log only error names/codes: user-controlled manifests and commands may contain secrets.
    const kind =
      error instanceof vscode.FileSystemError
        ? error.code
        : error instanceof Error
          ? error.name
          : 'UnknownError';
    if (!this.errors.has(kind))
      this.output.appendLine(
        `Dependency check failed: ${kind}. Check file permissions and run Refresh All Projects.`,
      );
    this.errors.add(kind);
  }

  private configurePoll(): void {
    if (this.poll !== undefined) clearInterval(this.poll);
    const seconds = vscode.workspace
      .getConfiguration('dependencyVersionCheck')
      .get<number>('pollIntervalSeconds', 15);
    this.poll = setInterval(
      () => {
        if (vscode.window.state.focused) this.schedule();
      },
      Math.max(5, Math.min(300, seconds)) * 1000,
    );
  }

  private schedule(): void {
    if (this.disposed) return;
    this.generation++;
    if (this.debounce !== undefined) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.background(this.refresh());
    }, 300);
  }

  private async discover(): Promise<readonly vscode.Uri[]> {
    const exclude = vscode.workspace
      .getConfiguration('dependencyVersionCheck')
      .get<string>('exclude', '**/{node_modules,.git,.yarn,.pnpm-store,dist,build,coverage}/**');
    const files = await vscode.workspace.findFiles('**/package.json', exclude);
    const byUri = new Map(files.filter(isProjectManifest).map((uri) => [resourceKey(uri), uri]));
    const active = this.activeFileUri();
    if (active !== undefined) {
      const owner = await findNearestManifest(active);
      if (owner !== undefined) byUri.set(resourceKey(owner), owner);
    }
    for (const document of vscode.workspace.textDocuments) {
      if (!isProjectManifest(document.uri) || document.isClosed) continue;
      // Explicitly opened package manifests are checked even outside workspace folders.
      byUri.set(resourceKey(document.uri), document.uri);
    }
    return [...byUri.values()];
  }

  private async refresh(): Promise<void> {
    if (this.disposed) return;
    if (this.refreshing) {
      this.pending = true;
      return;
    }
    this.refreshing = true;
    const generation = this.generation;
    try {
      if (
        !vscode.workspace.getConfiguration('dependencyVersionCheck').get<boolean>('enabled', true)
      ) {
        this.results.clear();
        this.diagnostics.clear();
        this.status.hide();
        this.notified.clear();
        return;
      }
      const files = await this.discover();
      this.manifestUris.clear();
      for (const uri of files) this.manifestUris.add(resourceKey(uri));
      for (const key of this.notified.keys()) {
        if (!this.manifestUris.has(key)) this.notified.delete(key);
      }
      for (const key of this.branchRevisions.keys()) {
        if (!this.manifestUris.has(key)) this.branchRevisions.delete(key);
      }
      try {
        for (const uri of await this.git.update(files)) {
          const key = resourceKey(uri);
          this.branchRevisions.set(key, (this.branchRevisions.get(key) ?? 0) + 1);
        }
      } catch (error: unknown) {
        this.log(error);
      }
      const cache: InstalledCache = new Map();
      const next = new Map<string, ProjectResult>();
      let index = 0;
      const worker = async (): Promise<void> => {
        for (;;) {
          const uri = files[index++];
          if (uri === undefined || this.disposed || generation !== this.generation) return;
          try {
            const manifest = await readManifest(uri);
            if (manifest !== undefined)
              next.set(resourceKey(uri), await checkProject(manifest, cache));
          } catch (error: unknown) {
            this.log(error);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(8, files.length) }, worker));
      if (this.disposed || generation !== this.generation) return;
      this.results.clear();
      this.diagnostics.clear();
      for (const [key, result] of next) {
        this.results.set(key, result);
        if (result.issues.length === 0) this.notified.delete(key);
        this.diagnostics.set(
          result.manifest.uri,
          result.issues.map((issue) => {
            const diagnostic = new vscode.Diagnostic(
              issue.dependency.range,
              issue.message,
              vscode.DiagnosticSeverity.Warning,
            );
            diagnostic.source = 'Dependency Version Check';
            diagnostic.code = 'dependency-out-of-sync';
            return diagnostic;
          }),
        );
      }
      this.updateStatus();
      this.notify();
    } finally {
      this.refreshing = false;
      if (this.pending && !this.disposed) {
        this.pending = false;
        this.schedule();
      }
    }
  }

  private affected(): readonly ProjectResult[] {
    return [...this.results.values()].filter((result) => result.issues.length > 0);
  }

  private activeProject(): ProjectResult | undefined {
    const key = this.activeManifestUri();
    return key === undefined ? undefined : this.results.get(key);
  }

  private activeFileUri(): vscode.Uri | undefined {
    const editor = vscode.window.activeTextEditor?.document.uri;
    if (editor?.scheme === 'file') return editor;
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    const uri =
      input instanceof vscode.TabInputText
        ? input.uri
        : input instanceof vscode.TabInputTextDiff
          ? input.modified
          : undefined;
    return uri?.scheme === 'file' ? uri : undefined;
  }

  private activeManifestUri(): string | undefined {
    const uri = this.activeFileUri();
    if (uri?.scheme !== 'file' || uri.path.split('/').includes('node_modules')) return undefined;
    let directory = vscode.Uri.joinPath(uri, '..');
    for (;;) {
      const key = resourceKey(vscode.Uri.joinPath(directory, 'package.json'));
      // Stop at an invalid/incomplete nearest manifest rather than installing in a parent project.
      if (this.manifestUris.has(key)) return key;
      const parent = vscode.Uri.joinPath(directory, '..');
      if (parent.path === directory.path) return undefined;
      directory = parent;
    }
  }

  private fingerprint(project: ProjectResult): string {
    const sort = (a: readonly unknown[], b: readonly unknown[]): number =>
      JSON.stringify(a).localeCompare(JSON.stringify(b));
    return JSON.stringify({
      branch: this.branchRevisions.get(resourceKey(project.manifest.uri)) ?? 0,
      dependencies: project.manifest.dependencies
        .map((dependency) => [dependency.section, dependency.name, dependency.required])
        .sort(sort),
      issues: project.issues
        .map((issue) => [
          issue.dependency.section,
          issue.dependency.name,
          issue.dependency.required,
          issue.installed,
          issue.kind,
        ])
        .sort(sort),
    });
  }

  private updateStatus(): void {
    const affected = this.affected();
    const count = affected.reduce((sum, result) => sum + result.issues.length, 0);
    if (count === 0) {
      this.status.hide();
      return;
    }
    this.status.text = `$(package) Dependencies: ${count}`;
    const tooltip = new vscode.MarkdownString('', true);
    tooltip.appendMarkdown(
      `📦 **Dependency checks**\n\n${issueSummary(affected.flatMap((project) => project.issues))}\n\n`,
    );
    for (const project of affected.slice(0, 5)) {
      tooltip.appendMarkdown('- **');
      tooltip.appendText(projectTitle(project.manifest.uri));
      tooltip.appendMarkdown(`** · ${issueSummary(project.issues)}\n`);
    }
    if (affected.length > 5)
      tooltip.appendMarkdown(`\n…and ${affected.length - 5} more projects.\n`);
    tooltip.appendMarkdown(
      '\nClick to view projects. Installation applies only to the active file’s project.',
    );
    this.status.tooltip = tooltip;
    this.status.accessibilityInformation = {
      label: `${count} dependency warnings in ${affected.length} projects`,
    };
    this.status.show();
  }

  private notify(): void {
    if (
      this.disposed ||
      !vscode.workspace
        .getConfiguration('dependencyVersionCheck')
        .get<boolean>('notifications', true)
    )
      return;
    const active = this.activeFileUri();
    if (active !== undefined && isProjectManifest(active)) return;
    const project = this.activeProject();
    if (
      project === undefined ||
      project.issues.length === 0 ||
      this.running.has(resourceKey(vscode.Uri.joinPath(project.manifest.uri, '..')))
    )
      return;
    const key = resourceKey(project.manifest.uri);
    const fingerprint = this.fingerprint(project);
    if (fingerprint === this.notified.get(key)) return;
    this.notified.set(key, fingerprint);
    this.background(
      (async (): Promise<void> => {
        try {
          const action = await vscode.window.showWarningMessage(
            `📦 ${projectTitle(project.manifest.uri)} · ${issueSummary(project.issues)}`,
            'Install',
            'Open package.json',
            'Later',
          );
          if (this.disposed) return;
          // Old actions and dismissal must not consume a newer dependency / branch notification.
          const current = this.results.get(key);
          if (current === undefined || this.fingerprint(current) !== fingerprint) return;
          if (action === 'Install') await this.install(project.manifest.uri.toString());
          else if (action === 'Open package.json') await this.openProject(project);
        } finally {
          this.notify();
        }
      })(),
    );
  }

  private hover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const result = this.results.get(resourceKey(document.uri));
    const issue = result?.issues.find((item) => item.dependency.range.contains(position));
    if (issue === undefined) return undefined;
    const markdown = dependencyHover(issue, document.uri, INSTALL);
    return new vscode.Hover(markdown, issue.dependency.range);
  }

  private actions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
    const result = this.results.get(resourceKey(document.uri));
    if (
      result === undefined ||
      !result.issues.some((issue) => issue.dependency.range.intersection(range) !== undefined)
    )
      return [];
    const action = new vscode.CodeAction(
      'Install dependencies for this project',
      vscode.CodeActionKind.QuickFix,
    );
    action.command = {
      command: INSTALL,
      title: action.title,
      arguments: [document.uri.toString()],
    };
    action.diagnostics =
      this.diagnostics
        .get(document.uri)
        ?.filter((item) => item.range.intersection(range) !== undefined) ?? [];
    return [action];
  }

  private async pickProject(): Promise<ProjectResult | undefined> {
    const affected = this.affected();
    if (affected.length === 1) return affected[0];
    const result = await vscode.window.showQuickPick(
      affected.map((project) => ({
        label: `$(package) ${projectTitle(project.manifest.uri)}`,
        description: issueSummary(project.issues),
        detail: vscode.workspace.asRelativePath(project.manifest.uri, true),
        project,
      })),
      { title: 'Dependency checks', placeHolder: 'Open a project’s package.json' },
    );
    return result?.project;
  }

  private async showProjects(): Promise<void> {
    const project = await this.pickProject();
    if (project === undefined) return;
    await this.openProject(project);
  }

  private async openProject(project: ProjectResult): Promise<void> {
    const editor = await vscode.window.showTextDocument(project.manifest.uri);
    const first = project.issues[0];
    if (first !== undefined) editor.revealRange(first.dependency.range);
  }

  private async install(argument?: string): Promise<void> {
    const active = this.activeFileUri();
    if (active === undefined) {
      await vscode.window.showInformationMessage(
        'Select a project file or its package.json, then choose Install.',
      );
      return;
    }
    const uri = await findNearestManifest(active);
    if (uri === undefined) {
      await vscode.window.showInformationMessage(
        'No package.json was found above the current file.',
      );
      return;
    }
    if (argument !== undefined && resourceKey(vscode.Uri.parse(argument)) !== resourceKey(uri)) {
      await vscode.window.showInformationMessage(
        'This action belongs to another project. Use Install in the current project’s package.json.',
      );
      return;
    }
    const manifest = await readManifest(uri);
    if (manifest === undefined) {
      await vscode.window.showWarningMessage('Fix package.json before installing dependencies.');
      return;
    }
    await this.installProject(manifest);
  }

  private async installProject(project: Manifest): Promise<void> {
    if (!vscode.workspace.isTrusted) {
      await vscode.window.showWarningMessage(
        'Trust this workspace before installing dependencies.',
      );
      return;
    }
    // Save the target manifest first; installation must read exactly what the user sees.
    const document = vscode.workspace.textDocuments.find(
      (item) => resourceKey(item.uri) === resourceKey(project.uri),
    );
    if (document?.isDirty && !(await document.save())) {
      await vscode.window.showWarningMessage(
        'Installation cancelled because package.json could not be saved.',
      );
      return;
    }
    const manifest = await readManifest(project.uri, false);
    if (manifest === undefined) {
      await vscode.window.showWarningMessage(
        'Installation skipped: package.json is missing or invalid.',
      );
      return;
    }
    let installation: Installation;
    try {
      installation = await resolveInstallation(manifest);
    } catch (error: unknown) {
      this.log(error);
      await vscode.window.showWarningMessage(
        'Could not prepare a project-only install. Check workspace configuration or set dependencyVersionCheck.installCommand for this project.',
      );
      return;
    }
    const key = resourceKey(installation.directory);
    // Focus can change while saving the manifest or resolving the package manager.
    const active = this.activeFileUri();
    if (active === undefined || this.running.has(key)) return;
    const currentManifest = await findNearestManifest(active);
    const currentFile = this.activeFileUri();
    if (
      this.disposed ||
      this.running.has(key) ||
      currentManifest === undefined ||
      resourceKey(currentManifest) !== resourceKey(project.uri) ||
      currentFile === undefined ||
      resourceKey(currentFile) !== resourceKey(active)
    )
      return;
    this.running.add(key);
    try {
      await vscode.tasks.executeTask(createInstallationTask(installation));
    } catch (error: unknown) {
      this.running.delete(key);
      this.log(error);
      await vscode.window.showWarningMessage(
        'Could not start dependency installation. Check the configured command and task terminal.',
      );
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.debounce !== undefined) clearTimeout(this.debounce);
    if (this.poll !== undefined) clearInterval(this.poll);
    for (const disposable of this.disposables) disposable.dispose();
    this.git.dispose();
    this.diagnostics.dispose();
    this.status.dispose();
    this.output.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(new DependencyMonitor());
}
