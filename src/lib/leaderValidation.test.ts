import { describe, expect, it } from "vitest";
import { validateLeaderSubmission } from "./leaderValidation";
import type { ProjectInfo, ResolvedParticipant, RosterRecord } from "../types";

const participant: RosterRecord = {
  rowId: "added-student:25T0001A", sourceRow: 0, studentId: "25T0001A", name: "山田 太郎", nameKana: "ヤマダ タロウ",
  faculty: "工学部", department: "工学科", gender: "男性", address: "松本市", phone: "090-0000-0001", emergencyPhone: "090-1000-0001",
};
const project: ProjectInfo = {
  mountainName: "燕岳", date: "2026-10-18", reserveDate: "", submissionDate: "2026-10-01", area: "", noticePlace: "", meetingPlace: "", meetingTime: "", weatherPolicy: "",
  organizer: { rosterIndex: null, studentId: "25T0002A", name: "企画者", faculty: "工学部", department: "工学科", phone: "090-0000-0002" },
};
const added: ResolvedParticipant = { rosterIndex: null, addedParticipantId: "student:25T0001A", source: "roster", participant };

describe("leader submission validation", () => {
  it("treats roster-added members as final participants", () => {
    const issues = validateLeaderSubmission([], [added], project, "C:\\output");
    expect(issues.find((issue) => issue.id === "participants-none")).toBeUndefined();
    expect(issues.find((issue) => issue.id === "participants-duplicate")).toBeUndefined();
  });

  it("does not require a separate hiking notice place", () => {
    const issues = validateLeaderSubmission([], [added], project, "C:\\output");
    expect(issues.find((issue) => issue.id === "submission-missing")).toBeUndefined();
  });

  it("rejects duplicate final participants across sources", () => {
    const issues = validateLeaderSubmission([], [added, { ...added, source: "handoff", rosterIndex: 0 }], project, "C:\\output");
    expect(issues.find((issue) => issue.id === "participants-duplicate")).toBeDefined();
  });

  it("uses corrected roster faculty and department for a selected organizer", () => {
    const incompleteOrganizer: ProjectInfo = {
      ...project,
      organizer: { ...project.organizer, rosterIndex: 0, faculty: "", department: "" },
    };
    const issues = validateLeaderSubmission([], [], incompleteOrganizer, "C:\\output", [{ ...participant, studentId: incompleteOrganizer.organizer.studentId, name: incompleteOrganizer.organizer.name, phone: incompleteOrganizer.organizer.phone }]);
    expect(issues.find((issue) => issue.id === "submission-missing")).toBeUndefined();
  });
});
