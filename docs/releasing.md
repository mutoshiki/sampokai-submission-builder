# Windows リリース手順

アプリ版番号の source of truth は root `package.json` の `version`。SemVer (`0.1.0` 形式) を更新する。`src-tauri/tauri.conf.json` はこの値を読む。`src-tauri/Cargo.toml` の版番号は Rust crate 用で、アプリ配布版番号ではない。

## 初回だけ

1. `pnpm tauri signer generate -w` を安全な作業場所で実行する。
2. 秘密鍵を GitHub repository secret `TAURI_SIGNING_PRIVATE_KEY` に登録する。パスワードを設定した場合は `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` も secret に登録する。
3. 生成された公開鍵ファイルの**内容**を GitHub repository variable `TAURI_UPDATER_PUBLIC_KEY` に登録する。
4. `src-tauri/tauri.conf.json` の `OWNER/REPO` を実際の GitHub owner/repository に置換する。workflow は release build 時に現在 repository 名で置換するが、ローカル release build を行う場合にも必要。
5. 秘密鍵ファイルをリポジトリ、`src-tauri`、ビルド成果物へ保存しない。ローカル build 時も `TAURI_SIGNING_PRIVATE_KEY` と必要なら `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` の環境変数だけで渡す。

公開鍵を設定するまで updater は配布しない。プレースホルダーは鍵ではなく、署名検証を迂回しない。

## リリース

1. `package.json` の `version` を次の SemVer に更新する。
2. Git tag `v<version>` を push する。例: version `0.2.0` なら tag `v0.2.0`。
3. GitHub Actions `Release Windows app` が Windows x64 の NSIS installer、署名済み updater artifact、`.sig`、`latest.json` を GitHub Release へ upload する。
4. Release を公開する。以後、対応版アプリは `https://github.com/OWNER/REPO/releases/latest/download/latest.json` だけへ更新確認・取得を行う。

workflow は署名鍵または公開鍵が未設定なら fail する。未署名更新を作らない。

## 更新内容

GitHub Release notes を更新内容として `latest.json` に含める。利用者へ表示されるため、個人情報、端末情報、ログを記載しない。
