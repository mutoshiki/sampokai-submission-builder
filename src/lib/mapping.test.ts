import { describe, expect, it } from "vitest";
import {
  applyRosterOverrides,
  buildResponseRecords,
  buildRosterRecords,
  changedRosterFields,
  detectMapping,
} from "./mapping";
import type { ImportedTable, RosterRecord } from "../types";

describe("flexible column mapping", () => {
  it("detects long Google Forms roster headers", () => {
    const table: ImportedTable = {
      sheetName: "回答",
      headerRowIndex: 0,
      totalRows: 1,
      columns: [
        "学籍番号* 半角、大文字で入力してください。",
        "氏名（漢字 or Alphabet） フルネームで入力してください。",
        "身体の性別",
        "現住所 都道府県より記入してください。",
        "連絡先（本人）",
        "緊急連絡先",
        "学部",
        "学科・コース（正式名称）",
      ],
      rows: [["25T0001A", "山田 太郎", "男性", "住所", "090", "080", "工学部", "工学科"]],
    };
    const mapping = detectMapping(table, "roster");
    expect(mapping.studentId).toBe(0);
    expect(mapping.name).toBe(1);
    expect(mapping.gender).toBe(2);
    expect(mapping.address).toBe(3);
    expect(mapping.phone).toBe(4);
    expect(mapping.emergencyPhone).toBe(5);
    expect(buildRosterRecords(table, mapping)[0].faculty).toBe("工学部");
  });

  it("supports a name-only form export", () => {
    const table: ImportedTable = {
      sheetName: "フォームの回答 1",
      headerRowIndex: 0,
      totalRows: 2,
      columns: ["タイムスタンプ", "お名前を入力してください"],
      rows: [["2026/1/1", "山田 太郎"], ["2026/1/2", "佐藤 花子"]],
    };
    const mapping = detectMapping(table, "response");
    expect(mapping.studentId).toBeNull();
    expect(mapping.name).toBe(1);
    expect(buildResponseRecords(table, mapping)).toHaveLength(2);
  });

  it("refreshes untouched fields after a mapping correction", () => {
    const incomplete: RosterRecord = {
      rowId: "roster-0", sourceRow: 2, studentId: "s1", name: "Name", nameKana: "",
      faculty: "", department: "", gender: "male", address: "address", phone: "old-phone", emergencyPhone: "emergency",
    };
    const edited = { ...incomplete, phone: "manual-phone" };
    const overrides = { 0: changedRosterFields(incomplete, edited) };
    const corrected = { ...incomplete, faculty: "Engineering", department: "Computer Science" };

    expect(applyRosterOverrides([corrected], overrides)[0]).toMatchObject({
      faculty: "Engineering",
      department: "Computer Science",
      phone: "manual-phone",
    });
  });
});
