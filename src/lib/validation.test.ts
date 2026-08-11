import { describe, expect, it } from "vitest";
import { validateProject } from "./validation";
import type { MatchResult, PlanInfo, ProjectInfo, RosterRecord } from "../types";

const participant = (faculty: string): RosterRecord => ({
  rowId: "roster-0", sourceRow: 2, studentId: "25T0001A", name: "山田 太郎", nameKana: "",
  faculty, department: "工学科", gender: "男性", address: "住所", phone: "090-0000-0001", emergencyPhone: "090-0000-0002",
});

const selectedMatch: MatchResult = {
  response: { rowId: "response-0", sourceRow: 2, studentId: "25T0001A", name: "山田 太郎", address: "" },
  status: "exact_id", rosterIndex: 0, candidateIndices: [0], reason: "matched",
};

const project: ProjectInfo = {
  mountainName: "山", date: "2026-10-18", reserveDate: "", submissionDate: "2026-10-01", area: "エリア",
  noticePlace: "場所", meetingPlace: "集合", meetingTime: "07:00", weatherPolicy: "中止",
  organizer: { rosterIndex: null, studentId: "id", name: "企画者", faculty: "工学部", department: "学科", phone: "090" },
};

const plan: PlanInfo = {
  entryTime: "07:00", exitTime: "14:00", ascent: "500", descent: "500", distance: "8", routeImagePath: "route.png",
  escapePlan: "引き返す", equipment: ["雨具"], drinkQuantity: "2L",
  itinerary: [
    { id: "start", kind: "Start", name: "登山口", arrivalTime: "07:00", restMinutes: "0", travelMinutesToNext: "90" },
    { id: "peak", kind: "Peak", name: "山頂", arrivalTime: "08:30", restMinutes: "0", travelMinutesToNext: "90" },
    { id: "goal", kind: "Goal", name: "登山口", arrivalTime: "10:00", restMinutes: "0", travelMinutesToNext: "" },
  ],
  policeContacts: [{ id: "police", label: "警察", phone: "026" }],
  lodgeContacts: [], homeBaseRosterIndex: null, homeBaseName: "留守", homeBasePhone: "090",
};

describe("participant validation", () => {
  it("removes only the faculty issue after faculty is corrected", () => {
    const validationInput = {
      selectedMatches: [selectedMatch], project, plan, outputRoot: "C:/output", privacyMode: "full",
    };
    const before = validateProject({ ...validationInput, participants: [participant("")] });
    const after = validateProject({ ...validationInput, participants: [participant("工学部")] });

    expect(before.map((entry) => entry.id)).toContain("participant-missing-roster-0-faculty");
    expect(after.map((entry) => entry.id)).not.toContain("participant-missing-roster-0-faculty");
  });
});
