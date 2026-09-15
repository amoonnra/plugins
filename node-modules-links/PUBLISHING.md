# Publishing Guide

The extension is configured as `ivandvoeglazov.node-modules-links`, using the publisher and GitHub repository already used by this repository's other extensions.

## Publisher Setup

1. Confirm that you have publishing access to `ivandvoeglazov` in the [Marketplace publisher portal](https://marketplace.visualstudio.com/manage/publishers/).
2. Confirm the public repository, homepage, and issue URLs in `package.json`.
3. Follow the current [official authentication and publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension). Use Microsoft Entra ID authentication where configured; never commit publishing credentials.

## Release Checklist

1. Update `package.json`, the VSIX filename in `README.md`, and `CHANGELOG.md` for subsequent releases.
2. Run `npm ci` with Node.js 24 or newer.
3. Run `npm run check`.
4. Run `npm run package`.
5. Inspect the actual archive contents with `npx vsce ls --no-dependencies`.
6. Install the VSIX in a clean VS Code profile and perform the manual checks below.
7. Commit and push the reviewed source and icon so the public repository links resolve.
8. Publish with `npm run publish` using configured authentication. For Microsoft Entra ID, run `npm run publish -- --azure-credential`.

The package command uses esbuild to include `jsonc-parser` in `dist/extension.js`; VSIX packaging excludes `node_modules`, source files, credentials, development configuration, and source maps. `package-lock.json` stays in Git for reproducible installs.

The generated Marketplace icon is `images/icon.png`. It must remain a square PNG at least 128 × 128 pixels. Its generation prompt is recorded in `images/ICON-PROMPT.md`.

## Manual Verification

- Try ordinary and scoped packages in all four dependency sections.
- Try a package installed only in a parent `node_modules` and verify that a nearer installed copy takes precedence.
- Try a pnpm or workspace symlink and an npm alias.
- Confirm that clicking opens the installed manifest and reveals the installed folder when inside the workspace.
- Try JSONC comments and trailing commas; package-like strings outside dependency sections must not become links.
- Remove a package, click its link, reinstall it, and click again without reloading.
- Confirm the gesture on your operating system and with `editor.multiCursorModifier` if customized.

No automated tests are included. Marketplace publication is a separate release action; building a local VSIX does not publish the extension.
