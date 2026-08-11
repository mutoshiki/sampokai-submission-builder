import { convertFileSrc } from "@tauri-apps/api/core";
import { Button, FileUploaderItem } from "@carbon/react";

interface RouteImageUploaderProps {
  path: string;
  onPick: () => void;
  onClear: () => void;
}

export function RouteImageUploader({ path, onPick, onClear }: RouteImageUploaderProps) {
  const preview = path && (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ? convertFileSrc(path) : "";
  return (
    <div className="route-uploader">
      <h3>ルート画像</h3>
      <p>YAMAP等の地図スクリーンショットを選択するか、この画面へドラッグ＆ドロップしてください。</p>
      {path ? (
        <>
          <FileUploaderItem name={path.split(/[\\/]/).at(-1) ?? path} status="edit" onDelete={onClear} size="md" />
          {preview ? <img className="route-preview" src={preview} alt="選択したルート画像のプレビュー" /> : null}
        </>
      ) : (
        <Button
          id="route-image"
          kind="secondary"
          size="md"
          onClick={onPick}
        >
          画像を選択
        </Button>
      )}
      <div className="drop-help">対応形式: PNG / JPEG / BMP</div>
    </div>
  );
}
