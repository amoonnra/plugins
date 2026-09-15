import * as vscode from 'vscode';

import { BooleanInlayHintsProvider } from './booleanInlayHintsProvider';

/** Languages supported by the extension. */
const DOCUMENT_SELECTOR: vscode.DocumentSelector = [{ language: 'json' }, { language: 'jsonc' }];

/**
 * Activates JSON Boolean Toggle and registers its inlay hint provider.
 *
 * @param context - VS Code extension context used to manage subscriptions.
 */
export function activate(context: vscode.ExtensionContext): void {
  const provider = new BooleanInlayHintsProvider();

  context.subscriptions.push(
    provider,
    vscode.languages.registerInlayHintsProvider(DOCUMENT_SELECTOR, provider),
  );
}

/** Deactivates the extension after VS Code disposes all registered subscriptions. */
export function deactivate(): void {
  // VS Code disposes resources registered in the extension context.
}
