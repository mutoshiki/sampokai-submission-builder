import type { ParticipantField, ValidationTarget } from "../types";

export const participantEditorFieldId = (rowId: string, field: ParticipantField) =>
  `participant-${rowId}-${field}`;

export const participantValidationTarget = (
  rosterIndex: number | null,
  rowId: string,
  field: ParticipantField,
  addedParticipantId?: string,
): ValidationTarget => ({
  step: 0,
  fieldId: participantEditorFieldId(rowId, field),
  participant: { rosterIndex, rowId, field, addedParticipantId },
});

export const validationTargets = {
  participants: {
    roster: { step: 0, fieldId: "roster-file" },
    responses: { step: 0, fieldId: "response-file" },
    matches: { step: 0, fieldId: "participant-matches" },
  },
  project: {
    mountainName: { step: 2, fieldId: "mountain-name" },
    date: { step: 2, fieldId: "event-date" },
    submissionDate: { step: 2, fieldId: "submission-date" },
    area: { step: 2, fieldId: "area" },
    noticePlace: { step: 2, fieldId: "notice-place" },
    meetingPlace: { step: 2, fieldId: "meeting-place" },
    meetingTime: { step: 2, fieldId: "meeting-time" },
    weatherPolicy: { step: 2, fieldId: "weather-policy" },
    organizer: { step: 2, fieldId: "organizer" },
    organizerStudentId: { step: 2, fieldId: "organizer-student-id" },
    organizerName: { step: 2, fieldId: "organizer-name" },
    organizerPhone: { step: 2, fieldId: "organizer-phone" },
  },
  plan: {
    entryTime: { step: 3, fieldId: "entry-time", tabIndex: 0 },
    exitTime: { step: 3, fieldId: "exit-time", tabIndex: 0 },
    ascent: { step: 3, fieldId: "ascent", tabIndex: 0 },
    descent: { step: 3, fieldId: "descent", tabIndex: 0 },
    distance: { step: 3, fieldId: "distance", tabIndex: 0 },
    itinerary: { step: 3, fieldId: "itinerary-editor", tabIndex: 0 },
    routeImage: { step: 3, fieldId: "route-image", tabIndex: 1 },
    escapePlan: { step: 3, fieldId: "escape-plan", tabIndex: 1 },
    equipment: { step: 3, fieldId: "equipment-grid", tabIndex: 2 },
    drinkQuantity: { step: 3, fieldId: "drink-quantity", tabIndex: 2 },
    policeContacts: { step: 3, fieldId: "police-contacts", tabIndex: 2 },
    homeBaseName: { step: 3, fieldId: "home-base-name", tabIndex: 2 },
    homeBasePhone: { step: 3, fieldId: "home-base-phone", tabIndex: 2 },
  },
  review: {
    outputRoot: { step: 3, fieldId: "output-root" },
  },
} as const satisfies Record<string, Record<string, ValidationTarget> | ValidationTarget>;
