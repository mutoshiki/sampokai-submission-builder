import type { ProjectRole } from "../types";

/** Fixed roles for project-list entry actions. Keep UI labels from swapping workflows. */
export const projectEntryRoles: Record<"organizer" | "leader", ProjectRole> = {
  organizer: "organizer",
  leader: "leader",
};
