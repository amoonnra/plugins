import { satisfies, valid, validRange } from 'semver';
import * as vscode from 'vscode';
import { readManifest, stringAt } from './manifest';
import type { Dependency, Manifest } from './manifest';

export interface DependencyIssue {
  readonly kind: 'missing' | 'alias' | 'invalid' | 'version';
  readonly dependency: Dependency;
  readonly installed: string | undefined;
  readonly message: string;
}

export interface ProjectResult {
  readonly manifest: Manifest;
  readonly issues: readonly DependencyIssue[];
}

export type InstalledCache = Map<string, Promise<Manifest | undefined>>;

async function installedPackage(
  manifest: vscode.Uri,
  name: string,
  cache: InstalledCache,
): Promise<Manifest | undefined> {
  let directory = vscode.Uri.joinPath(manifest, '..');
  for (;;) {
    const candidate = vscode.Uri.joinPath(
      directory,
      'node_modules',
      ...name.split('/'),
      'package.json',
    );
    const key = candidate.toString();
    let pending = cache.get(key);
    if (pending === undefined) {
      pending = readManifest(candidate, false);
      cache.set(key, pending);
    }
    const installed = await pending;
    if (installed !== undefined) return installed;
    // A nearer package directory shadows hoisted copies, even if its manifest is invalid.
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(candidate, '..'));
      return undefined;
    } catch (error: unknown) {
      if (
        !(error instanceof vscode.FileSystemError) ||
        !['FileNotFound', 'FileNotADirectory'].includes(error.code)
      )
        throw error;
    }
    const parent = vscode.Uri.joinPath(directory, '..');
    if (parent.path === directory.path) return undefined;
    directory = parent;
  }
}

export async function checkProject(
  manifest: Manifest,
  cache: InstalledCache,
): Promise<ProjectResult> {
  const config = vscode.workspace.getConfiguration('dependencyVersionCheck', manifest.uri);
  const issues: DependencyIssue[] = [];
  for (const dependency of manifest.dependencies) {
    if (
      dependency.section === 'peerDependencies' &&
      !config.get<boolean>('checkPeerDependencies', true)
    )
      continue;
    const installedManifest = await installedPackage(manifest.uri, dependency.name, cache);
    const installed =
      installedManifest === undefined ? undefined : stringAt(installedManifest.root, ['version']);
    const alias = /^npm:((?:@[^/]+\/)?[^@]+)(?:@(.+))?$/.exec(dependency.required);
    const specification = alias === null ? dependency.required : (alias[2] ?? '*');
    const range = validRange(
      specification.startsWith('workspace:') ? specification.slice(10) : specification,
    );
    let kind: DependencyIssue['kind'] | undefined;
    let reason = '';
    if (installedManifest === undefined) {
      if (
        dependency.optional &&
        (dependency.section === 'peerDependencies' ||
          !config.get<boolean>('checkOptionalDependencies', false))
      )
        continue;
      kind = 'missing';
      reason = `Not installed. Requires ${dependency.required}.`;
    } else if (alias !== null && stringAt(installedManifest.root, ['name']) !== alias[1]) {
      kind = 'alias';
      reason = `Expected alias ${alias[1] ?? ''}; a different package is installed.`;
    } else if (installed === undefined || valid(installed) === null) {
      kind = 'invalid';
      reason = 'Installed version is invalid.';
    } else if (range !== null && !satisfies(installed, range)) {
      kind = 'version';
      reason = `Requires ${dependency.required}; installed ${installed}.`;
    }
    if (kind !== undefined)
      issues.push({
        kind,
        dependency,
        installed,
        message: `${dependency.name}: ${reason}`,
      });
  }
  return { manifest, issues };
}
