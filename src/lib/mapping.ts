import type {
  ColumnMapping,
  ImportedTable,
  ResponseRecord,
  RosterRecord,
} from "../types";

export const emptyMapping = (): ColumnMapping => ({
  studentId: null,
  name: null,
  nameKana: null,
  faculty: null,
  department: null,
  gender: null,
  address: null,
  phone: null,
  emergencyPhone: null,
});

const normalizeHeader = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　\n\r()（）*＊・･:：,，。]/g, "");

const scoreHeader = (header: string, field: keyof ColumnMapping) => {
  const value = normalizeHeader(header);
  const includes = (...tokens: string[]) => tokens.some((token) => value.includes(token));
  switch (field) {
    case "studentId":
      return includes("学籍番号", "学生番号", "studentid") ? 100 : includes("学籍", "学生id") ? 70 : 0;
    case "name":
      if (includes("カタカナ", "かな", "kana", "フリガナ")) return 0;
      return includes("氏名", "姓名", "fullname") ? 100 : includes("名前", "name") ? 75 : 0;
    case "nameKana":
      return includes("カタカナ", "フリガナ", "氏名かな", "namekana") ? 100 : 0;
    case "faculty":
      return includes("学部") && !includes("学部別") ? 100 : 0;
    case "department":
      return includes("学科", "課程", "コース", "department") ? 100 : 0;
    case "gender":
      return includes("身体の性別", "性別", "gender") ? 100 : 0;
    case "address":
      return includes("現住所") ? 110 : includes("住所") && !includes("実家") ? 90 : 0;
    case "phone":
      if (includes("緊急", "実家")) return 0;
      return includes("連絡先本人", "本人連絡先", "携帯電話", "電話番号") ? 100 : includes("連絡先", "電話") ? 70 : 0;
    case "emergencyPhone":
      return includes("緊急連絡先", "緊急電話") ? 100 : 0;
  }
};

export const detectMapping = (table: ImportedTable, kind: "roster" | "response") => {
  const mapping = emptyMapping();
  const fields: (keyof ColumnMapping)[] =
    kind === "response"
      ? ["studentId", "name", "address"]
      : [
          "studentId",
          "name",
          "nameKana",
          "faculty",
          "department",
          "gender",
          "address",
          "phone",
          "emergencyPhone",
        ];
  for (const field of fields) {
    let bestIndex: number | null = null;
    let bestScore = 0;
    table.columns.forEach((header, index) => {
      const score = scoreHeader(header, field);
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    });
    mapping[field] = bestIndex;
  }
  return mapping;
};

const cell = (row: string[], index: number | null) =>
  index === null ? "" : (row[index] ?? "").trim();

export const buildRosterRecords = (table: ImportedTable | null, mapping: ColumnMapping): RosterRecord[] => {
  if (!table) return [];
  return table.rows
    .map((row, index) => ({
      rowId: `roster-${index}`,
      sourceRow: table.headerRowIndex + index + 2,
      studentId: cell(row, mapping.studentId),
      name: cell(row, mapping.name),
      nameKana: cell(row, mapping.nameKana),
      faculty: cell(row, mapping.faculty),
      department: cell(row, mapping.department),
      gender: cell(row, mapping.gender),
      address: cell(row, mapping.address),
      phone: cell(row, mapping.phone),
      emergencyPhone: cell(row, mapping.emergencyPhone),
    }))
    .filter((record) => record.studentId || record.name);
};

export const buildResponseRecords = (
  table: ImportedTable | null,
  mapping: ColumnMapping,
): ResponseRecord[] => {
  if (!table) return [];
  return table.rows
    .map((row, index) => ({
      rowId: `response-${index}`,
      sourceRow: table.headerRowIndex + index + 2,
      studentId: cell(row, mapping.studentId),
      name: cell(row, mapping.name),
      address: cell(row, mapping.address),
    }))
    .filter((record) => record.studentId || record.name);
};

export const mappingLabels: { key: keyof ColumnMapping; label: string; rosterOnly?: boolean }[] = [
  { key: "studentId", label: "学籍番号" },
  { key: "name", label: "氏名" },
  { key: "nameKana", label: "氏名（カナ）", rosterOnly: true },
  { key: "faculty", label: "学部", rosterOnly: true },
  { key: "department", label: "学科・課程", rosterOnly: true },
  { key: "gender", label: "身体の性別", rosterOnly: true },
  { key: "address", label: "現住所" },
  { key: "phone", label: "本人連絡先", rosterOnly: true },
  { key: "emergencyPhone", label: "緊急連絡先", rosterOnly: true },
];
