import type { MatchResult, ProjectInfo, ResolvedParticipant, ValidationIssue, ValidationTarget } from "../types";
import { participantFieldError, participantFieldLabel } from "./participantValidation";
import { participantValidationTarget } from "./validationTargets";

const issue = (id: string, title: string, detail: string, target?: ValidationTarget): ValidationIssue => ({ id, severity: "error", title, detail, target });

/** Validation for academic-affairs documents only. Planning data is intentionally absent. */
export const validateLeaderSubmission = (
  selectedMatches: MatchResult[],
  participants: ResolvedParticipant[],
  project: ProjectInfo,
  outputRoot: string,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!selectedMatches.length) issues.push(issue("participants-none", "参加者が選択されていません", "引継ぎ参加者を照合してください。", { step: 0, fieldId: "participant-matches" }));
  if (selectedMatches.some((match) => match.rosterIndex === null)) issues.push(issue("participants-unresolved", "未照合の参加者がいます", "曖昧一致・不一致を確認してください。", { step: 0, fieldId: "participant-matches" }));
  const indices = selectedMatches.flatMap((match) => match.rosterIndex === null ? [] : [match.rosterIndex]);
  if (indices.some((index, position) => indices.indexOf(index) !== position)) issues.push(issue("participants-duplicate", "同じ名簿メンバーが重複しています", "重複した参加者選択を解消してください。", { step: 0, fieldId: "participant-matches" }));
  for (const { participant, rosterIndex } of participants) {
    for (const field of ["studentId", "name", "faculty", "gender", "address", "phone", "emergencyPhone"] as const) {
      const error = participantFieldError(participant, field);
      if (error) issues.push(issue(`participant-${participant.rowId}-${field}`, `${participant.name || "参加者"}の${participantFieldLabel(field)}を確認してください`, error, participantValidationTarget(rosterIndex, participant.rowId, field)));
    }
  }
  const required: [string, string][] = [
    ["山名", project.mountainName], ["実施日", project.date], ["提出日", project.submissionDate], ["登山場所", project.noticePlace],
    ["企画者の学籍番号", project.organizer.studentId], ["企画者の氏名", project.organizer.name], ["企画者の学部", project.organizer.faculty], ["企画者の学科", project.organizer.department], ["企画者の電話番号", project.organizer.phone],
  ];
  const missing = required.filter(([, value]) => !value.trim()).map(([name]) => name);
  if (missing.length) issues.push(issue("submission-missing", "提出情報が不足しています", missing.join("、"), { step: 1, fieldId: "submission-info" }));
  if (!outputRoot) issues.push(issue("output-root", "出力先が未選択です", "作成するWord書類の保存先を選択してください。", { step: 2, fieldId: "output-root" }));
  if (!issues.length) issues.push({ id: "ready", severity: "info", title: "学務提出書類を作成できます", detail: "参加者名簿と登山等届の2ファイルを出力します。" });
  return issues;
};
