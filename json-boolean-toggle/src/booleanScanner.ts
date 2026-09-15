import { createScanner, SyntaxKind } from 'jsonc-parser';

/** Describes the source location and value of a JSON boolean literal. */
export interface BooleanToken {
  /** Zero-based character offset of the literal. */
  readonly offset: number;

  /** Character length of the literal. */
  readonly length: number;

  /** Parsed boolean value. */
  readonly value: boolean;

  /** Offset where the inlay hint should be rendered. */
  readonly hintOffset: number;
}

/** Boolean token waiting for its following JSON token to determine hint placement. */
type PendingBooleanToken = Omit<BooleanToken, 'hintOffset'>;

/**
 * Finds boolean literals without treating strings or comments as executable values.
 *
 * The JSONC scanner intentionally tolerates incomplete documents so hints can remain
 * available while a user is editing a file.
 *
 * @param text - Complete JSON or JSONC document text.
 * @returns Boolean tokens in document order.
 */
export function scanBooleanTokens(text: string): readonly BooleanToken[] {
  const scanner = createScanner(text, true);
  const tokens: BooleanToken[] = [];
  let pendingToken: PendingBooleanToken | undefined;

  for (let kind = scanner.scan(); kind !== SyntaxKind.EOF; kind = scanner.scan()) {
    if (pendingToken !== undefined) {
      tokens.push({
        ...pendingToken,
        hintOffset:
          kind === SyntaxKind.CommaToken
            ? scanner.getTokenOffset() + scanner.getTokenLength()
            : pendingToken.offset + pendingToken.length,
      });
      pendingToken = undefined;
    }

    if (kind !== SyntaxKind.TrueKeyword && kind !== SyntaxKind.FalseKeyword) {
      continue;
    }

    pendingToken = {
      offset: scanner.getTokenOffset(),
      length: scanner.getTokenLength(),
      value: kind === SyntaxKind.TrueKeyword,
    };
  }

  if (pendingToken !== undefined) {
    tokens.push({
      ...pendingToken,
      hintOffset: pendingToken.offset + pendingToken.length,
    });
  }

  return tokens;
}
