/** File entry DTO from Rust backend. */
export interface FileEntryDto {
  path: string;
  name: string;
  folder: string;
  size: number;
  size_human: string;
  mtime: number;
  mtime_formatted: string;
}

/** A group of duplicate files. */
export interface DuplicateGroup {
  key_description: string;
  files: FileEntryDto[];
}

/** Full scan result from Rust backend. */
export interface ScanResult {
  groups: DuplicateGroup[];
  total_files_scanned: number;
  hash_skipped: number;
  scan_skipped: number;
  elapsed_seconds: number;
}

/** Candidate file DTO for auto-renamer mode. */
export interface AutoRenameCandidateDto {
  path: string;
  name: string;
  folder: string;
  extension: string;
  mtime: number;
  mtime_formatted: string;
}

/** Scan result for auto-renamer mode. */
export interface AutoRenameScanResult {
  candidates: AutoRenameCandidateDto[];
  total_files_scanned: number;
  scan_skipped: number;
  elapsed_seconds: number;
}

/** Rename action item for auto-renamer mode. */
export interface AutoRenameItem {
  from_path: string;
  to_path: string;
}

/** Error item for auto-renamer mode. */
export interface AutoRenameError {
  path: string;
  message: string;
}

/** Full rename operation result for auto-renamer mode. */
export interface AutoRenameResult {
  renamed_count: number;
  skipped_count: number;
  error_count: number;
  items: AutoRenameItem[];
  errors: AutoRenameError[];
}

export type ViewMode = "simplified" | "advanced" | "auto_renamer";
export type AutoFileTypePreset =
  | "all"
  | "images"
  | "videos"
  | "audio"
  | "documents"
  | "archives";

/** Application settings (mirrors Rust AppSettings). */
export interface AppSettings {
  folder: string;
  days: number;
  use_hash: boolean;
  use_size: boolean;
  use_name: boolean;
  use_mtime: boolean;
  hash_limit_enabled: boolean;
  hash_max_mb: number;
  skip_same_folder_prompt: boolean;
  show_keep_full_paths: boolean;
  include_subfolders: boolean;
  name_prefix: string;
  recent_folders: string[];
  view_mode: ViewMode;
  auto_file_type_preset: AutoFileTypePreset;
}

/** Parameters for the scan command. */
export interface ScanParams {
  folder: string;
  days: number;
  use_hash: boolean;
  use_size: boolean;
  use_name: boolean;
  use_mtime: boolean;
  hash_limit_enabled: boolean;
  hash_max_mb: number;
  include_subfolders: boolean;
  name_prefix: string;
}

/** Parameters for the auto-renamer scan command. */
export interface AutoRenameScanParams {
  folder: string;
  days: number;
  include_subfolders: boolean;
  name_prefix: string;
  file_type_preset: AutoFileTypePreset;
}
