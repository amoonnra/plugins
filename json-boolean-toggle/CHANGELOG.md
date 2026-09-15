# Changelog

All notable changes to JSON Boolean Toggle are documented in this file.

## Unreleased

- Restored the taller pill frame while keeping immediate pointer-press edits and the hidden native hover widget.
- Normalized emoji-circle clicks to the rendered ON/OFF text bounds for a consistent Monaco hit target.

## 0.1.3

- Added a source-only, reversible Windows DOM hack for pill styling and normal single-click toggling.
- Made the experimental toggle consume pointer and selection events so every single click toggles once without moving the editor caret.
- Prevented hover-time inlay hint replacement and removed the toggle tooltip.

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
