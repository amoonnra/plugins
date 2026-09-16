import { findNodeAtLocation } from 'jsonc-parser';
import * as vscode from 'vscode';
import { parseDocument } from 'yaml';
import { isPackageName, readManifest, readText, resourceKey, stringAt } from './manifest';
import type { Manifest } from './manifest';

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface Installation {
  readonly directory: vscode.Uri;
  readonly manager: PackageManager;
  readonly customCommand: string;
  readonly arguments: readonly string[];
}

function isManager(value: string): value is PackageManager {
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(value);
}

async function workspaceOwner(root: Manifest, project: vscode.Uri): Promise<boolean> {
  const directory = vscode.Uri.joinPath(root.uri, '..');
  const yaml = await readText(vscode.Uri.joinPath(directory, 'pnpm-workspace.yaml'));
  if (yaml !== undefined) {
    const document = parseDocument(yaml);
    if (document.errors.length > 0) throw new Error('InvalidWorkspaceConfiguration');
    const configuration: unknown = document.toJS({ maxAliasCount: 50 });
    const packages: unknown =
      typeof configuration === 'object' && configuration !== null && 'packages' in configuration
        ? configuration.packages
        : undefined;
    if (packages === undefined) return false;
    if (!Array.isArray(packages) || !packages.every((value: unknown) => typeof value === 'string'))
      throw new Error('InvalidWorkspaceConfiguration');
    return matchesWorkspace(directory, project, packages);
  }
  const workspaces = findNodeAtLocation(root.root, ['workspaces']);
  const array =
    workspaces?.type === 'array'
      ? workspaces
      : findNodeAtLocation(root.root, ['workspaces', 'packages']);
  const patterns: string[] = [];
  for (const node of array?.children ?? []) {
    const value: unknown = node.value;
    if (typeof value === 'string') patterns.push(value);
  }
  return matchesWorkspace(directory, project, patterns);
}

async function matchesWorkspace(
  directory: vscode.Uri,
  project: vscode.Uri,
  patterns: readonly string[],
): Promise<boolean> {
  let included = false;
  for (const pattern of patterns) {
    const excluded = pattern.startsWith('!');
    const glob = (excluded ? pattern.slice(1) : pattern).replace(/^\.\//, '').replace(/\/+$/, '');
    if (glob.length === 0) continue;
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(directory, `${glob}/package.json`),
      '**/node_modules/**',
    );
    if (files.some((uri) => resourceKey(uri) === resourceKey(project))) {
      if (excluded) return false;
      included = true;
    }
  }
  return included;
}

export async function resolveInstallation(project: Manifest): Promise<Installation> {
  let owner = project;
  let directory = vscode.Uri.joinPath(project.uri, '..', '..');
  for (;;) {
    const candidate = await readManifest(vscode.Uri.joinPath(directory, 'package.json'), false);
    if (candidate !== undefined && (await workspaceOwner(candidate, project.uri))) {
      owner = candidate;
      break;
    }
    const parent = vscode.Uri.joinPath(directory, '..');
    if (parent.path === directory.path) break;
    directory = parent;
  }
  const config = vscode.workspace.getConfiguration('dependencyVersionCheck', project.uri);
  const selected = config.get<string>('packageManager', 'auto');
  const declared = (
    stringAt(owner.root, ['packageManager']) ?? stringAt(project.root, ['packageManager'])
  )?.split('@')[0];
  let manager: PackageManager = isManager(selected)
    ? selected
    : declared !== undefined && isManager(declared)
      ? declared
      : 'npm';
  directory = vscode.Uri.joinPath(owner.uri, '..');
  if (selected === 'auto' && (declared === undefined || !isManager(declared))) {
    for (const [file, name] of [
      ['pnpm-lock.yaml', 'pnpm'],
      ['pnpm-workspace.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['bun.lock', 'bun'],
      ['bun.lockb', 'bun'],
      ['package-lock.json', 'npm'],
    ] satisfies readonly (readonly [string, PackageManager])[]) {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(directory, file));
        manager = name;
        break;
      } catch (error: unknown) {
        if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound')
          throw error;
      }
    }
  }
  const projectDirectory = vscode.Uri.joinPath(project.uri, '..');
  const customCommand = config.get<string>('installCommand', '').trim();
  const workspaces = findNodeAtLocation(owner.root, ['workspaces']);
  const workspace =
    resourceKey(owner.uri) !== resourceKey(project.uri) ||
    workspaces?.type === 'array' ||
    workspaces?.type === 'object' ||
    (await readText(vscode.Uri.joinPath(directory, 'pnpm-workspace.yaml'))) !== undefined;
  const argumentsList =
    customCommand.length > 0 ? [] : await installationArguments(manager, project, owner, workspace);
  return { directory: projectDirectory, manager, customCommand, arguments: argumentsList };
}

async function installationArguments(
  manager: PackageManager,
  project: Manifest,
  owner: Manifest,
  workspace: boolean,
): Promise<readonly string[]> {
  if (manager === 'pnpm') return ['install', '--config.recursive-install=false'];
  if (!workspace) return ['install'];
  const member = resourceKey(owner.uri) !== resourceKey(project.uri);
  if (manager === 'npm')
    return member
      ? ['install', '--workspace', vscode.Uri.joinPath(project.uri, '..').fsPath]
      : ['install', '--workspaces=false'];
  if (manager === 'bun') {
    const name = stringAt(project.root, ['name']);
    if (name === undefined || !isPackageName(name)) throw new Error('WorkspacePackageNameRequired');
    return ['install', '--filter', name];
  }
  const declared = stringAt(owner.root, ['packageManager']);
  const major = /^yarn@(\d+)/.exec(declared ?? '')?.[1];
  const lock = await readText(vscode.Uri.joinPath(owner.uri, '..', 'yarn.lock'));
  const modern =
    major !== undefined
      ? Number(major) >= 2
      : /^__metadata:/m.test(lock ?? '') ||
        (await readText(vscode.Uri.joinPath(owner.uri, '..', '.yarnrc.yml'))) !== undefined;
  if (modern) return ['workspaces', 'focus'];
  if (member) return ['install', '--focus'];
  // Yarn Classic cannot focus the root; never silently fall back to installing every workspace.
  throw new Error('YarnClassicRootFocusUnsupported');
}

export function createInstallationTask(installation: Installation): vscode.Task {
  const folder = vscode.workspace.getWorkspaceFolder(installation.directory);
  const cwd = installation.directory.fsPath;
  const execution =
    installation.customCommand.length > 0
      ? new vscode.ShellExecution(installation.customCommand, { cwd })
      : new vscode.ShellExecution(installation.manager, [...installation.arguments], { cwd });
  const task = new vscode.Task(
    { type: 'dependencyVersionCheck', directory: installation.directory.toString() },
    folder ?? vscode.TaskScope.Global,
    `Install dependencies: ${cwd}`,
    'Dependency Version Check',
    execution,
    [],
  );
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
    clear: true,
  };
  return task;
}
