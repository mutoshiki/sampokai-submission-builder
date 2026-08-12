import { describe, expect, it } from "vitest";
import { defaultProjectName, duplicateProjectSnapshot } from "./projects";
import type { ProjectSnapshot } from "../types";

const source = {
  schemaVersion: 1,
  id: "source",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  step: 0,
  rosterPath: "",
  responsePath: "",
  rosterMapping: {},
  responseMapping: {},
  manualMatches: {},
  participantOverrides: {},
  selectedIds: [],
  project: { mountainName: "蓼科山", organizer: {} },
  plan: {},
  privacyMode: "full",
  outputRoot: "",
} as unknown as ProjectSnapshot;

describe("project display names", () => {
  it("derives a default title from mountain name", () => {
    expect(defaultProjectName("蓼科山")).toBe("蓼科山企画");
    expect(defaultProjectName("")).toBe("無題の企画");
  });

  it("duplicates default and custom names using のコピー", () => {
    expect(duplicateProjectSnapshot(source, "2026-02-01T00:00:00.000Z", "00000000-0000-4000-8000-000000000001").project.projectName).toBe("蓼科山企画のコピー");
    expect(duplicateProjectSnapshot({ ...source, project: { ...source.project, projectName: "夏山合宿" } }, "2026-02-01T00:00:00.000Z", "00000000-0000-4000-8000-000000000002").project.projectName).toBe("夏山合宿のコピー");
  });
});
