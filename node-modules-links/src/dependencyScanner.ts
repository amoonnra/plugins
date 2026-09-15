import { parseTree } from 'jsonc-parser';

import { isPackageName } from './packageResolver';

/** Root-level manifest sections containing dependency names. */
const DEPENDENCY_SECTIONS = new Set([
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]);

/** Dependency key and its source range, excluding quotation marks. */
export interface DependencyToken {
  /** Name used for the installed directory, including scopes or npm aliases. */
  readonly name: string;
  /** Zero-based offset of the first character inside the key's quotes. */
  readonly offset: number;
  /** Source length, preserving any JSON escape sequences. */
  readonly length: number;
}

/**
 * Reads dependency keys from the JSONC syntax tree without matching nested objects or comments.
 *
 * @param text - Complete manifest source, which may contain comments or trailing commas.
 * @returns Complete, valid package-name keys in root-level dependency objects.
 */
export function scanDependencies(text: string): readonly DependencyToken[] {
  const root = parseTree(text);
  if (root?.type !== 'object') {
    return [];
  }

  const dependencies: DependencyToken[] = [];
  for (const property of root.children ?? []) {
    const section: unknown = property.children?.[0]?.value;
    const object = property.children?.[1];
    if (
      typeof section !== 'string' ||
      !DEPENDENCY_SECTIONS.has(section) ||
      object?.type !== 'object'
    ) {
      continue;
    }

    for (const dependency of object.children ?? []) {
      const key = dependency.children?.[0];
      const value = dependency.children?.[1];
      const name: unknown = key?.value;
      if (
        key?.type !== 'string' ||
        value?.type !== 'string' ||
        typeof name !== 'string' ||
        !isPackageName(name) ||
        text[key.offset + key.length - 1] !== '"'
      ) {
        continue;
      }

      dependencies.push({ name, offset: key.offset + 1, length: key.length - 2 });
    }
  }
  return dependencies;
}
