export const normalizeGenerationPayload = (payload: unknown): unknown => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;

  const root = payload as Record<string, unknown>;
  const projectValue = root.project;
  if (!projectValue || typeof projectValue !== "object" || Array.isArray(projectValue)) return payload;

  const project = projectValue as Record<string, unknown>;
  const mountainName = typeof project.mountainName === "string" ? project.mountainName.trim() : "";
  if (!mountainName) return payload;

  return {
    ...root,
    project: {
      ...project,
      noticePlace: mountainName,
    },
  };
};
