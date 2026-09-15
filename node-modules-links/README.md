# Node Modules Links

Jump from dependency names in `package.json` to their installed packages in `node_modules`, with familiar IDE-style navigation inside the standard Visual Studio Code editor.

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "@types/node": "^24.0.0"
  },
  "devDependencies": {
    "typescript": "^5.9.0"
  }
}
```

Hold **Ctrl** (Windows/Linux) or **Cmd** (macOS) and click a package name, such as `react`. The extension opens the installed package's `package.json` and reveals its folder in the Explorer when the folder is inside your workspace.

## Features

- Native clickable dependency names, with a descriptive hover tooltip.
- Support for `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`.
- Scoped packages such as `@types/node` and npm aliases using their installed alias names.
- Closest-package resolution: local `node_modules` first, then parent directories for hoisted monorepo dependencies.
- npm, pnpm, and Yarn installations that provide `node_modules`, including symlinked packages.
- JSON and JSON with Comments (`jsonc`), including trailing commas.
- Resolution on every click, so installing or removing packages does not require reloading the extension.
- Windows, macOS, Linux, and remote workspaces (SSH, WSL, and Dev Containers).

## Requirements and Usage

1. Use Visual Studio Code 1.85.0 or newer.
2. Install your project's dependencies with its package manager.
3. Open a file named `package.json` in JSON or JSON with Comments language mode.
4. Ctrl+click / Cmd+click a dependency key.

VS Code must have `editor.links` enabled (the default). The click modifier follows VS Code's link gesture settings; when `editor.multiCursorModifier` is `ctrlCmd`, use **Alt+click** instead.

```json
{
  "editor.links": true
}
```

## Local Development

Use Node.js 24 or newer for the build tools. Open this extension's folder in VS Code, then run:

```bash
npm ci
npm run check
```

Press **F5** to launch the Extension Development Host. Open a project with installed dependencies and try its `package.json`.

## Build and Install a VSIX

```bash
npm run package
code --install-extension node-modules-links-0.1.0.vsix
```

Alternatively, use **Extensions: Install from VSIX...** in the Command Palette. Reload the VS Code window if prompted.

See [PUBLISHING.md](PUBLISHING.md) for Marketplace release steps.

## Limitations

- Yarn Plug'n'Play without `node_modules`, browser-only VS Code, and virtual workspaces are unsupported.
- Links are provided for dependency names even before installation. Clicking a missing dependency displays an explanatory message.
- `overrides`, `resolutions`, bundled-dependency arrays, and version strings are not linked.
- The link opens the installed manifest directly, even if the package's `exports` hides it. A package without `package.json` is revealed in the Explorer when inside the workspace.
- Hoisted packages outside the opened workspace can be opened in the editor, but cannot be revealed in that workspace's Explorer. Open the monorepo root to reveal them.
- VS Code controls link styling and the click gesture. This extension has no custom editor or settings.

## Privacy

The extension reads installed package metadata and navigates within VS Code. It does not modify documents, install dependencies, execute package code, make network requests, or collect telemetry.

## Support and License

See [SUPPORT.md](SUPPORT.md). Licensed under MIT.
