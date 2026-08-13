import { Button, InlineLoading, InlineNotification, Tile } from "@carbon/react";
import { Document, FolderOpen } from "@carbon/icons-react";
import type { ValidationIssue, ValidationTarget } from "../types";
import { ValidationIssueList } from "./ValidationIssueList";

interface Props {
  exporting: boolean; error: string; path: string; canExport: boolean; onExport: () => void; issues: ValidationIssue[];
  onGoToTarget: (target: ValidationTarget) => void; onOpenOutput: () => void; outputOpenError: string;
}

export function HandoffStep({ exporting, error, path, canExport, onExport, issues, onGoToTarget, onOpenOutput, outputOpenError }: Props) {
  return <section aria-labelledby="plan-output-heading">
    <div className="page-heading"><h1 id="plan-output-heading">登山計画書出力</h1></div>
    <Tile className="handoff-tile">
      <Button renderIcon={Document} onClick={onExport} disabled={!canExport || exporting}>登山計画書Wordを書き出す</Button>
      {exporting ? <InlineLoading description="登山計画書Wordを書き出し中" /> : null}
      {error ? <InlineNotification kind="error" title="登山計画書Wordを書き出せませんでした" subtitle={error} hideCloseButton lowContrast /> : null}
      {path ? <div className="success-result"><InlineNotification kind="success" title="書き出しました" subtitle={path} hideCloseButton lowContrast /><Button kind="tertiary" size="sm" renderIcon={FolderOpen} onClick={onOpenOutput}>フォルダを開く</Button></div> : null}
      {outputOpenError ? <InlineNotification kind="error" title="フォルダを開けませんでした" subtitle={outputOpenError} hideCloseButton lowContrast /> : null}
    </Tile>
    <ValidationIssueList issues={issues} onGoToTarget={onGoToTarget} />
  </section>;
}
