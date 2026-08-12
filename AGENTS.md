# Release reporting

After every completed change, explicitly ask whether to publish an application update.
Do not bump the version, create a release tag, or push a release unless the user explicitly confirms.

## Approved release procedure

After explicit publish approval, use current release branch. Do not require `gh` login.

1. Set identical new version in `package.json` and `src-tauri/Cargo.toml`.
2. Run relevant tests/build checks, inspect exact staged files, commit scoped changes.
3. `git push origin <current-branch>`.
4. Create matching `v<version>` tag, then `git push origin v<version>`.
5. Wait for `Release Windows app` GitHub Actions success, then verify GitHub Release/latest updater artifacts.

# Communication

Use the `caveman` skill at `ultra` intensity for all project communications by default.
Keep safety warnings, confirmations, and code/commit/PR text clear when ultra brevity would be unsafe.
