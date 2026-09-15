# JSON Boolean Toggle

Toggle JSON boolean values directly from clickable inlay hints while keeping the standard Visual Studio Code editor.

```json
{
  "enabled": true,
  "debug": false
}
```

The extension renders a compact control after the following comma when one is present:

```text
"enabled": true,  ⟦ 🟢 ON ⟧
"debug": false    ⟦ 🔴 OFF ⟧
```

Double-clicking the hint replaces only the boolean literal without requiring Ctrl or Cmd, so indentation, comments, trailing commas, and surrounding formatting remain unchanged.

## Features

- Framed `⟦ 🟢 ON ⟧` and `⟦ 🔴 OFF ⟧` native inlay hints after boolean values and their commas.
- Support for JSON and JSON with Comments (`jsonc`).
- Correct handling of boolean-looking text inside strings and comments.
- Safe stale-hint detection before an edit is applied.
- Native undo, redo, dirty-state, and save behavior through `WorkspaceEdit`.
- Support for untrusted and virtual workspaces.

## Requirements

- Visual Studio Code 1.85.0 or newer.
- Inlay hints must be enabled in the editor.

If hints are hidden globally, set:

```json
{
  "editor.inlayHints.enabled": "on"
}
```

## Extension Settings

| Setting                     | Default | Description                                                      |
| --------------------------- | ------- | ---------------------------------------------------------------- |
| `jsonBooleanToggle.enabled` | `true`  | Shows or hides boolean toggle hints in JSON and JSONC documents. |

## Local Development

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Open this folder in Visual Studio Code.
4. Press `F5` and open a JSON or JSONC file in the Extension Development Host.
5. Double-click an `ON` or `OFF` hint next to a boolean value.

## Quality Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run bundle
```

For a manual smoke test, press `F5`, open a JSON or JSONC file in the Extension Development Host, click both toggle states, and verify undo and redo.

## Build and Install a VSIX

```bash
npm run package
code --install-extension json-boolean-toggle-0.2.0.vsix
```

Reload Visual Studio Code after installation.

## Known Limitations

- Visual Studio Code controls the final appearance and color of inlay hints. Extensions cannot render arbitrary HTML or CSS inside the standard text editor.
- The stable Inlay Hint API uses a double-click for edits. A single-click action requires a custom editor or unsupported editor DOM modification.
- Visual Studio Code may show its built-in double-click instruction on hover when an inlay hint contains text edits. The public API cannot disable that instruction independently.
- Users can hide all inlay hints with the global `editor.inlayHints.enabled` setting.
- The extension changes the document but does not save it automatically.

## License

MIT
