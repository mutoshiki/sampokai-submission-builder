import { describe, expect, it } from "vitest";
import { applyRosterOverrides } from "./mapping";
import { addedParticipantFromRoster, resolveSelectedParticipants } from "./participants";
import type { MatchResult, RosterRecord } from "../types";

const roster: RosterRecord[] = [{
  rowId: "roster-0", sourceRow: 2, studentId: "id", name: "Sample Arun", nameKana: "",
  faculty: "", department: "学科", gender: "男性", address: "住所", phone: "090", emergencyPhone: "091",
}];

const selectedMatch: MatchResult = {
  response: { rowId: "response-0", sourceRow: 2, studentId: "id", name: "Sample Arun", address: "" },
  status: "exact_id", rosterIndex: 0, candidateIndices: [0], reason: "matched",
};

describe("resolved participants", () => {
  it("uses latest persisted participant override for validation and generation input", () => {
    const resolved = resolveSelectedParticipants([selectedMatch], applyRosterOverrides(roster, { 0: { faculty: "工学部" } }));
    expect(resolved).toEqual([{ rosterIndex: 0, source: "handoff", participant: expect.objectContaining({ faculty: "工学部" }) }]);
  });

  it("persists full added roster data with stable student identity", () => {
    const added = addedParticipantFromRoster(roster[0]);
    expect(added).toEqual(expect.objectContaining({ id: "student:ID", participant: expect.objectContaining({ rowId: "added-student:ID", address: "住所" }) }));
    expect(resolveSelectedParticipants([], roster, added ? [added] : [])).toEqual([expect.objectContaining({ rosterIndex: null, addedParticipantId: "student:ID", source: "roster", participant: expect.objectContaining({ phone: "090" }) })]);
  });
});
