import { findNodeAtLocation, parseTree } from 'jsonc-parser';
import type { Node, ParseError } from 'jsonc-parser';
import * as path from 'node:path';
import * as vscode from 'vscode';

export interface Dependency {
  readonly name: string;
  readonly required: string;
  readonly section: string;
  readonly optional: boolean;
  readonly range: vscode.Range;
}

export interface Manifest {
  readonly uri: vscode.Uri;
  readonly root: Node;
  readonly dependencies: readonly Dependency[];
}

/** Uses filesystem path semantics instead of serialized URI casing to identify a resource. */
export function resourceKey(uri: vscode.Uri): string {
  const normalized = path.posix.normalize(uri.path);
  return uri
    .with({
      path:
        uri.scheme === 'file' && process.platform === 'win32'
          ? normalized.toLowerCase()
          : normalized,
      query: '',
      fragment: '',
    })
    .toString();
}

export function stringAt(root: Node, keys: readonly string[]): string | undefined {
  const value: unknown = findNodeAtLocation(root, [...keys])?.value;
  return typeof value === 'string' ? value : undefined;
}

export async function readText(uri: vscode.Uri): Promise<string | undefined> {
  try {
    return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  } catch (error: unknown) {
    if (
      error instanceof vscode.FileSystemError &&
      ['FileNotFound', 'FileNotADirectory'].includes(error.code)
    ) {
      return undefined;
    }
    throw error;
  }
}

export async function readManifest(
  uri: vscode.Uri,
  useEditor = true,
): Promise<Manifest | undefined> {
  const document = useEditor
    ? vscode.workspace.textDocuments.find((item) => resourceKey(item.uri) === resourceKey(uri))
    : undefined;
  const text = document?.getText() ?? (await readText(uri));
  if (text === undefined) return undefined;
  const errors: ParseError[] = [];
  const root = parseTree(text.replace(/^\uFEFF/, ' '), errors, { allowTrailingComma: true });
  if (root?.type !== 'object' || errors.length > 0) return undefined;
  const position = (offset: number): vscode.Position => {
    if (document !== undefined) return document.positionAt(offset);
    const prefix = text.slice(0, offset);
    const lines = prefix.split(/\r\n|\r|\n/);
    return new vscode.Position(lines.length - 1, lines.at(-1)?.length ?? 0);
  };
  const optionalNames = new Set(
    findNodeAtLocation(root, ['optionalDependencies'])?.children?.map((node) =>
      stringAtProperty(node),
    ),
  );
  const dependencies: Dependency[] = [];
  for (const section of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const object = findNodeAtLocation(root, [section]);
    if (object?.type !== 'object') continue;
    for (const property of object.children ?? []) {
      const name = stringAtProperty(property);
      const value = property.children?.[1];
      const required: unknown = value?.value;
      if (
        name === undefined ||
        value?.type !== 'string' ||
        typeof required !== 'string' ||
        !isPackageName(name)
      )
        continue;
      if (section === 'dependencies' && optionalNames.has(name)) continue;
      const peerOptional: unknown = findNodeAtLocation(root, [
        'peerDependenciesMeta',
        name,
        'optional',
      ])?.value;
      dependencies.push({
        name,
        required,
        section,
        optional:
          section === 'optionalDependencies' ||
          (section === 'peerDependencies' && peerOptional === true),
        range: new vscode.Range(position(value.offset), position(value.offset + value.length)),
      });
    }
  }
  return { uri: document?.uri ?? uri, root, dependencies };
}

function stringAtProperty(node: Node): string | undefined {
  const value: unknown = node.children?.[0]?.value;
  return typeof value === 'string' ? value : undefined;
}

export function isPackageName(name: string): boolean {
  return /^(?:@[a-zA-Z0-9_~][a-zA-Z0-9._~-]*\/)?[a-zA-Z0-9_~][a-zA-Z0-9._~-]*$/.test(name);
}

export function isProjectManifest(uri: vscode.Uri): boolean {
  return (
    uri.scheme === 'file' &&
    uri.path.endsWith('/package.json') &&
    !uri.path.split('/').includes('node_modules')
  );
}

/** Finds the owning project even when its manifest is outside discovery roots or exclusions. */
export async function findNearestManifest(file: vscode.Uri): Promise<vscode.Uri | undefined> {
  if (file.scheme !== 'file' || file.path.split('/').includes('node_modules')) return undefined;
  let directory = vscode.Uri.joinPath(file, '..');
  for (;;) {
    const candidate = vscode.Uri.joinPath(directory, 'package.json');
    try {
      await vscode.workspace.fs.stat(candidate);
      return candidate;
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
