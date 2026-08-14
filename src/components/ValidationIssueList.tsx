import { Button, InlineNotification, Tag } from "@carbon/react";
import type { ValidationIssue, ValidationTarget } from "../types";

interface Props {
  issues: ValidationIssue[];
  onGoToTarget: (target: ValidationTarget) => void;
}

export function ValidationIssueList({ issues, onGoToTarget }: Props) {
  if (!issues.length) return null;
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const notices = issues.filter((issue) => issue.severity === "info");
  const tagType = (severity: ValidationIssue["severity"]) => severity === "error" ? "red" : severity === "warning" ? "warm-gray" : "blue";
  const tagLabel = (severity: ValidationIssue["severity"]) => severity === "error" ? "要修正" : severity === "warning" ? "要確認" : "案内";

  return <div className="issue-list">
    {errors.length ? <InlineNotification kind="error" title={`${errors.length}件の修正が必要です`} subtitle="各項目の「修正する」から入力箇所へ移動できます。" hideCloseButton lowContrast /> : null}
    {!errors.length && warnings.length ? <InlineNotification kind="warning" title={`${warnings.length}件の確認が必要です`} subtitle="各項目を確認してから提出書類を作成してください。" hideCloseButton lowContrast /> : null}
    {!errors.length && !warnings.length ? notices.map((issue) => <InlineNotification key={issue.id} kind="info" title={issue.title} subtitle={issue.detail} hideCloseButton lowContrast />) : null}
    {(errors.length || warnings.length) ? <div className="issue-list__items">
      {[...errors, ...warnings].map((issue) => <div className="issue-item" key={issue.id}>
        <Tag type={tagType(issue.severity)}>{tagLabel(issue.severity)}</Tag>
        <div className="issue-item__content"><strong>{issue.title}</strong><span>{issue.detail}</span></div>
        {issue.target ? <Button kind="ghost" size="sm" onClick={() => onGoToTarget(issue.target!)}>修正する</Button> : null}
      </div>)}
    </div> : null}
  </div>;
}
