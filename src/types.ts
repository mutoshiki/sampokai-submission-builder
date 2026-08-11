export type StepId = 0 | 1 | 2 | 3;

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

export interface ResponseRecord {
  rowId: string;
  sourceRow: number;
  studentId: string;
  name: string;
  address: string;
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
