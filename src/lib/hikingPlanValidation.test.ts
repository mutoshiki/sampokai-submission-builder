import { describe, expect, it } from "vitest";
import { validateHikingPlan } from "./hikingPlanValidation";
import type { PlanInfo, ProjectInfo } from "../types";

const project: ProjectInfo = { mountainName: "山", date: "2026-10-01", reserveDate: "", submissionDate: "", area: "エリア", noticePlace: "場所", meetingPlace: "集合", meetingTime: "06:00", weatherPolicy: "雨天中止", organizer: { rosterIndex: null, studentId: "25A1", name: "企画者", faculty: "", department: "", phone: "090" } };
const plan: PlanInfo = { entryTime: "07:00", exitTime: "16:30", ascent: "500", descent: "500", distance: "8", itinerary: [{ id: "start", kind: "Start", name: "登山口", arrivalTime: "07:00", restMinutes: "0", travelMinutesToNext: "120" }, { id: "peak", kind: "Peak", name: "山頂", arrivalTime: "09:00", restMinutes: "20", travelMinutesToNext: "100" }, { id: "goal", kind: "Goal", name: "登山口", arrivalTime: "11:00", restMinutes: "0", travelMinutesToNext: "" }], routeImagePath: "route.png", escapePlan: "下山", equipment: ["雨具"], drinkQuantity: "2L", policeContacts: [{ id: "p", label: "警察", phone: "026" }], lodgeContacts: [], homeBaseRosterIndex: null, homeBaseName: "留守", homeBasePhone: "080" };

describe("hiking-plan validation", () => {
  it("allows export with warnings when no errors exist", () => {
    const issues = validateHikingPlan(project, plan);
    expect(issues.some((issue) => issue.severity === "warning")).toBe(true);
    expect(issues.some((issue) => issue.severity === "error")).toBe(false);
  });

  it("does not block blank Word markers that the generator can write", () => {
    const issues = validateHikingPlan(
      { ...project, area: "", meetingPlace: "", meetingTime: "", weatherPolicy: "", organizer: { ...project.organizer, studentId: "", name: "", phone: "" } },
      { ...plan, entryTime: "", exitTime: "", ascent: "", descent: "", distance: "", escapePlan: "", drinkQuantity: "", homeBaseName: "", homeBasePhone: "", itinerary: [], policeContacts: [] },
    );
    expect(issues.some((issue) => issue.severity === "error")).toBe(false);
    expect(issues.some((issue) => issue.severity === "warning")).toBe(true);
  });
});
