import { invoke } from "@tauri-apps/api/core";
import type { GenerationResult, ImportedTable, OfficeStatus, ProjectSnapshot, ProjectSummary } from "../types";

export interface DebugDefaults {
  routeImagePath: string;
  outputRoot: string;
}

export const loadTabularFile = (path: string) => invoke<ImportedTable>("load_tabular_file", { path });

export const checkOffice = () => invoke<OfficeStatus>("check_office");

export const generateDocuments = (payload: unknown, outputRoot: string) =>
  invoke<GenerationResult>("generate_documents", { payload, outputRoot });

export const openOutputFolder = (path: string) => invoke("open_output_folder", { path });

export const allowRouteImagePreview = (path: string) => invoke("allow_route_image_preview", { path });

export const getDebugDefaults = () => invoke<DebugDefaults>("debug_defaults");

export const listProjects = () => invoke<ProjectSummary[]>("list_projects");

export const loadProject = (id: string) => invoke<ProjectSnapshot>("load_project", { id });

export const saveProject = (project: ProjectSnapshot) => invoke("save_project", { project });

export const deleteProject = (id: string) => invoke("delete_project", { id });
