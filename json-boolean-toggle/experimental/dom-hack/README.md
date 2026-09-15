# Experimental Single-Click DOM Toggle

This unsupported Windows-only patch changes the Visual Studio Code renderer so JSON Boolean Toggle hints look like pill-shaped UI controls and react to a normal left click.

## How It Works

The extension still creates native `InlayHint.textEdits`. The renderer bridge identifies only `🟢 ON` and `🔴 OFF` inlay hint spans, renders a balanced pill with a smaller state dot, blocks editor caret, selection, and hover handling inside the control, and converts every primary pointer press into exactly one Visual Studio Code inlay-hint edit gesture.

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
- Pointer interaction is intentionally captured inside the decorated control, so clicking it does not reposition the editor caret.
- Hover events are intentionally captured inside the control, and the related hover widget is hidden so Visual Studio Code does not show its inlay-hint tooltip.
- The patch is not suitable for the Visual Studio Marketplace and is excluded from the VSIX.
- The installer targets the current per-user Windows installation reported by `code --version`.
- If Visual Studio Code changes the inlay hint gesture or renderer markup, single-click conversion may stop working.

The installer creates `workbench.html.json-boolean-toggle.bak` before the first modification and the uninstaller restores it.
