import type { ResponseRecord } from "../types";

export const participantCsvExtension = "csv";

/**
 * Handoff intentionally contains only selected participants' matching keys.
 * Planning/submission fields belong to independent document-generation flows.
 */
export const toHandoffParticipants = (participants: ResponseRecord[]) => participants.map(({ studentId, name }) => ({ studentId, name }));
