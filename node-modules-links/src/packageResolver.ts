import * as vscode from 'vscode';

/**
 * Validates directory-safe npm names, including scoped and legacy uppercase names.
 *
 * @param name - Dependency key from the manifest.
 * @returns Whether the name can be appended to node_modules without path traversal.
 */
export function isPackageName(name: string): boolean {
  return /^(?:@[a-zA-Z0-9_~][a-zA-Z0-9._~-]*\/)?[a-zA-Z0-9_~][a-zA-Z0-9._~-]*$/.test(name);
}

/**
 * Checks a resource without suppressing permission errors or unavailable file systems.
 *
 * @param uri - Resource to inspect through VS Code's local or remote file system.
 * @returns File metadata, or undefined when the resource does not exist.
 */
export async function statIfExists(uri: vscode.Uri): Promise<vscode.FileStat | undefined> {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch (error: unknown) {
    if (
      error instanceof vscode.FileSystemError &&
      (error.code === 'FileNotFound' || error.code === 'FileNotADirectory')
    ) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Finds the closest installed package using Node's upward node_modules directory search.
 *
 * @param manifest - Source package.json URI; its directory is the search origin.
 * @param name - Valid dependency name, including the alias rather than the aliased package's name.
 * @returns The installed package directory, preserving pnpm and workspace symlink paths.
 */
export async function findPackageDirectory(
  manifest: vscode.Uri,
  name: string,
): Promise<vscode.Uri | undefined> {
  if (!isPackageName(name)) {
    return undefined;
  }

  let directory = vscode.Uri.joinPath(manifest, '..');
  for (;;) {
    if (directory.path.split('/').at(-1) !== 'node_modules') {
      const candidate = vscode.Uri.joinPath(directory, 'node_modules', ...name.split('/'));
      const stat = await statIfExists(candidate);
      if (stat !== undefined && (stat.type & vscode.FileType.Directory) !== 0) {
        return candidate;
      }
    }

    const parent = vscode.Uri.joinPath(directory, '..');
    if (parent.path === directory.path) {
      return undefined;
    }
    directory = parent;
  }
}
