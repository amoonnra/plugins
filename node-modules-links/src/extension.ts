import * as vscode from 'vscode';

import { scanDependencies } from './dependencyScanner';
import { findPackageDirectory, isPackageName, statIfExists } from './packageResolver';

/** Private command used by dependency document links. */
const OPEN_PACKAGE_COMMAND = 'nodeModulesLinks.openPackage';

/** Supported manifest documents, on the local or remote extension host. */
const DOCUMENT_SELECTOR: vscode.DocumentSelector = [
  { language: 'json', scheme: 'file', pattern: '**/package.json' },
  { language: 'jsonc', scheme: 'file', pattern: '**/package.json' },
  { language: 'json', scheme: 'vscode-remote', pattern: '**/package.json' },
  { language: 'jsonc', scheme: 'vscode-remote', pattern: '**/package.json' },
];

/**
 * Opens the installed manifest and reveals its package folder without executing package code.
 * Resolution happens on click so installs, removals and symlink changes are immediately reflected.
 *
 * @param manifestArgument - Source manifest URI encoded in the generated command link.
 * @param nameArgument - Dependency key encoded in the generated command link.
 */
async function openPackage(manifestArgument: unknown, nameArgument: unknown): Promise<void> {
  if (
    typeof manifestArgument !== 'string' ||
    typeof nameArgument !== 'string' ||
    !isPackageName(nameArgument)
  ) {
    return;
  }

  try {
    const manifest = vscode.Uri.parse(manifestArgument, true);
    if (
      !['file', 'vscode-remote'].includes(manifest.scheme) ||
      !manifest.path.endsWith('/package.json') ||
      manifest.query !== '' ||
      manifest.fragment !== ''
    ) {
      return;
    }

    const directory = await findPackageDirectory(manifest, nameArgument);
    if (directory === undefined) {
      await vscode.window.showInformationMessage(
        `Node Modules Links: "${nameArgument}" was not found in node_modules. Install the project's dependencies first. Yarn Plug'n'Play without node_modules is not supported.`,
      );
      return;
    }

    const installedManifest = vscode.Uri.joinPath(directory, 'package.json');
    const stat = await statIfExists(installedManifest);
    if (stat !== undefined && (stat.type & vscode.FileType.File) !== 0) {
      const document = await vscode.workspace.openTextDocument(installedManifest);
      await vscode.window.showTextDocument(document, { preview: true });
    }

    // Hoisted packages can live outside the currently opened workspace folder.
    if (vscode.workspace.getWorkspaceFolder(directory) !== undefined) {
      await vscode.commands.executeCommand<void>('revealInExplorer', directory);
    } else if (stat === undefined || (stat.type & vscode.FileType.File) === 0) {
      await vscode.window.showInformationMessage(
        `Node Modules Links: "${nameArgument}" is installed at ${directory.fsPath}, but has no package.json and is outside the Explorer workspace.`,
      );
    }
  } catch (error: unknown) {
    const detail =
      error instanceof Error ? error.message : 'Unable to access the installed package.';
    await vscode.window.showErrorMessage(`Node Modules Links: ${detail}`);
  }
}

/**
 * Registers native dependency links and their navigation command.
 *
 * @param context - Extension context responsible for disposing the registrations.
 */
export function activate(context: vscode.ExtensionContext): void {
  const provider: vscode.DocumentLinkProvider = {
    provideDocumentLinks(document, token): vscode.DocumentLink[] {
      const links: vscode.DocumentLink[] = [];
      for (const dependency of scanDependencies(document.getText())) {
        if (token.isCancellationRequested) {
          return [];
        }
        const range = new vscode.Range(
          document.positionAt(dependency.offset),
          document.positionAt(dependency.offset + dependency.length),
        );
        const target = vscode.Uri.from({
          scheme: 'command',
          path: OPEN_PACKAGE_COMMAND,
          query: encodeURIComponent(JSON.stringify([document.uri.toString(), dependency.name])),
        });
        const link = new vscode.DocumentLink(range, target);
        link.tooltip = `Open "${dependency.name}" in node_modules`;
        links.push(link);
      }
      return links;
    },
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_PACKAGE_COMMAND, openPackage),
    vscode.languages.registerDocumentLinkProvider(DOCUMENT_SELECTOR, provider),
  );
}
