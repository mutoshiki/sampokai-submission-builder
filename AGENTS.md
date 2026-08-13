# Release policy

Do not ask whether to publish. Do not bump the version, create a release tag, or push a release unless the user explicitly requests publication.

## Debug executable

After every completed application change, rebuild and update the latest debug executable before reporting completion. If it is running from the debug output path, close it before rebuilding. Do not publish it.

## Approved release procedure

After explicit publish approval, use current release branch. Do not require `gh` login.

1. Set identical new version in `package.json` and `src-tauri/Cargo.toml`.
2. Run relevant tests/build checks, inspect exact staged files, commit scoped changes.
3. `git push origin <current-branch>`.
4. Create matching `v<version>` tag, then `git push origin v<version>`.
5. Wait for `Release Windows app` GitHub Actions success, then verify GitHub Release/latest updater artifacts.
6. On the real Windows machine, verify the running executable's absolute path and version, plus every relevant Start Menu/Desktop shortcut target. A legacy install directory or shortcut can remain after a product-name change; the updater may install successfully but relaunch the old executable, causing repeated update prompts and old bugs to persist.

# Communication

Use the `caveman` skill at `ultra` intensity for all project communications by default.
Keep safety warnings, confirmations, and code/commit/PR text clear when ultra brevity would be unsafe.
