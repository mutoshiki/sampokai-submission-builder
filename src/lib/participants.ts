import type { AddedParticipant, MatchResult, ResolvedParticipant, RosterRecord } from "../types";
import { normalizeName, normalizeStudentId } from "./matching";

export const participantIdentity = (participant: Pick<RosterRecord, "studentId" | "name">) => {
  const studentId = normalizeStudentId(participant.studentId);
  if (studentId) return `student:${studentId}`;
  const name = normalizeName(participant.name);
  return name ? `name:${name}` : null;
};

/** Copy full roster data into project state. Never persist a source row number as identity. */
export const addedParticipantFromRoster = (participant: RosterRecord): AddedParticipant | null => {
  const id = participantIdentity(participant);
  if (!id) return null;
  return {
    id,
    participant: { ...participant, rowId: `added-${id}`, sourceRow: 0 },
  };
};

/**
 * Canonical participant list for validation, review, generation, and editing.
 * Records already include persisted local participantOverrides.
 */
export const resolveSelectedParticipants = (
  selectedMatches: MatchResult[],
  roster: RosterRecord[],
  addedParticipants: AddedParticipant[] = [],
): ResolvedParticipant[] => [
  ...selectedMatches.flatMap((match) => {
  if (match.rosterIndex === null) return [];
  const participant = roster[match.rosterIndex];
  return participant ? [{ rosterIndex: match.rosterIndex, source: "handoff" as const, participant }] : [];
}),
  ...addedParticipants.map(({ id, participant }) => ({ rosterIndex: null, addedParticipantId: id, source: "roster" as const, participant })),
];
