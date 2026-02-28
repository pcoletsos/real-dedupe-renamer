import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  AutoRenameResult,
  AutoRenameScanParams,
  AutoRenameScanResult,
  RenameSchema,
  ScanParams,
  ScanResult,
} from "./types";

/** Scan a folder for duplicate files. */
export async function scan(params: ScanParams): Promise<ScanResult> {
  return invoke("cmd_scan", { ...params });
}

/** Scan a folder for auto-renamer candidates. */
export async function scanAutoRename(
  params: AutoRenameScanParams,
): Promise<AutoRenameScanResult> {
  return invoke("cmd_scan_auto_rename", { ...params });
}

/** Rename files using the provided schema. */
export async function autoRename(
  paths: string[],
  renameSchema: RenameSchema,
): Promise<AutoRenameResult> {
  return invoke("cmd_auto_rename", { paths, rename_schema: renameSchema });
}

/** Delete files (move to trash). */
export async function deleteFiles(paths: string[]): Promise<number> {
  return invoke("cmd_delete", { paths });
}

/** Load settings from disk. */
export async function getSettings(): Promise<AppSettings> {
  return invoke("cmd_get_settings");
}

/** Save settings to disk. */
export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("cmd_save_settings", { settings });
}

/** Get the default downloads folder path. */
export async function getDefaultFolder(): Promise<string> {
  return invoke("cmd_get_default_folder");
}

/** Open a folder in the system file manager. */
export async function openFolder(path: string): Promise<void> {
  return invoke("cmd_open_folder", { path });
}
