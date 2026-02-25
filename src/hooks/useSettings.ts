import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as api from "../api";
import type { AppSettings } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  folder: "",
  days: 7,
  use_hash: true,
  use_size: true,
  use_name: false,
  use_mtime: false,
  hash_limit_enabled: true,
  hash_max_mb: 500,
  skip_same_folder_prompt: false,
  show_keep_full_paths: false,
  include_subfolders: true,
  name_prefix: "",
  recent_folders: [],
  view_mode: "simplified",
};

export const SIMPLIFIED_DEFAULTS: Partial<AppSettings> = {
  days: 7,
  use_hash: true,
  use_size: false,
  use_name: false,
  use_mtime: false,
  hash_limit