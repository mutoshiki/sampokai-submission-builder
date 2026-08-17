export type StepId = 0 | 1 | 2 | 3;
export type ProjectRole = "organizer" | "leader";

export interface ImportedTable {
  sheetName: string;
  columns: string[];
  rows: string[][];
  headerRowIndex: number;
  totalRows: number;
}

export interface ColumnMapping {
  studentId: number | null;
  name: number | null;
  nameKana: number | null;
  faculty: number | null;
  department: number | null;
  gender: number | null;
  address: number | null;
  phone: number | null;
  emergencyPhone: number | null;
}

export interface RosterRecord {
  rowId: string;
  sourceRow: number;
  studentId: string;
  name: string;
  nameKana: string;
  faculty: string;
  department: string;
  gender: string;
  address: string;
  phone: string;
  emergencyPhone: string;
}

export type ParticipantField = Exclude<keyof RosterRecord, "rowId" | "sourceRow" | "nameKana" | "department">;

export interface ResolvedParticipant {
  rosterIndex: number | null;
  addedParticipantId?: string;
  source: "handoff" | "roster";
  participant: RosterRecord;
}

/** A roster member added locally for this project, independent of source row order. */
export interface AddedParticipant {
  /** Stable matching identity: student ID when present, otherwise normalized name. */
  id: string;
  participant: RosterRecord;
}

export interface ResponseRecord {
  rowId: string;
  sourceRow: number;
  studentId: string;
  name: string;
  address: string;
}

export interface HandoffParticipant {
  studentId: string;
  name: string;
}

export type MatchStatus =
  | "exact_id"
  | "exact_name"
  | "manual"
  | "ambiguous"
  | "not_found"
  | "conflict";

export interface MatchResult {
  response: ResponseRecord;
  status: MatchStatus;
  rosterIndex: number | null;
  candidateIndices: number[];
  reason: string;
}

export interface ContactEntry {
  id: string;
  label: string;
  phone: string;
}

export type ItineraryKind = "Start" | "Waypoint" | "Peak" | "Goal";

export interface ItineraryPoint {
  id: string;
  kind: ItineraryKind;
  name: string;
  arrivalTime: string;
  restMinutes: string;
  travelMinutesToNext: string;
}

export interface OrganizerInfo {
  rosterIndex: number | null;
  studentId: string;
  name: string;
  faculty: string;
  department: string;
  phone: string;
}

export interface ProjectInfo {
  /** Optional user override for the list title. Absent in schema v1 files created before this field. */
  projectName?: string;
  mountainName: string;
  date: string;
  reserveDate: string;
  submissionDate: string;
  area: string;
  noticePlace: string;
  meetingPlace: string;
  meetingTime: string;
  weatherPolicy: string;
  organizer: OrganizerInfo;
}

export interface PlanInfo {
  entryTime: string;
  exitTime: string;
  ascent: string;
  descent: string;
  distance: string;
  itinerary: ItineraryPoint[];
  routeImagePath: string;
  escapePlan: string;
  equipment: string[];
  drinkQuantity: string;
  policeContacts: ContactEntry[];
  lodgeContacts: ContactEntry[];
  homeBaseRosterIndex: number | null;
  homeBaseName: string;
  homeBasePhone: string;
}

export type PrivacyMode = "full" | "blank-address-emergency" | "minimal";

export interface ValidationTarget {
  step: StepId;
  fieldId: string;
  tabIndex?: number;
  participant?: {
    rosterIndex: number | null;
    addedParticipantId?: string;
    rowId: string;
    field: ParticipantField;
  };
}

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  target?: ValidationTarget;
}

export interface OfficeStatus {
  available: boolean;
  applicationName: string | null;
  message: string;
}

export interface GenerationResult {
  outputDir: string;
  files: string[];
}

/** Local-only persisted editing state. Imported file contents stay in source files. */
export interface ProjectSnapshot {
  schemaVersion: number;
  id: string;
  createdAt: string;
  updatedAt: string;
  step: StepId;
  role?: ProjectRole;
  handoffPath?: string;
  rosterPath: string;
  responsePath: string;
  rosterMapping: ColumnMapping;
  responseMapping: ColumnMapping;
  manualMatches: Record<string, number | null>;
  participantOverrides: Record<number, Partial<RosterRecord>>;
  /** Optional so schema v1/v2 project files continue to load. */
  addedParticipants?: AddedParticipant[];
  selectedIds: string[];
  project: ProjectInfo;
  plan: PlanInfo;
  privacyMode: PrivacyMode;
  outputRoot: string;
}

export interface ProjectSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  mountainName: string;
  projectName: string;
  date: string;
  organizerName: string;
  participantCount: number;
  role?: ProjectRole;
}
