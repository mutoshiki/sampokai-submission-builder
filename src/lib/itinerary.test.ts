import { describe, expect, it } from "vitest";
import { buildItineraryText, durationBetween } from "./itinerary";

describe("itinerary formatter", () => {
  it("formats Start, Peak, Goal, travel and rest without invented data", () => {
    const text = buildItineraryText([
      { id: "1", kind: "Start", name: "登山口", arrivalTime: "08:00", restMinutes: "0", travelMinutesToNext: "90" },
      { id: "2", kind: "Peak", name: "山頂", arrivalTime: "09:30", restMinutes: "30", travelMinutesToNext: "60" },
      { id: "3", kind: "Goal", name: "登山口", arrivalTime: "11:00", restMinutes: "0", travelMinutesToNext: "" },
    ]);
    expect(text).toContain("Ⓢ登山口 08:00⇒（1時間30分）⇒");
    expect(text).toContain("Ⓟ山頂 09:30～（休憩30分）⇒（1時間）⇒");
    expect(text).toContain("Ⓖ登山口 11:00");
  });

  it("calculates same-day duration", () => {
    expect(durationBetween("08:30", "14:44")).toBe("6時間14分");
    expect(durationBetween("16:00", "08:00")).toBe("");
  });
});
