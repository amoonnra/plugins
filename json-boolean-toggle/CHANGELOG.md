# Changelog

All notable changes to JSON Boolean Toggle are documented in this file.

## Unreleased

## 0.2.0

- Added a balanced Unicode frame to the Marketplace-safe native inlay hints.
- Removed the extension-provided hover tooltip while retaining native double-click editing.

## 0.1.3

- Removed the extension-provided hover tooltip.

## 0.1.2

- Moved each hint after the following comma when present.
- Replaced command links with native double-click text edits that do not require Ctrl or Cmd.
- Added colorful green and red state indicators.

## 0.1.1

- Fixed extension activation by bundling the ESM build of `jsonc-parser`.

## 0.1.0

- Added clickable ON/OFF inlay hints for JSON and JSONC boolean literals.
- Added safe literal replacement with stale-document protection.
- Added development launch configuration and quality checks.
- Added Marketplace metadata, icon, and VSIX packaging scripts.
