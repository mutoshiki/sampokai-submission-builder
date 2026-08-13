import { Button, InlineNotification } from "@carbon/react";
import type { ValidationIssue, ValidationTarget } from "../types";

interface Props {
  issues: ValidationIssue[];
  onGoToTarget: (target: ValidationTarget) => void;
}

export function ValidationIssueList({ issues, onGoToTarget }: Props) {
  if (!issues.length) return null;
  return <div className="issue-list">
    {issues.map((issue) => <div className="issue-item" key={issue.id}>
      <InlineNotification kind={issue.severity} title={issue.title} subtitle={issue.detail} hideCloseButton lowContrast />
      {issue.target ? <Button kind="ghost" size="sm" onClick={() => onGoToTarget(issue.target!)}>修正する</Button> : null}
    </div>)}
  </div>;
}
