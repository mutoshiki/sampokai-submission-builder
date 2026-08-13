import type { PlanInfo, ProjectInfo, ValidationIssue, ValidationTarget } from "../types";
import { validationTargets } from "./validationTargets";

const issue = (id: string, severity: ValidationIssue["severity"], title: string, detail: string, target: ValidationTarget): ValidationIssue => ({ id, severity, title, detail, target });
const missing = (fields: [string, string, ValidationTarget][]) => fields.filter(([, value]) => !value.trim());
const labels = (fields: [string, string, ValidationTarget][]) => fields.map(([label]) => label).join("、");

/** Validation for plan Word only. Errors are values the generator itself needs. */
export const validateHikingPlan = (project: ProjectInfo, plan: PlanInfo): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!project.mountainName.trim()) issues.push(issue("plan-mountain-missing", "error", "山名が未入力です", "出力フォルダ名とWord見出しに使用します。", validationTargets.project.mountainName));
  if (!project.date.trim()) issues.push(issue("plan-date-missing", "error", "実施日が未入力です", "Wordの日付に使用します。", validationTargets.project.date));
  if (!plan.routeImagePath.trim()) issues.push(issue("plan-route-image-missing", "error", "ルート画像が未選択です", "Wordへ画像を挿入します。", validationTargets.plan.routeImage));

  const projectMissing = missing([
    ["入山エリア", project.area, validationTargets.project.area], ["集合場所", project.meetingPlace, validationTargets.project.meetingPlace],
    ["集合時間", project.meetingTime, validationTargets.project.meetingTime], ["天候時の扱い", project.weatherPolicy, validationTargets.project.weatherPolicy],
  ]);
  if (projectMissing.length) issues.push(issue("plan-project-options", "warning", "基本情報に未入力があります", `${labels(projectMissing)}。空欄でWordへ反映されます。`, projectMissing[0][2]));

  const organizerMissing = missing([
    ["企画者の学籍番号", project.organizer.studentId, validationTargets.project.organizerStudentId], ["企画者氏名", project.organizer.name, validationTargets.project.organizerName], ["企画者の携帯電話番号", project.organizer.phone, validationTargets.project.organizerPhone],
  ]);
  if (organizerMissing.length) issues.push(issue("plan-organizer-options", "warning", "企画者情報に未入力があります", `${labels(organizerMissing)}。連絡先欄に空欄で反映されます。`, organizerMissing[0][2]));

  const scheduleMissing = missing([
    ["入山予定時刻", plan.entryTime, validationTargets.plan.entryTime], ["下山予定時刻", plan.exitTime, validationTargets.plan.exitTime],
    ["上り", plan.ascent, validationTargets.plan.ascent], ["下り", plan.descent, validationTargets.plan.descent], ["距離", plan.distance, validationTargets.plan.distance],
  ]);
  if (scheduleMissing.length) issues.push(issue("plan-schedule-options", "warning", "行程数値に未入力があります", `${labels(scheduleMissing)}。空欄でWordへ反映されます。`, scheduleMissing[0][2]));

  const safetyMissing = missing([
    ["エスケープ計画", plan.escapePlan, validationTargets.plan.escapePlan], ["飲料量", plan.drinkQuantity, validationTargets.plan.drinkQuantity],
    ["留守本部氏名", plan.homeBaseName, validationTargets.plan.homeBaseName], ["留守本部連絡先", plan.homeBasePhone, validationTargets.plan.homeBasePhone],
  ]);
  if (safetyMissing.length) issues.push(issue("plan-safety-options", "warning", "安全情報に未入力があります", `${labels(safetyMissing)}。空欄でWordへ反映されます。`, safetyMissing[0][2]));

  const invalidStructure = plan.itinerary.length < 2 || plan.itinerary[0]?.kind !== "Start" || plan.itinerary.at(-1)?.kind !== "Goal" || !plan.itinerary.some((point) => point.kind === "Peak");
  const incomplete = plan.itinerary.filter((point, index) => !point.name || !point.arrivalTime || (index < plan.itinerary.length - 1 && !point.travelMinutesToNext));
  if (invalidStructure || incomplete.length) {
    const detail = [invalidStructure ? "Start・Peak・Goalを設定してください" : "", incomplete.length ? `${incomplete.length}地点に地点名・到着時刻・区間時間の未入力があります` : ""].filter(Boolean).join("。") + "。";
    issues.push(issue("plan-itinerary", "warning", "行程を確認してください", detail, validationTargets.plan.itinerary));
  }
  if (!plan.policeContacts.some((contact) => contact.label && contact.phone)) issues.push(issue("plan-police-missing", "warning", "管轄連絡先が未入力です", "共通連絡先は掲載されます。必要なら警察署・山岳安全関係の名称と電話番号を追加してください。", validationTargets.plan.policeContacts));

  const exit = /^(\d{1,2}):(\d{2})$/.exec(plan.exitTime);
  if (exit && Number(exit[1]) * 60 + Number(exit[2]) > 16 * 60) issues.push(issue("late-exit-error", "warning", "下山予定時刻が16:00を過ぎています", `現在の設定は ${plan.exitTime} です。`, validationTargets.plan.exitTime));
  else if (exit && Number(exit[1]) * 60 + Number(exit[2]) > 15 * 60) issues.push(issue("late-exit", "warning", "下山予定時刻が15:00を過ぎています", `現在の設定は ${plan.exitTime} です。`, validationTargets.plan.exitTime));
  return issues;
};
