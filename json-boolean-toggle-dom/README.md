# JSON Boolean Toggle DOM

Toggle JSON boolean values with colorful pill controls rendered inside the standard Visual Studio Code text editor.

```text
"enabled": true,   🟢 ON
"debug": false,   🔴 OFF
```

> **Warning:** This is an experimental extension. It modifies the installed Visual Studio Code workbench because the public extension API cannot render arbitrary DOM controls inside the standard editor.

## Features

- Immediate single-press toggling for JSON and JSON with Comments (`jsonc`).
- Colorful pill controls with no inlay-hint hover popup.
- Native undo, redo, dirty-state, and save behavior.
- A reversible patch with a backup of the original workbench HTML.
- Installer support for Windows, macOS, and Linux desktop builds.

## Install the Experimental UI

1. Install the VSIX.
2. Disable the standard **JSON Boolean Toggle** extension if it is installed. Enabling both extensions produces duplicate hints.
3. Open the Command Palette.
4. Run `JSON Boolean Toggle DOM: Install Experimental UI`.
5. Review and accept the warning.
6. Reload every Visual Studio Code window.

The extension uses the application root reported by Visual Studio Code, so the same command supports per-user, system, portable, macOS app bundle, and common Linux installations.

On macOS or Linux, a system installation may not be writable by the current user. If that happens, choose **Copy Privileged Command**, run the copied command in a terminal, and reload Visual Studio Code.

## Restore the Original Workbench

Before uninstalling the extension, run:

```text
JSON Boolean Toggle DOM: Restore VS Code Workbench
```

Then reload every Visual Studio Code window. If elevated permissions are required, the extension can copy the corresponding restore command.

## Requirements

- Visual Studio Code 1.85.0 or newer on Windows, macOS, or Linux.
- A desktop installation with a writable workbench, or permission to run the provided privileged helper.
- Inlay hints enabled with `editor.inlayHints.enabled` set to `on` or `onUnlessPressed`.

## Settings

| Setting                        | Default | Description                                              |
| ------------------------------ | ------- | -------------------------------------------------------- |
| `jsonBooleanToggleDom.enabled` | `true`  | Shows or hides DOM-compatible hints in JSON/JSONC files. |

## Important Limitations

- Visual Studio Code may report that its installation is corrupt after the patch is installed.
- Every Visual Studio Code update replaces the patched workbench. Run the install command again after an update.
- The private workbench DOM and file layout can change without notice.
- The extension does not support browser-hosted VS Code, Codespaces in the browser, or other products with no local application root.
- The patch is applied to the current local Visual Studio Code product. Stable, Insiders, and compatible forks maintain separate installations.
- Uninstalling the extension does not automatically restore the workbench. Run the restore command first.

## Local Development

```bash
npm install
npm run check
npm run package
```

Install `json-boolean-toggle-dom-0.1.0.vsix`, run the install command, and reload the window.

## License

MIT
