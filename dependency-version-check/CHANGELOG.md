# Changelog

## 0.1.4

- Re-notify on declared dependency requirement changes, including when the warning list itself stays identical.
- Detect Git HEAD content changes during watcher-triggered and fallback refreshes; reset notification snapshots only for projects in the affected repository / worktree.
- Allow a new dependency / branch snapshot to notify while an older notification is pending, without duplicate notifications for unchanged snapshots.
- Ignore outdated notification actions and prevent older dismissal from suppressing newer changes.

## 0.1.3

- Track unanswered notifications per project instead of blocking all projects behind one notification.
- Allow affected monorepo packages and multi-root workspace folders to notify when switching active files while another project's notification is pending.
- Preserve per-project dismissal, duplicate suppression and stale installation action protection.

## 0.1.2

- Fix false project mismatch on Windows when dependency action URIs use different drive / path casing.
- Resolve the active file from its text / diff tab when clicking an action temporarily leaves no active text editor.
- Apply resource normalization to project caches, workspace membership, dirty manifest lookup and installation task tracking.
- Keep stale-action protection and report missing active files, missing manifests and actual project mismatches separately.

## 0.1.1

- Compact colored dependency hover cards, shorter diagnostic messages and a highlighted status bar with project summaries.
- Notifications now describe only the active file's project, with Install, Open package.json and Later actions.
- Native closing / Later defer unchanged issues separately for each project within the current window session.
- Removed installation across all projects. Commands target the nearest manifest of the active file, including projects outside discovery exclusions.
- Guard against stale actions after editor changes and use project-scoped workspace installation commands.

## 0.1.0

- Initial release with dependency version warnings, hover installation actions and Quick Fix.
- Recursive multi-project discovery, parent / hoisted node_modules resolution and configurable optional / peer checks.
- Live manifest checks, Git HEAD watchers, installation fallback refresh and notifications outside package.json.
- Package manager detection, monorepo installation roots, custom task commands and workspace trust protection.
