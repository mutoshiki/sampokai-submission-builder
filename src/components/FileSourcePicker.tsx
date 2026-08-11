import { Button, FileUploaderItem, InlineLoading } from "@carbon/react";

interface FileSourcePickerProps {
  id: string;
  label: string;
  path: string;
  loading?: boolean;
  onPick: () => void;
  onClear: () => void;
}

export function FileSourcePicker({
  id,
  label,
  path,
  loading = false,
  onPick,
  onClear,
}: FileSourcePickerProps) {
  return (
    <div className="file-source">
      <div className="file-source__label">{label}</div>
      {loading ? (
        <InlineLoading description="読み込み中" />
      ) : path ? (
        <FileUploaderItem
          name={path.split(/[\\/]/).at(-1) ?? path}
          status="edit"
          onDelete={onClear}
          size="md"
        />
      ) : (
        <Button
          id={id}
          kind="secondary"
          size="md"
          onClick={onPick}
        >
          ファイルを選択
        </Button>
      )}
    </div>
  );
}
