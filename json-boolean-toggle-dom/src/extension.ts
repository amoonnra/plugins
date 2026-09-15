import * as vscode from 'vscode';

import { BooleanInlayHintsProvider } from './booleanInlayHintsProvider';
import { INSTALL_PATCH_COMMAND, UNINSTALL_PATCH_COMMAND } from './constants';
import { installDomPatch, isPermissionError, uninstallDomPatch } from './domPatch';

/** Languages supported by the extension. */
const DOCUMENT_SELECTOR: vscode.DocumentSelector = [{ language: 'json' }, { language: 'jsonc' }];

/** Supported renderer patch operation. */
type PatchAction = 'install' | 'uninstall';

/**
 * Activates the experimental extension, commands, and inlay hint provider.
 *
 * @param context - VS Code extension context used to manage subscriptions.
 */
export function activate(context: vscode.ExtensionContext): void {
  const provider = new BooleanInlayHintsProvider();

  context.subscriptions.push(
    provider,
    vscode.languages.registerInlayHintsProvider(DOCUMENT_SELECTOR, provider),
    vscode.commands.registerCommand(INSTALL_PATCH_COMMAND, async () => {
      await installRendererPatch(context);
    }),
    vscode.commands.registerCommand(UNINSTALL_PATCH_COMMAND, async () => {
      await restoreWorkbench(context);
    }),
  );
}

/** Deactivates the extension after VS Code disposes all registered subscriptions. */
export function deactivate(): void {
  // VS Code disposes resources registered in the extension context.
}

/**
 * Installs the renderer patch after explicit confirmation.
 *
 * @param context - Context used to locate bundled renderer assets.
 */
async function installRendererPatch(context: vscode.ExtensionContext): Promise<void> {
  const confirmation = await vscode.window.showWarningMessage(
    'This unsupported patch modifies the installed VS Code workbench, may trigger an integrity warning, and is removed by VS Code updates.',
    { modal: true },
    'Install Experimental UI',
  );

  if (confirmation !== 'Install Experimental UI') {
    return;
  }

  try {
    const result = await installDomPatch(vscode.env.appRoot, context.extensionPath);
    const verb = result.wasAlreadyInstalled ? 'updated' : 'installed';
    await offerReload(`JSON Boolean Toggle DOM was ${verb}. Reload VS Code to activate it.`);
  } catch (error: unknown) {
    await handlePatchFailure('install', context, error);
  }
}

/**
 * Restores the original renderer after explicit confirmation.
 *
 * @param context - Context used to locate the privileged helper.
 */
async function restoreWorkbench(context: vscode.ExtensionContext): Promise<void> {
  const confirmation = await vscode.window.showWarningMessage(
    'Restore the original VS Code workbench and disable the experimental toggle UI?',
    { modal: true },
    'Restore Workbench',
  );

  if (confirmation !== 'Restore Workbench') {
    return;
  }

  try {
    await uninstallDomPatch(vscode.env.appRoot, context.extensionPath);
    await offerReload('The original VS Code workbench was restored. Reload VS Code to finish.');
  } catch (error: unknown) {
    await handlePatchFailure('uninstall', context, error);
  }
}

/**
 * Offers to reload the current window after a successful patch operation.
 *
 * @param message - Success message displayed to the user.
 */
async function offerReload(message: string): Promise<void> {
  const selection = await vscode.window.showInformationMessage(message, 'Reload Window');

  if (selection === 'Reload Window') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}

/**
 * Reports a patch failure and provides a privileged command on macOS and Linux.
 *
 * @param action - Patch operation that failed.
 * @param context - Context used to locate the bundled command-line helper.
 * @param error - Unknown caught value.
 */
async function handlePatchFailure(
  action: PatchAction,
  context: vscode.ExtensionContext,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  if (isPermissionError(error) && process.platform !== 'win32') {
    const selection = await vscode.window.showErrorMessage(
      `VS Code is not writable: ${message}`,
      'Copy Privileged Command',
    );

    if (selection === 'Copy Privileged Command') {
      await vscode.env.clipboard.writeText(buildPrivilegedCommand(action, context));
      await vscode.window.showInformationMessage(
        'The command was copied. Run it in a terminal, then reload every VS Code window.',
      );
    }

    return;
  }

  await vscode.window.showErrorMessage(`Unable to ${action} the DOM patch: ${message}`);
}

/**
 * Builds a macOS or Linux command that reruns the bundled helper with elevated permissions.
 *
 * @param action - Patch operation to perform.
 * @param context - Context used to locate the bundled helper.
 * @returns Shell command suitable for a POSIX terminal.
 */
function buildPrivilegedCommand(action: PatchAction, context: vscode.ExtensionContext): string {
  const executable = quoteForPosixShell(process.execPath);
  const helper = quoteForPosixShell(context.asAbsolutePath('dist/dom-patch-cli.js'));
  const appRoot = quoteForPosixShell(vscode.env.appRoot);
  return `sudo env ELECTRON_RUN_AS_NODE=1 ${executable} ${helper} ${action} ${appRoot}`;
}

/**
 * Quotes one argument for a POSIX-compatible shell.
 *
 * @param value - Raw argument value.
 * @returns Safely single-quoted shell argument.
 */
function quoteForPosixShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
