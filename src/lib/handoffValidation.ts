import type { ResponseRecord, ValidationIssue, ValidationTarget } from "../types";

const target = (rowId: string): ValidationTarget => ({ step: 0, fieldId: `handoff-participant-${rowId}` });

/** Validation owned only by selected participants' handoff matching keys. */
export const validateHandoff = (participants: ResponseRecord[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!participants.length) {
    issues.push({ id: "handoff-participants", severity: "error", title: "参加者を選択してください", detail: "引継ぎ対象がありません。", target: { step: 0, fieldId: "participant-selection" } });
    return issues;
  }

  participants.filter((person) => !person.studentId.trim() && !person.name.trim()).forEach((person) => {
    issues.push({ id: `handoff-identifiers-${person.rowId}`, severity: "error", title: `回答 ${person.sourceRow} 行目：学籍番号・氏名がありません`, detail: "照合できないため、選択解除するか回答ファイルを修正して読み込み直してください。", target: target(person.rowId) });
  });

  const byStudentId = new Map<string, ResponseRecord[]>();
  participants.filter((person) => person.studentId.trim()).forEach((person) => {
    const id = person.studentId.trim();
    byStudentId.set(id, [...(byStudentId.get(id) ?? []), person]);
  });
  byStudentId.forEach((people, studentId) => {
    if (people.length < 2) return;
    const names = people.map((person) => person.name || `回答 ${person.sourceRow} 行目`).join("、");
    issues.push({ id: `handoff-duplicate-student-id-${studentId}`, severity: "error", title: `学籍番号 ${studentId} が重複しています`, detail: `${names}。今回参加する回答だけを選択してください。`, target: target(people[0].rowId) });
  });

  return issues;
};
