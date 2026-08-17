import { describe, expect, it } from "vitest";
import { restoredProjectStep } from "./projectFlow";

describe("project role flow", () => {
  it("opens a new organizer project at Google Form participant selection", () => {
    expect(restoredProjectStep("organizer", 0, false, 0)).toBe(0);
  });

  it("keeps organizer overview projects at their overview", () => {
    expect(restoredProjectStep("organizer", 1, false, 0)).toBe(1);
  });

  it("opens a leader project only in leader submission steps", () => {
    expect(restoredProjectStep("leader", 0, false, 0)).toBe(0);
    expect(restoredProjectStep("leader", 3, false, 0)).toBe(2);
  });
});
