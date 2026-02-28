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
  size: number;
  mtime: number;
  mtime_formatted: string;
  created: number; // Unix seconds; 0 if unavailable
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

/** Progress event emitted during scanning / hashing. */
export interface ScanProgress {
  phase: "scanning" | "hashing";
  current: number;
  total: number;
  message: string;
}

export type Theme = "light" | "dark" | "system";
export type ViewMode = "simplified" | "advanced" | "auto_renamer";
export type AutoFileTypePreset =
  | "all"
  | "images"
  | "videos"
  | "audio"
  | "documents"
  | "archives";

// ---------------------------------------------------------------------------
// Rename component schema
// ---------------------------------------------------------------------------

export type RenameComponentKind =
  | "folder_name"
  | "date_created"
  | "date_modified"
  | "time_created"
  | "time_modified"
  | "sequence"
  | "original_stem"
  | "literal";

/** A single component in the rename schema (with a client-side `id` for React keys). */
export interface RenameComponent {
  /** Client-only key for React lists — not sent to Rust. */
  id: string;
  kind: RenameComponentKind;
  /** Used when kind === "literal". */
  value?: string;
  /** Used when kind === "sequence". */
  pad_width?: number;
}

/** The rename schema sent to the Rust backend. */
export interface RenameSchema {
  components: RenameComponent[];
  separator: string;
}

export const DEFAULT_RENAME_COMPONENTS: RenameComponent[] = [
  { id: "1", kind: "folder_name" },
  { id: "2", kind: "date_created" },
  { id: "3", kind: "time_created" },
  { id: "4", kind: "sequence", pad_width: 3 },
];

/** Application settings (mirrors Rust AppSettings). */
export interface AppSettings {
  folder: string;
  days: number;
  use_hash: boolean;
  use_size: boolean;
  use_name: boolean;
  use_mtime: boolean;
  use_mime: boolean;
  hash_limit_enabled: boolean;
  hash_max_mb: number;
  skip_same_folder_prompt: boolean;
  show_keep_full_paths: boolean;
  include_subfolders: boolean;
  name_prefix: string;
  recent_folders: string[];
  view_mode: ViewMode;
  auto_file_type_preset: AutoFileTypePreset;
  theme: Theme;
  /** Stored as an opaque JSON blob in settings; parsed on load. */
  rename_components: RenameComponent[];
  rename_separator: string;
}

/** Parameters for the scan command. */
export interface ScanParams {
  folder: string;
  days: number;
  use_hash: boolean;
  use_size: boolean;
  use_name: boolean;
  use_mtime: boolean;
  use_mime: boolean;
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
