import { describe, expect, it } from "vitest";
import { validateHandoff } from "./handoffValidation";

describe("handoff validation", () => {
  it("requires only selected participant matching data", () => {
    const issues = validateHandoff([{ rowId: "r", sourceRow: 1, studentId: "25B2", name: "参加者", address: "" }]);
    expect(issues.some((issue) => issue.severity === "error")).toBe(false);
  });

  it("blocks an unidentifiable selected participant", () => {
    const issues = validateHandoff([{ rowId: "r", sourceRow: 1, studentId: "", name: "", address: "" }]);
    expect(issues.some((issue) => issue.id.startsWith("handoff-identifiers-"))).toBe(true);
  });
});
