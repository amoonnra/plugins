import { constants as fileConstants } from 'node:fs';
import { access, copyFile, readFile, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

/** Marker placed before the injected renderer script. */
const MARKER_START = '<!-- JSON_BOOLEAN_TOGGLE_DOM_START -->';

/** Marker placed after the injected renderer script. */
const MARKER_END = '<!-- JSON_BOOLEAN_TOGGLE_DOM_END -->';

/** Renderer bridge filename inside the VS Code workbench. */
const BRIDGE_FILENAME = 'json-boolean-toggle-dom.js';

/** Relative directory containing the desktop workbench entry point. */
const WORKBENCH_DIRECTORY = path.join('out', 'vs', 'code', 'electron-browser', 'workbench');

/** Result returned after installing or refreshing the DOM patch. */
export interface InstallPatchResult {
  /** Absolute workbench HTML path that was modified. */
  readonly workbenchHtml: string;

  /** Whether patch markers were already present before this operation. */
  readonly wasAlreadyInstalled: boolean;
}

/** Result returned after restoring the original workbench. */
export interface UninstallPatchResult {
  /** Absolute workbench HTML path that was restored. */
  readonly workbenchHtml: string;
}

/** Paths used by the workbench patch operations. */
interface PatchPaths {
  /** Directory containing the desktop workbench files. */
  readonly workbenchDirectory: string;

  /** HTML entry point modified by the patch. */
  readonly workbenchHtml: string;

  /** Persistent backup of the original HTML entry point. */
  readonly backupHtml: string;

  /** Renderer bridge copied beside the workbench entry point. */
  readonly targetBridge: string;

  /** Renderer bridge bundled with the extension. */
  readonly sourceBridge: string;
}

/**
 * Resolves every path used by an install or uninstall operation.
 *
 * @param appRoot - Application root reported by VS Code.
 * @param extensionRoot - Installed extension directory.
 * @returns Validated patch paths.
 */
function resolvePatchPaths(appRoot: string, extensionRoot: string): PatchPaths {
  if (appRoot.trim() === '') {
    throw new Error('VS Code did not report a desktop application root.');
  }

  const resolvedAppRoot = path.resolve(appRoot);
  const resolvedExtensionRoot = path.resolve(extensionRoot);
  const workbenchDirectory = path.resolve(resolvedAppRoot, WORKBENCH_DIRECTORY);
  const expectedPrefix = `${resolvedAppRoot}${path.sep}`;

  if (!workbenchDirectory.startsWith(expectedPrefix)) {
    throw new Error(`Refusing to patch an unexpected directory: ${workbenchDirectory}`);
  }

  const workbenchHtml = path.join(workbenchDirectory, 'workbench.html');
  return {
    workbenchDirectory,
    workbenchHtml,
    backupHtml: `${workbenchHtml}.json-boolean-toggle.bak`,
    targetBridge: path.join(workbenchDirectory, BRIDGE_FILENAME),
    sourceBridge: path.join(resolvedExtensionRoot, 'renderer', BRIDGE_FILENAME),
  };
}

/**
 * Checks whether a filesystem entry exists.
 *
 * @param target - Absolute path to inspect.
 * @returns Whether the entry can be accessed.
 */
async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, fileConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Installs or refreshes the renderer bridge in a desktop VS Code installation.
 *
 * A backup is created before the first HTML modification. Existing installations
 * only receive the latest bridge file.
 *
 * @param appRoot - Application root reported by VS Code.
 * @param extensionRoot - Installed extension directory.
 * @returns Details about the patched workbench.
 */
export async function installDomPatch(
  appRoot: string,
  extensionRoot: string,
): Promise<InstallPatchResult> {
  const paths = resolvePatchPaths(appRoot, extensionRoot);

  if (!(await pathExists(paths.workbenchHtml))) {
    throw new Error(`VS Code workbench was not found: ${paths.workbenchHtml}`);
  }

  if (!(await pathExists(paths.sourceBridge))) {
    throw new Error(`Bundled renderer bridge was not found: ${paths.sourceBridge}`);
  }

  const html = await readFile(paths.workbenchHtml, 'utf8');
  const wasAlreadyInstalled = html.includes(MARKER_START);

  if (!wasAlreadyInstalled) {
    if (!html.includes('</body>')) {
      throw new Error('Unable to find the workbench body closing tag.');
    }

    if (!(await pathExists(paths.backupHtml))) {
      await copyFile(paths.workbenchHtml, paths.backupHtml, fileConstants.COPYFILE_EXCL);
    }

    const injection = `${MARKER_START}\n<script src="./${BRIDGE_FILENAME}"></script>\n${MARKER_END}`;
    const patchedHtml = html.replace('</body>', `${injection}\n</body>`);
    await writeFile(paths.workbenchHtml, patchedHtml, 'utf8');
  }

  await copyFile(paths.sourceBridge, paths.targetBridge);
  return { workbenchHtml: paths.workbenchHtml, wasAlreadyInstalled };
}

/**
 * Restores the original workbench HTML and removes the copied renderer bridge.
 *
 * @param appRoot - Application root reported by VS Code.
 * @param extensionRoot - Installed extension directory.
 * @returns Details about the restored workbench.
 */
export async function uninstallDomPatch(
  appRoot: string,
  extensionRoot: string,
): Promise<UninstallPatchResult> {
  const paths = resolvePatchPaths(appRoot, extensionRoot);

  if (!(await pathExists(paths.backupHtml))) {
    throw new Error(`Workbench backup was not found: ${paths.backupHtml}`);
  }

  await copyFile(paths.backupHtml, paths.workbenchHtml);

  try {
    await unlink(paths.targetBridge);
  } catch (error: unknown) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }
  }

  return { workbenchHtml: paths.workbenchHtml };
}

/**
 * Determines whether an unknown error represents a missing filesystem entry.
 *
 * @param error - Unknown caught value.
 * @returns Whether the value contains the Node.js ENOENT code.
 */
function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/**
 * Determines whether an unknown error represents insufficient filesystem permissions.
 *
 * @param error - Unknown caught value.
 * @returns Whether the value contains a permission-related Node.js error code.
 */
export function isPermissionError(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error.code === 'EACCES' || error.code === 'EPERM')
  );
}
