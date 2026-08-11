import { invoke } from "@tauri-apps/api/core";
import type { GenerationResult, ImportedTable, OfficeStatus } from "../types";

export interface DebugDefaults {
  routeImagePath: string;
  outputRoot: string;
}

export const loadTabularFile = (path: string) => invoke<ImportedTable>("load_tabular_file", { path });

export const checkOffice = () => invoke<OfficeStatus>("check_office");

export const generateDocuments = (payload: unknown, outputRoot: string) =>
  invoke<GenerationResult>("generate_documents", { payload, outputRoot });

export const allowRouteImagePreview = (path: string) => invoke("allow_route_image_preview", { path });

export const getDebugDefaults = () => invoke<DebugDefaults>("debug_defaults");
