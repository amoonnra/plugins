import * as path from 'node:path';

import { installDomPatch, uninstallDomPatch } from './domPatch';

/**
 * Parses and executes one privileged patch operation.
 *
 * @returns A promise that resolves after the requested operation completes.
 */
async function main(): Promise<void> {
  const action = process.argv[2];
  const appRoot = process.argv[3];
  const extensionRoot = path.resolve(__dirname, '..');

  if ((action !== 'install' && action !== 'uninstall') || appRoot === undefined) {
    throw new Error('Usage: dom-patch-cli.js <install|uninstall> <vscode-app-root>');
  }

  if (action === 'install') {
    const result = await installDomPatch(appRoot, extensionRoot);
    process.stdout.write(`Patched VS Code workbench: ${result.workbenchHtml}\n`);
    return;
  }

  const result = await uninstallDomPatch(appRoot, extensionRoot);
  process.stdout.write(`Restored VS Code workbench: ${result.workbenchHtml}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
