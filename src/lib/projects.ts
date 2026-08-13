import type { ProjectRole, ProjectSnapshot } from "../types";

export const PROJECT_SCHEMA_VERSION = 2;

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

/** v1 projects predate roles and remain leader projects after upgrade. */
export const projectRole = (snapshot: Pick<ProjectSnapshot, "role">): ProjectRole => snapshot.role ?? "leader";
