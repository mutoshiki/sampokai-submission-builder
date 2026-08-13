import { Channel, invoke } from "@tauri-apps/api/core";
import type { GenerationResult, HandoffParticipant, ImportedTable, OfficeStatus, ProjectSnapshot, ProjectSummary } from "../types";

export interface SampleDataDefaults {
  rosterPath: string;
  responsePath: string;
  routeImagePath: string;
}

export const loadTabularFile = (path: string) => invoke<ImportedTable>("load_tabular_file", { path });

export const checkOffice = () => invoke<OfficeStatus>("check_office");

interface GenerationEvent {
  event: "progress";
  data: { stage: string };
}

export const generateDocuments = (payload: unknown, outputRoot: string, onProgress: (stage: string) => void) => {
  const onEvent = new Channel<GenerationEvent>((message) => {
    if (message.event === "progress") onProgress(message.data.stage);
  });
  return invoke<GenerationResult>("generate_documents", { payload, outputRoot, onEvent });
};

export const openOutputFolder = (path: string) => invoke("open_output_folder", { path });

export const allowRouteImagePreview = (path: string) => invoke("allow_route_image_preview", { path });

export const getSampleDataDefaults = () => invoke<SampleDataDefaults>("sample_data_defaults");

export const listProjects = () => invoke<ProjectSummary[]>("list_projects");

export const loadProject = (id: string) => invoke<ProjectSnapshot>("load_project", { id });

export const saveProject = (project: ProjectSnapshot) => invoke("save_project", { project });

export const deleteProject = (id: string) => invoke("delete_project", { id });

export const writeParticipantCsv = (path: string, participants: HandoffParticipant[]) => invoke("write_participant_csv", { path, participants });
