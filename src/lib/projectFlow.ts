import type { ProjectRole, StepId } from "../types";

/** Restore only a valid screen for each persisted project role. */
export const restoredProjectStep = (
  role: ProjectRole,
  savedStep: StepId,
  isEditorWindow: boolean,
  editorStep: StepId,
): StepId => {
  if (role === "leader") return Math.min(savedStep, 2) as StepId;
  if (isEditorWindow) return editorStep;
  return savedStep === 0 ? 0 : 1;
};
