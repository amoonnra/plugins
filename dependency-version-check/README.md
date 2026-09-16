# Dependency Version Check

WebStorm-style dependency warnings in the standard VS Code editor: compare the requirements in `package.json` with packages actually installed in `node_modules`.

## Features

- Yellow warning squiggles on dependency version values when packages are missing or incompatible.
- Compact hover cards with colored status markers, highlighted required / installed versions and one **Install dependencies** action for the active file's project.
- Native Quick Fix, Problems panel, and a status bar counter with project navigation.
- Project-specific notifications show missing / incompatible counts with **Install**, **Open package.json** and **Later** actions outside `package.json`. Dismissal is remembered separately for each project for the current window session.
- Live checks while editing `package.json`, including unsaved changes, with a 300 ms debounce. Invalid/incomplete JSON is temporarily skipped.
- File watchers for manifests and lockfiles, direct Git `HEAD` watchers for branch changes, including nested repositories and linked worktrees, and refresh when the window regains focus.
- A fallback refresh every 15 seconds while the window is focused catches installations, removals and branch changes missed by filesystem watchers.
- Recursive discovery in a single project, multi-root `.code-workspace`, or a parent folder containing independent projects. Installation runs only in the project owning the active file; other discovered projects are checked but are not installed together.
- Hoisted parent `node_modules`, scoped packages, npm aliases, pnpm / workspace symlinks, and JSONC comments / trailing commas.
- npm, pnpm, Yarn and Bun installation commands, with an optional custom installation script.

`"react": "^19.0.0"` accepts installed `19.1.0`, but warns for `18.3.1`. This compares against your declared requirements, **not** the latest registry release and **not** the exact version pinned in a lockfile.

## Install and use

Requires VS Code 1.85.0 or newer and a Node.js project using `node_modules`.

1. Install `dependency-version-check-0.1.4.vsix` using **Extensions: Install from VSIX...** in the Command Palette.
2. Open your project, multi-root workspace, or the parent folder containing projects.
3. Open `package.json` and hover a highlighted dependency version.
4. Click **Install dependencies**, or use the notification's **Install** action outside the manifest.

Installation runs as one visible VS Code task from the directory containing the nearest `package.json` above the active file. Automatic detection uses `packageManager`, then lockfiles, then npm; a recognised workspace owner can supply package-manager metadata, but the task stays in the active project's directory. There is no install-all-projects action. If an old hover or notification belongs to a different project after you switch editors, its install action is refused.

The active text / diff tab supplies the file when an action temporarily moves focus away from the text editor. Resource comparisons follow Windows path casing rules, so different URI spellings for the same file do not block installation or bypass saving its dirty manifest. A missing file selection, a missing manifest and an action for a genuinely different project produce distinct messages.

Installation saves only the target project's dirty manifest before running the command. Dependencies are never installed automatically; installation requires a trusted workspace. The selected package manager and its lifecycle scripts run with the normal permissions of your task terminal. An install can change `node_modules` and lockfiles; it does not run `npm update` or rewrite version requirements to newer releases.

## Notification actions and closing

The notification describes only the project owning your active source file, for example **📦 frontend · 🔴 2 missing · 🟠 1 incompatible**.

Switching to another project's source file can show that project's notification even if a previous project's notification is still awaiting a response. An unchanged dependency / branch snapshot is shown once. New requirements or a branch switch can show a new notification even while an older notification is unanswered; actions from an outdated snapshot are ignored. Install also refuses to run in a different active project.

| Action                        | Result                                                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Install**                   | Closes the notification and installs all declared dependencies of this project. It does not start tasks for other projects. Switching to a different project before installation starts prevents the old action from running. |
| **Open package.json**         | Closes the notification and opens the displayed project's manifest at its first warning. No dependencies are installed.                                                                                                       |
| **Later** or the native **×** | Closes the notification without changing files, running commands, disabling checks or cancelling an already running installation task.                                                                                        |

Unchanged requirements and problems remain suppressed separately for each project when you switch between files / projects or a manifest is temporarily invalid during editing. Changing any declared dependency requirement allows another notification if problems remain, including when the existing warning list stays the same. A Git HEAD change allows another notification for the affected repository's projects, even if both branches declare identical dependency versions. HEAD contents are also compared during fallback refresh, so missed filesystem events can still reset suppression. Nested repositories and linked worktrees retain their own scope.

Closing an older notification does not suppress newer dependency or branch changes. A resolved issue that reappears can notify again too. While `package.json` is active, diagnostics / hover update; the popup appears after returning to a source file in that project. The suppression is kept in memory and resets when the VS Code window reloads. Warning squiggles and the status bar remain available after closing. To turn off popups persistently, set `dependencyVersionCheck.notifications` to `false`.

The native close button is handled as dismissal by the [VS Code notification API](https://code.visualstudio.com/api/references/vscode-api#window.showWarningMessage). Notification colors and placement follow your VS Code theme.

## Installation commands

Standalone projects use their detected manager's `install` command; pnpm additionally disables recursive installation. For recognised workspaces, built-in commands select the active project:

| Manager      | Workspace behavior                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm          | Members use `install --workspace <active-project-path>`; the root uses `install --workspaces=false`.                                                    |
| pnpm         | `install --config.recursive-install=false` disables the default installation of every workspace member.                                                 |
| Yarn modern  | `workspaces focus` selects the active workspace and the workspaces it depends on. The command / required plugin must be available in your Yarn version. |
| Yarn Classic | Members use `install --focus`; focusing the root is unsupported and requires a custom installation script.                                              |
| Bun          | `install --filter <active-package-name>` selects the active package. A valid package name is required in a workspace.                                   |

Project-scoped installation can still update shared workspace lockfiles / hoisted dependency storage and install transitive dependencies. These are package-manager behaviors, not separate installation tasks for other projects. See the official [npm workspace options](https://docs.npmjs.com/cli/install/), [pnpm installation](https://pnpm.io/cli/install), [Yarn focus](https://yarnpkg.com/cli/workspaces/focus), and [Bun filtering](https://bun.com/docs/pm/cli/install).

To run your own script, put this in workspace or folder settings:

```json
{
  "dependencyVersionCheck.installCommand": "npm run deps:install"
}
```

The custom command runs from the active project's directory, exactly as configured; it overrides built-in workspace-selection arguments. Use a project-scoped script if you want to preserve this scope. Set `dependencyVersionCheck.packageManager` when automatic detection is unsuitable or several lockfiles exist. The selected manager must be available in the task terminal's PATH; the extension does not install package managers.

## Settings

| Setting                                            | Default                                                           | Purpose                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `dependencyVersionCheck.enabled`                   | `true`                                                            | Enable diagnostics and project discovery.                                                    |
| `dependencyVersionCheck.notifications`             | `true`                                                            | Show notifications outside `package.json`.                                                   |
| `dependencyVersionCheck.pollIntervalSeconds`       | `15`                                                              | Fallback interval, from 5 to 300 seconds.                                                    |
| `dependencyVersionCheck.exclude`                   | `**/{node_modules,.git,.yarn,.pnpm-store,dist,build,coverage}/**` | Exclude generated / dependency directories from discovery.                                   |
| `dependencyVersionCheck.checkPeerDependencies`     | `true`                                                            | Check peer dependencies. Missing optional peers are ignored.                                 |
| `dependencyVersionCheck.checkOptionalDependencies` | `false`                                                           | Warn when optional dependencies are missing. Installed optional versions are always checked. |
| `dependencyVersionCheck.packageManager`            | `auto`                                                            | Choose `auto`, `npm`, `pnpm`, `yarn` or `bun`.                                               |
| `dependencyVersionCheck.installCommand`            | empty                                                             | Custom command in the active project; empty uses a project-scoped manager command.           |

The last four settings can be configured per folder in a multi-root workspace. `node_modules` manifests are always excluded. Explicitly opened project manifests and the active file's nearest manifest are checked even outside workspace roots or discovery exclusions. An invalid nearest manifest prevents installation; it does not redirect the action to an enclosing project.

Command Palette actions start with **Dependency Version Check:** and include **Refresh All Projects**, **Install / Update Active Project Dependencies**, and **Show Affected Projects**. The status bar and project picker show problems throughout the workspace; opening a manifest changes the active installation target to that project.

## Development and packaging

Use Node.js 24 or newer for development tools:

```bash
npm ci
npm run check
npm run package
```

Open this extension folder and press **F5** to launch the Extension Development Host. The GitHub Actions workflow checks and packages this extension without publishing it. See [PUBLISHING.md](PUBLISHING.md) for the release process and manual verification checklist. No automated tests are included.

Download CI builds from [Actions → Dependency Version Check](https://github.com/amoonnra/plugins/actions/workflows/dependency-version-check.yml): open a successful run, download **dependency-version-check-vsix** from **Artifacts**, extract the ZIP and install the `.vsix`. The workflow also supports **Run workflow** for a manual rebuild.

## Limits and privacy

- npm semver ranges are compared locally, including prerelease semantics. npm aliases verify the underlying installed package name and range. Numeric `workspace:` ranges are checked too.
- Registry tags such as `latest`, Git / URL / tarball / local-file references and `workspace:*`, `workspace:^`, `workspace:~` are checked for presence only: an installed semantic version cannot establish that these sources match. No registry queries are made.
- Yarn Plug'n'Play without `node_modules`, browser-only VS Code and virtual workspaces are unsupported.
- `overrides`, `resolutions`, lockfile consistency and intentional production-only installations are not interpreted. Missing dev dependencies warn; optional dependency absence is configurable. This is not a full package-manager dependency solver.
- Workspace membership includes positive and negative package globs. pnpm roots require an ancestor manifest alongside `pnpm-workspace.yaml` with explicit `packages` patterns. Unusual nested workspace arrangements and advanced package-manager-specific glob syntax may require a custom installation command.
- VS Code controls warning colors, notification placement and hover action rendering. Hover actions are clickable links, not custom HTML buttons; the editor UI is not patched.
- Large parent folders cost more to scan. Exclude fixture / archive directories and increase the fallback interval as needed. File-read failures are reported by error category in the **Dependency Version Check** output channel.
- Checks read manifests and installed package metadata. There is no telemetry, automatic network access, or execution of package code during checks. Network access happens only through a package manager or custom command you explicitly start.

MIT licensed. See [SUPPORT.md](SUPPORT.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
