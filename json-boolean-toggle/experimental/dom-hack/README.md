# Experimental Single-Click DOM Toggle

This unsupported Windows-only patch changes the Visual Studio Code renderer so JSON Boolean Toggle hints look like pill-shaped UI controls and react to a normal left click.

## How It Works

The extension still creates native `InlayHint.textEdits`. The renderer bridge identifies only `🟢 ON` and `🔴 OFF` inlay hint spans, adds component styling, and converts one trusted left-button release into Visual Studio Code's native double-click gesture.

It does not parse or edit JSON in the renderer. Visual Studio Code remains responsible for applying the extension-provided text edit.

## Install

Run from the extension source directory:

```powershell
npm run dom-hack:install
```

Then close every Visual Studio Code window and start Visual Studio Code again.

## Uninstall

```powershell
npm run dom-hack:uninstall
```

Close every Visual Studio Code window and start it again.

## Risks and Limitations

- Visual Studio Code may report that the installation is corrupt because `workbench.html` changes.
- A Visual Studio Code update replaces the patched files. Run the installer again after an update.
- The DOM structure is private and can change without notice.
- The patch is not suitable for the Visual Studio Marketplace and is excluded from the VSIX.
- The installer targets the current per-user Windows installation reported by `code --version`.
- If Visual Studio Code changes the inlay hint gesture or renderer markup, single-click conversion may stop working.

The installer creates `workbench.html.json-boolean-toggle.bak` before the first modification and the uninstaller restores it.
