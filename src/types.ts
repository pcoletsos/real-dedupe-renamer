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
  rename_kept_enabled: boolean;
  show_keep_full_paths: boolean;
  include_subfolders: boolean;
  name_prefix: string;
  recent_folders: string[];
  view_mode: "simplified" | "advanced";
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
