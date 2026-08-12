import type { ParticipantField, ValidationTarget } from "../types";

export const participantEditorFieldId = (rowId: string, field: ParticipantField) =>
  `participant-${rowId}-${field}`;

export const participantValidationTarget = (
  rosterIndex: number,
  rowId: string,
  field: ParticipantField,
): ValidationTarget => ({
  step: 0,
  fieldId: participantEditorFieldId(rowId, field),
  participant: { rosterIndex, rowId, field },
});

export const validationTargets = {
  participants: {
    roster: { step: 0, fieldId: "roster-file" },
    responses: { step: 0, fieldId: "response-file" },
    matches: { step: 0, fieldId: "participant-matches" },
  },
  project: {
    mountainName: { step: 1, fieldId: "mountain-name" },
    date: { step: 1, fieldId: "event-date" },
    submissionDate: { step: 1, fieldId: "submission-date" },
    area: { step: 1, fieldId: "area" },
    noticePlace: { step: 1, fieldId: "notice-place" },
    meetingPlace: { step: 1, fieldId: "meeting-place" },
    meetingTime: { step: 1, fieldId: "meeting-time" },
    weatherPolicy: { step: 1, fieldId: "weather-policy" },
    organizer: { step: 1, fieldId: "organizer" },
  },
  plan: {
    entryTime: { step: 2, fieldId: "entry-time", tabIndex: 0 },
    exitTime: { step: 2, fieldId: "exit-time", tabIndex: 0 },
    ascent: { step: 2, fieldId: "ascent", tabIndex: 0 },
    descent: { step: 2, fieldId: "descent", tabIndex: 0 },
    distance: { step: 2, fieldId: "distance", tabIndex: 0 },
    itinerary: { step: 2, fieldId: "itinerary-editor", tabIndex: 0 },
    routeImage: { step: 2, fieldId: "route-image", tabIndex: 1 },
    escapePlan: { step: 2, fieldId: "escape-plan", tabIndex: 1 },
    equipment: { step: 2, fieldId: "equipment-grid", tabIndex: 2 },
    drinkQuantity: { step: 2, fieldId: "drink-quantity", tabIndex: 2 },
    policeContacts: { step: 2, fieldId: "police-contacts", tabIndex: 2 },
    homeBaseName: { step: 2, fieldId: "home-base-name", tabIndex: 2 },
    homeBasePhone: { step: 2, fieldId: "home-base-phone", tabIndex: 2 },
  },
  review: {
    outputRoot: { step: 3, fieldId: "output-root" },
  },
} as const satisfies Record<string, Record<string, ValidationTarget> | ValidationTarget>;
