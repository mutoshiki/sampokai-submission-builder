import type { MatchResult, ResolvedParticipant, RosterRecord } from "../types";

/**
 * Canonical participant list for validation, review, generation, and editing.
 * Records already include persisted local participantOverrides.
 */
export const resolveSelectedParticipants = (
  selectedMatches: MatchResult[],
  roster: RosterRecord[],
): ResolvedParticipant[] => selectedMatches.flatMap((match) => {
  if (match.rosterIndex === null) return [];
  const participant = roster[match.rosterIndex];
  return participant ? [{ rosterIndex: match.rosterIndex, participant }] : [];
});
