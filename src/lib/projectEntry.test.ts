import { describe, expect, it } from "vitest";
import { projectEntryRoles } from "./projectEntry";

describe("project entry roles", () => {
  it("keeps organizer and leader entry roles fixed", () => {
    expect(projectEntryRoles.organizer).toBe("organizer");
    expect(projectEntryRoles.leader).toBe("leader");
  });
});
