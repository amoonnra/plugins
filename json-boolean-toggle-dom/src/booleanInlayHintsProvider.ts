import * as vscode from 'vscode';

import { scanBooleanTokens, type BooleanToken } from './booleanScanner';
import { CONFIGURATION_SECTION, ENABLED_CONFIGURATION_KEY } from './constants';

/** Cached scan result for one version of a text document. */
interface TokenCacheEntry {
  /** Version of the cached document. */
  readonly version: number;

  /** Boolean tokens found in the document. */
  readonly tokens: readonly BooleanToken[];
}

/** Provides DOM-decorated ON/OFF hints for JSON boolean literals. */
export class BooleanInlayHintsProvider implements vscode.InlayHintsProvider, vscode.Disposable {
  /** Emits invalidation notifications consumed by the VS Code editor. */
  private readonly changeEmitter = new vscode.EventEmitter<void>();

  /** Stores scan results by document URI and version. */
  private readonly cache = new Map<string, TokenCacheEntry>();

  /** Owns listeners registered by this provider. */
  private readonly disposables: vscode.Disposable[];

  /** Signals VS Code that visible hints should be recalculated. */
  public readonly onDidChangeInlayHints = this.changeEmitter.event;

  /** Creates a provider and attaches document lifecycle listeners. */
  public constructor() {
    this.disposables = [
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.invalidate(event.document.uri);
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.cache.delete(document.uri.toString());
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIGURATION_SECTION)) {
          this.refresh();
        }
      }),
    ];
  }

  /**
   * Produces hints for boolean literals in the requested editor range.
   *
   * @param document - JSON or JSONC document being rendered.
   * @param range - Visible range requested by VS Code.
   * @param cancellationToken - Cancellation signal for superseded requests.
   * @returns Inlay hints contained by the requested range.
   */
  public provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    cancellationToken: vscode.CancellationToken,
  ): vscode.InlayHint[] {
    const isEnabled = vscode.workspace
      .getConfiguration(CONFIGURATION_SECTION, document.uri)
      .get<boolean>(ENABLED_CONFIGURATION_KEY, true);

    if (!isEnabled || cancellationToken.isCancellationRequested) {
      return [];
    }

    const hints: vscode.InlayHint[] = [];

    for (const token of this.getTokens(document)) {
      if (cancellationToken.isCancellationRequested) {
        return [];
      }

      const tokenRange = new vscode.Range(
        document.positionAt(token.offset),
        document.positionAt(token.offset + token.length),
      );
      const hintPosition = document.positionAt(token.hintOffset);

      if (!range.contains(hintPosition)) {
        continue;
      }

      hints.push(this.createHint(tokenRange, hintPosition, token.value));
    }

    return hints;
  }

  /** Releases event listeners, cached data, and the change event emitter. */
  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.changeEmitter.dispose();
    this.cache.clear();
  }

  /** Clears every cached scan result and requests an inlay hint refresh. */
  public refresh(): void {
    this.cache.clear();
    this.changeEmitter.fire();
  }

  /**
   * Returns cached tokens or scans the current document version.
   *
   * @param document - Document to read and cache.
   * @returns Boolean tokens for the current document version.
   */
  private getTokens(document: vscode.TextDocument): readonly BooleanToken[] {
    const key = document.uri.toString();
    const cached = this.cache.get(key);

    if (cached?.version === document.version) {
      return cached.tokens;
    }

    const tokens = scanBooleanTokens(document.getText());
    this.cache.set(key, { version: document.version, tokens });
    return tokens;
  }

  /**
   * Builds one hint for a boolean literal.
   *
   * @param range - Exact source range occupied by the literal.
   * @param position - Position after the following comma, or after the literal.
   * @param value - Current boolean value.
   * @returns Configured inlay hint.
   */
  private createHint(
    range: vscode.Range,
    position: vscode.Position,
    value: boolean,
  ): vscode.InlayHint {
    const targetValue = !value;
    const hint = new vscode.InlayHint(position, value ? '🟢 ON' : '🔴 OFF');
    hint.paddingLeft = true;
    hint.paddingRight = true;
    hint.textEdits = [vscode.TextEdit.replace(range, String(targetValue))];
    return hint;
  }

  /**
   * Drops one document from the cache and requests a hint refresh.
   *
   * @param uri - URI of the changed document.
   */
  private invalidate(uri: vscode.Uri): void {
    this.cache.delete(uri.toString());
    this.changeEmitter.fire();
  }
}
