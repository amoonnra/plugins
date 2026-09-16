# Publishing Dependency Version Check

The manifest uses this repository's publisher, `ivandvoeglazov`, and repository, `amoonnra/plugins`. Extension ID: `ivandvoeglazov.dependency-version-check`.

## Release

1. Verify publishing access in the [Marketplace publisher portal](https://marketplace.visualstudio.com/manage/publishers/) and check the repository / issue URLs.
2. For subsequent releases, update `package.json`, `CHANGELOG.md`, and the VSIX filename in `README.md`.
3. With Node.js 24 or newer, run `npm ci`, `npm run check`, and `npm run package`.
4. Inspect `npx vsce ls --no-dependencies`. The VSIX should contain the manifest, bundled extension, icon, README, changelog, support and license notices; it must not contain `node_modules`, source maps, secrets or development files.
5. Install the generated VSIX in a clean VS Code profile and complete the manual checks below.
6. Keep only the latest VSIX in the extension directory, then commit and push it with the reviewed extension files and `.github/workflows/dependency-version-check.yml` so the public links resolve.
7. Follow the current [official VS Code authentication and publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension). Publish using `npm run publish` with your configured credentials. For Microsoft Entra ID where configured, use `npm run publish -- --azure-credential`.

Never commit publishing credentials. Local packaging and the CI workflow do not publish to Marketplace. This repository has no automatic public release step.

`jsonc-parser`, `semver` and `yaml` are bundled by esbuild; their license texts are included. `yaml` is used to interpret pnpm workspace membership and exclusions without an ad hoc YAML parser. The generated icon is `images/icon.png`; its prompt and style references are recorded in `images/ICON-PROMPT.md`.

## Download a GitHub Actions build

The latest VSIX is committed alongside the extension source and can be downloaded directly from its GitHub file page with **Download raw file**.

The [Dependency Version Check workflow](https://github.com/amoonnra/plugins/actions/workflows/dependency-version-check.yml) runs when extension files or its workflow are pushed / changed in a pull request. It installs the locked development dependencies, runs the checks, builds the current version's VSIX and uploads it as **dependency-version-check-vsix**. The artifact contains the package generated from that run's source revision.

On GitHub, open **Actions → Dependency Version Check**, select the successful run and download **dependency-version-check-vsix** under **Artifacts**. Extract the ZIP and install its `.vsix` using **Extensions: Install from VSIX...** in VS Code. You must be signed in to GitHub to download the artifact, and it is retained according to the repository's artifact retention settings.

To rebuild without another commit, open the workflow page, click **Run workflow**, select the branch and confirm **Run workflow**. This manual trigger is available after the workflow has been pushed to the default branch. Each run packages the version in `package.json`; this does not publish to the VS Code Marketplace or create a GitHub release.

## Manual verification

- Declare an exact version, compatible `^` / `~` range, incompatible version and absent package. Verify warnings and the required / installed values in hover and Problems.
- Edit and save the manifest, try temporarily invalid JSON, undo / redo, remove a dependency and verify diagnostics update without reloading.
- Verify ordinary / scoped dependencies, npm aliases, prereleases, optional dependencies and optional peers.
- Install / remove packages externally and verify fallback refresh clears / adds warnings. Repeat with a hoisted package and a pnpm symlink.
- Open a multi-root workspace and a parent folder with independent projects. Open a source file in one project and verify the notification / installation refer only to that project. Switch projects before clicking an older install action and verify it is refused.
- In npm / Yarn / Bun workspaces and a pnpm monorepo, verify the task stays in the active package directory and the workspace-selection / nonrecursive arguments match the README. Check Yarn Classic root handling and custom scripts.
- Switch Git branches with different manifests, including a nested repository and a linked worktree. Test Git-disabled VS Code and excluded filesystem events: fallback refresh should still work.
- Switch to a source file and verify the compact colored notification. Try Later and the native close button: neither should install dependencies or disable warnings. Switch projects and back, temporarily invalidate a manifest, and verify unchanged problems stay suppressed. Change an issue, resolve and reintroduce an issue, and reload the window; verify notifications can appear again.
- Leave project A's notification unanswered, then switch to source files in projects B and C of the same monorepo. Verify each affected project can notify independently, returning to A does not duplicate its pending notification, and closing A's notification does not suppress B or C. Repeat after the first toast hides itself and with multi-root workspace folders. A project with no issues should not notify.
- Close a notification, change a dependency requirement, return to a source file and verify it can notify again while problems remain. Also change a compatible dependency while another dependency's warning stays identical; formatting-only edits should not reset suppression. Leave an older notification unanswered while changing requirements, then close / click Install on the older notification: it must not suppress the new snapshot or run an outdated action.
- Switch branches with identical dependency declarations after closing a notification; verify remaining issues notify again for each affected package when activated. Keep another independent / nested repository unchanged and verify its dismissal remains effective. Miss a HEAD watcher event and verify polling detects the changed contents. A branch with no dependency problems must not notify.
- Click a hover action and Quick Fix. Verify only the target project's dirty manifest is saved, terminal output appears and checks refresh after completion. Try a nested / excluded project and an invalid nearest manifest: installation must not fall through to its parent.
- Click Install from a notification / hover after moving focus away from the text editor. Verify the active text / diff tab still supplies the correct project. On Windows, verify different drive / directory casing between a document and its action URI does not block installation; try a dirty manifest too.
- Configure `installCommand` to run a project script. Try a failing command and a missing package manager; verify failure feedback and that a retry is possible.
- Open an untrusted workspace. Diagnostics should work, installation should be blocked.
- Confirm behavior on Windows, macOS, Linux, and a remote host before claiming support based on a published manual run.

No automated tests are included, as requested. Compilation and packaging do not verify the interactive Extension Host behavior.
