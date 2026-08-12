import type { ProjectSnapshot } from "../types";

export const PROJECT_SCHEMA_VERSION = 1;

export const createProjectId = () => crypto.randomUUID();

export const defaultProjectName = (mountainName: string) => mountainName.trim() ? `${mountainName.trim()}企画` : "無題の企画";

export function duplicateProjectSnapshot(source: ProjectSnapshot, now: string, id = createProjectId()): ProjectSnapshot {
  const projectName = source.project.projectName?.trim() || defaultProjectName(source.project.mountainName);
  return {
    ...structuredClone(source),
    id,
    createdAt: now,
    updatedAt: now,
    project: {
      ...source.project,
      projectName: `${projectName}のコピー`,
    },
  };
}
