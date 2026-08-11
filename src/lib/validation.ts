import type {
  MatchResult,
  PlanInfo,
  ProjectInfo,
  RosterRecord,
  ValidationIssue,
  ValidationTarget,
} from "../types";
import { validationTargets } from "./validationTargets";

const noticeFaculties = new Set([
  "人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部",
]);

const issue = (
  id: string,
  severity: ValidationIssue["severity"],
  title: string,
  detail: string,
  target?: ValidationTarget,
): ValidationIssue => ({ id, severity, title, detail, target });

const parseTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export interface ValidationInput {
  selectedMatches: MatchResult[];
  participants: RosterRecord[];
  project: ProjectInfo;
  plan: PlanInfo;
  outputRoot: string;
  privacyMode: string;
}

export const validateProject = ({
  selectedMatches, participants, project, plan, outputRoot, privacyMode,
}: ValidationInput): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (selectedMatches.length === 0) {
    issues.push(issue("participants-none", "error", "参加者が選択されていません", "フォーム回答から今回の参加者を1人以上選択してください。", validationTargets.participants.responses));
  }
  const unresolved = selectedMatches.filter((match) => match.rosterIndex === null);
  if (unresolved.length) {
    issues.push(issue("participants-unresolved", "error", "未照合の参加者があります", `${unresolved.length}人について名簿の本人を選択してください。`, validationTargets.participants.matches));
  }
  const rosterIndices = selectedMatches.flatMap((match) => (match.rosterIndex === null ? [] : [match.rosterIndex]));
  if (rosterIndices.some((value, index) => rosterIndices.indexOf(value) !== index)) {
    issues.push(issue("participants-duplicate", "error", "同じ名簿メンバーが重複しています", "重複回答のうち、実際に参加する回答だけを選択してください。", validationTargets.participants.matches));
  }
  participants.forEach((participant, index) => {
    const missingFields: { key: string; label: string; value: string }[] = [
      { key: "student-id", label: "学籍番号", value: participant.studentId },
      { key: "name", label: "氏名", value: participant.name },
      { key: "faculty", label: "学部", value: participant.faculty },
      { key: "gender", label: "身体の性別", value: participant.gender },
    ];
    if (privacyMode !== "minimal") missingFields.push({ key: "phone", label: "本人連絡先", value: participant.phone });
    if (privacyMode === "full") {
      missingFields.push({ key: "address", label: "現住所", value: participant.address });
      missingFields.push({ key: "emergency-phone", label: "緊急連絡先", value: participant.emergencyPhone });
    }
    for (const field of missingFields) {
      if (field.value) continue;
      issues.push(issue(
        `participant-missing-${participant.rowId}-${field.key}`,
        "error",
        `${participant.name || `参加者${index + 1}`}の${field.label}が未入力です`,
        `「情報を確認」から${field.label}を入力してください。`,
        validationTargets.participants.matches,
      ));
    }
    if (participant.faculty && !noticeFaculties.has(participant.faculty)) {
      issues.push(issue(`participant-faculty-${index}`, "error", `${participant.name}の学部を登山等届へ集計できません`, "登山等届にある8学部のいずれかを「情報を確認」から選択してください。", validationTargets.participants.matches));
    }
    if (participant.gender && !participant.gender.startsWith("男") && !participant.gender.startsWith("女")) {
      issues.push(issue(`participant-gender-${index}`, "error", `${participant.name}の身体の性別を集計できません`, "登山等届の男子・女子欄へ反映する値を「情報を確認」から選択してください。", validationTargets.participants.matches));
    }
  });

  const projectFields: { label: string; value: string; target: ValidationTarget }[] = [
    { label: "山名", value: project.mountainName, target: validationTargets.project.mountainName },
    { label: "実施日", value: project.date, target: validationTargets.project.date },
    { label: "届出日", value: project.submissionDate, target: validationTargets.project.submissionDate },
    { label: "入山エリア", value: project.area, target: validationTargets.project.area },
    { label: "登山等届の場所", value: project.noticePlace, target: validationTargets.project.noticePlace },
    { label: "集合場所", value: project.meetingPlace, target: validationTargets.project.meetingPlace },
    { label: "集合時間", value: project.meetingTime, target: validationTargets.project.meetingTime },
    { label: "天候時の扱い", value: project.weatherPolicy, target: validationTargets.project.weatherPolicy },
    { label: "企画者", value: project.organizer.name, target: validationTargets.project.organizer },
    { label: "企画者の学籍番号", value: project.organizer.studentId, target: validationTargets.project.organizer },
    { label: "企画者の学部", value: project.organizer.faculty, target: validationTargets.project.organizer },
    { label: "企画者の学科・課程", value: project.organizer.department, target: validationTargets.project.organizer },
    { label: "企画者の連絡先", value: project.organizer.phone, target: validationTargets.project.organizer },
  ];
  const missingProject = projectFields.filter((field) => !field.value);
  if (missingProject.length) {
    issues.push(issue(`project-missing-${missingProject.map((field) => field.target.fieldId).join("-")}`, "error", "企画情報に未入力があります", `${missingProject.map((field) => field.label).join("、")}を入力してください。`, missingProject[0].target));
  }

  const planFields: { label: string; value: string; target: ValidationTarget }[] = [
    { label: "入山予定時刻", value: plan.entryTime, target: validationTargets.plan.entryTime },
    { label: "下山予定時刻", value: plan.exitTime, target: validationTargets.plan.exitTime },
    { label: "上り", value: plan.ascent, target: validationTargets.plan.ascent },
    { label: "下り", value: plan.descent, target: validationTargets.plan.descent },
    { label: "距離", value: plan.distance, target: validationTargets.plan.distance },
    { label: "ルート画像", value: plan.routeImagePath, target: validationTargets.plan.routeImage },
    { label: "続行不能時の対応", value: plan.escapePlan, target: validationTargets.plan.escapePlan },
    { label: "飲料量", value: plan.drinkQuantity, target: validationTargets.plan.drinkQuantity },
    { label: "留守本部氏名", value: plan.homeBaseName, target: validationTargets.plan.homeBaseName },
    { label: "留守本部連絡先", value: plan.homeBasePhone, target: validationTargets.plan.homeBasePhone },
  ];
  const missingPlan = planFields.filter((field) => !field.value);
  if (missingPlan.length) {
    issues.push(issue(`plan-missing-${missingPlan.map((field) => field.target.fieldId).join("-")}`, "error", "登山計画に未入力があります", `${missingPlan.map((field) => field.label).join("、")}を入力してください。`, missingPlan[0].target));
  }
  if (plan.itinerary.length < 2 || plan.itinerary[0]?.kind !== "Start" || plan.itinerary.at(-1)?.kind !== "Goal") {
    issues.push(issue("itinerary-ends", "error", "行程の開始・終了が不完全です", "最初をStart、最後をGoalにした2地点以上の行程を作成してください。", validationTargets.plan.itinerary));
  }
  if (!plan.itinerary.some((point) => point.kind === "Peak")) {
    issues.push(issue("itinerary-peak", "error", "Peak地点がありません", "山頂などのPeak地点を1つ以上指定してください。", validationTargets.plan.itinerary));
  }
  const incompletePoints = plan.itinerary.filter(
    (point, index) => !point.name || !point.arrivalTime || (index < plan.itinerary.length - 1 && !point.travelMinutesToNext),
  );
  if (incompletePoints.length) {
    issues.push(issue(`itinerary-incomplete-${incompletePoints.map((point) => point.id).join("-")}`, "error", "行程地点に未入力があります", "各地点の名称・到着時刻と、最後以外の区間所要時間を入力してください。", validationTargets.plan.itinerary));
  }
  if (plan.equipment.length === 0) {
    issues.push(issue("equipment-none", "error", "持参物が選択されていません", "必要な持参物を1つ以上選択してください。", validationTargets.plan.equipment));
  }
  if (!plan.policeContacts.some((contact) => contact.label && contact.phone)) {
    issues.push(issue("police-none", "error", "管轄警察署が未入力です", "警察署名と電話番号を1件以上入力してください。", validationTargets.plan.policeContacts));
  }

  const exitMinutes = parseTime(plan.exitTime);
  if (exitMinutes !== null && exitMinutes > 16 * 60) {
    issues.push(issue("late-exit-error", "warning", "下山予定時刻が16:00を過ぎています", "作り方資料では16:00を過ぎる計画をできるだけ避けるよう案内されています。計画を再確認してください。", validationTargets.plan.exitTime));
  } else if (exitMinutes !== null && exitMinutes > 15 * 60) {
    issues.push(issue("late-exit", "warning", "下山予定時刻が15:00を過ぎています", "日帰り登山では15:00前後の下山が望ましいとされています。", validationTargets.plan.exitTime));
  }
  if (!outputRoot) {
    issues.push(issue("output-root", "error", "出力先が選択されていません", "書類を保存する親フォルダを選択してください。", validationTargets.review.outputRoot));
  }
  if (!issues.some((item) => item.severity === "error")) {
    issues.push(issue("ready", "info", "必須項目の検証が完了しました", "元ファイルを変更せず、新しい企画フォルダへ4ファイルを生成します。"));
  }
  return issues;
};
