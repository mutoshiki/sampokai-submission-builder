import type { MatchResult, ResponseRecord, RosterRecord } from "../types";

export const normalizeStudentId = (value: string) =>
  value.normalize("NFKC").replace(/[\s　-]/g, "").toUpperCase();

export const normalizeName = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/[\s　・･.,，。]/g, "");

/** Stable key for persisted manual matching. Never use table row position as identity. */
export const responseMatchKey = (response: ResponseRecord) => {
  const studentId = normalizeStudentId(response.studentId);
  if (studentId) return `student:${studentId}`;
  return `name:${normalizeName(response.name)}`;
};

const addToIndex = (map: Map<string, number[]>, key: string, index: number) => {
  if (!key) return;
  const current = map.get(key) ?? [];
  current.push(index);
  map.set(key, current);
};

export const matchResponses = (
  responses: ResponseRecord[],
  roster: RosterRecord[],
  manualMatches: Record<string, number | null>,
): MatchResult[] => {
  const byId = new Map<string, number[]>();
  const byName = new Map<string, number[]>();
  roster.forEach((record, index) => {
    addToIndex(byId, normalizeStudentId(record.studentId), index);
    addToIndex(byName, normalizeName(record.name), index);
  });

  return responses.map((response) => {
    const manual = manualMatches[responseMatchKey(response)];
    if (typeof manual === "number" && roster[manual]) {
      return {
        response,
        status: "manual",
        rosterIndex: manual,
        candidateIndices: [manual],
        reason: "利用者が名簿の本人を確認しました。",
      };
    }

    const id = normalizeStudentId(response.studentId);
    const name = normalizeName(response.name);
    const idCandidates = id ? byId.get(id) ?? [] : [];
    const nameCandidates = name ? byName.get(name) ?? [] : [];

    if (id) {
      if (idCandidates.length === 1) {
        const rosterIndex = idCandidates[0];
        const rosterName = normalizeName(roster[rosterIndex].name);
        if (name && rosterName && name !== rosterName) {
          return {
            response,
            status: "conflict",
            rosterIndex: null,
            candidateIndices: [...new Set([...idCandidates, ...nameCandidates])],
            reason: "学籍番号と氏名が同じ名簿行を指していません。",
          };
        }
        return {
          response,
          status: "exact_id",
          rosterIndex,
          candidateIndices: idCandidates,
          reason: "一意の学籍番号が完全一致しました。",
        };
      }
      if (idCandidates.length > 1) {
        return {
          response,
          status: "ambiguous",
          rosterIndex: null,
          candidateIndices: idCandidates,
          reason: "同じ学籍番号の候補が複数あります。",
        };
      }
      return {
        response,
        status: "conflict",
        rosterIndex: null,
        candidateIndices: nameCandidates,
        reason: "回答の学籍番号が名簿にありません。氏名だけでは自動確定しません。",
      };
    }

    if (nameCandidates.length === 1) {
      return {
        response,
        status: "exact_name",
        rosterIndex: nameCandidates[0],
        candidateIndices: nameCandidates,
        reason: "空白・全角半角を正規化した氏名が一意に一致しました。",
      };
    }
    if (nameCandidates.length > 1) {
      return {
        response,
        status: "ambiguous",
        rosterIndex: null,
        candidateIndices: nameCandidates,
        reason: "同姓同名の候補が複数あります。",
      };
    }
    return {
      response,
      status: "not_found",
      rosterIndex: null,
      candidateIndices: [],
      reason: "名簿に完全一致する氏名がありません。",
    };
  });
};

export const findDuplicateResponseIds = (responses: ResponseRecord[]) => {
  const seen = new Map<string, string[]>();
  for (const response of responses) {
    const key = normalizeStudentId(response.studentId) || normalizeName(response.name);
    if (!key) continue;
    seen.set(key, [...(seen.get(key) ?? []), response.rowId]);
  }
  return new Set([...seen.values()].filter((ids) => ids.length > 1).flat());
};
