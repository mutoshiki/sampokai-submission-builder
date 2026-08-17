import { describe, expect, it } from "vitest";
import { findDuplicateResponseIds, matchResponses, normalizeName, responseMatchKey } from "./matching";
import type { ResponseRecord, RosterRecord } from "../types";

const roster: RosterRecord[] = [
  { rowId: "r1", sourceRow: 2, studentId: "25T0001A", name: "山田 太郎", nameKana: "", faculty: "工学部", department: "工学科", gender: "男性", address: "住所1", phone: "090-0000-0001", emergencyPhone: "090-1000-0001" },
  { rowId: "r2", sourceRow: 3, studentId: "25L0002B", name: "佐藤 花子", nameKana: "", faculty: "人文学部", department: "人文学科", gender: "女性", address: "住所2", phone: "090-0000-0002", emergencyPhone: "090-1000-0002" },
  { rowId: "r3", sourceRow: 4, studentId: "24S0003C", name: "同姓 同名", nameKana: "", faculty: "理学部", department: "理学科", gender: "男性", address: "住所3", phone: "090-0000-0003", emergencyPhone: "090-1000-0003" },
  { rowId: "r4", sourceRow: 5, studentId: "24A0004D", name: "同姓同名", nameKana: "", faculty: "農学部", department: "農学科", gender: "女性", address: "住所4", phone: "090-0000-0004", emergencyPhone: "090-1000-0004" },
];

const response = (id: string, studentId: string, name: string): ResponseRecord => ({
  rowId: id,
  sourceRow: Number(id.replace("f", "")) + 1,
  studentId,
  name,
  address: "",
});

describe("safe participant matching", () => {
  it("matches a unique student id and rejects a conflicting name", () => {
    const matches = matchResponses(
      [response("f1", "25T0001A", "山田 太郎"), response("f2", "25L0002B", "山田 太郎")],
      roster,
      {},
    );
    expect(matches[0].status).toBe("exact_id");
    expect(matches[0].rosterIndex).toBe(0);
    expect(matches[1].status).toBe("conflict");
    expect(matches[1].rosterIndex).toBeNull();
  });

  it("matches a name-only response only when normalized exact name is unique", () => {
    const matches = matchResponses(
      [response("f1", "", " 佐藤　花子 "), response("f2", "", "同姓 同名")],
      roster,
      {},
    );
    expect(matches[0].status).toBe("exact_name");
    expect(matches[0].rosterIndex).toBe(1);
    expect(matches[1].status).toBe("ambiguous");
    expect(matches[1].candidateIndices).toEqual([2, 3]);
  });

  it("never fuzzy-matches a similar but non-identical name", () => {
    const [match] = matchResponses([response("f1", "", "山田 太朗")], roster, {});
    expect(match.status).toBe("not_found");
    expect(match.rosterIndex).toBeNull();
  });

  it("persists a manual match by participant identity rather than row position", () => {
    const original = response("f7", "25T9999X", "山田 太郎");
    const manualMatches = { [responseMatchKey(original)]: 0 };
    const moved = { ...original, rowId: "f2", sourceRow: 3 };
    const [match] = matchResponses([moved], roster, manualMatches);
    expect(match.status).toBe("manual");
    expect(match.rosterIndex).toBe(0);
  });

  it("ignores legacy row-position manual matches when a different person occupies that row", () => {
    const kim = response("f7", "26J1041J", "KIM JAEYOUNG");
    const [match] = matchResponses([kim], roster, { f7: 0 });
    expect(match.status).not.toBe("manual");
    expect(match.rosterIndex).toBeNull();
  });

  it("detects duplicate answers", () => {
    const duplicates = findDuplicateResponseIds([
      response("f1", "25T0001A", "山田 太郎"),
      response("f2", "２５Ｔ０００１Ａ", "山田太郎"),
      response("f3", "25L0002B", "佐藤 花子"),
    ]);
    expect([...duplicates].sort()).toEqual(["f1", "f2"]);
  });

  it("normalizes only safe presentation differences", () => {
    expect(normalizeName("佐藤　花子")).toBe(normalizeName("佐藤 花子"));
    expect(normalizeName("佐藤 花子")).not.toBe(normalizeName("佐藤 華子"));
  });
});
