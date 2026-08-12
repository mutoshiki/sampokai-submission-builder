import type { ParticipantField, PrivacyMode, RosterRecord } from "../types";

const noticeFaculties = new Set([
  "人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部",
]);

const labels: Record<ParticipantField, string> = {
  studentId: "学籍番号",
  name: "氏名",
  faculty: "学部",
  gender: "身体の性別",
  address: "現住所",
  phone: "本人連絡先",
  emergencyPhone: "緊急連絡先",
};

export const participantValidationFields = (privacyMode: PrivacyMode): ParticipantField[] => {
  const fields: ParticipantField[] = ["studentId", "name", "faculty", "gender"];
  if (privacyMode !== "minimal") fields.push("phone");
  if (privacyMode === "full") fields.push("address", "emergencyPhone");
  return fields;
};

export const participantFieldError = (
  participant: Pick<RosterRecord, ParticipantField>,
  field: ParticipantField,
): string | undefined => {
  if (!participant[field]) return `${labels[field]}を入力してください`;
  if (field === "faculty" && !noticeFaculties.has(participant.faculty)) {
    return "登山等届にある学部を選択してください";
  }
  if (field === "gender" && !participant.gender.startsWith("男") && !participant.gender.startsWith("女")) {
    return "男子・女子のいずれかを選択してください";
  }
  return undefined;
};

export const participantFieldLabel = (field: ParticipantField) => labels[field];
