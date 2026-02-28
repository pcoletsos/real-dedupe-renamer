import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import * as api from "./api";
import type {
  AppSettings,
  AutoRenameScanResult,
  DuplicateGroup,
  RenameComponent,
  ScanProgress,
  ScanResult,
  Theme,
  ViewMode,
} from "./types";
import { DEFAULT_RENAME_COMPONENTS } from "./types";
import AutoRenamerPanel from "./components/AutoRenamerPanel";
import AutoRenameStatus from "./components/AutoRenameStatus";
import AutoRenameTable from "./components/AutoRenameTable";
import ConfirmDialog from "./components/ConfirmDialog";
import KeepChoiceDialog from "./components/KeepChoiceDialog";
import ResultsTable from "./components/ResultsTable";
import ScanView from "./components/ScanView";
import SettingsPanel from "./components/SettingsPanel";
import StatusBar from "./components/StatusBar";

const SIMPLIFIED_DEFAULTS: Partial<AppSettings> = {
  days: 7,
  use_hash: true,
  use_size: false,
  use_name: false,
  use_mtime: false,
  use_mime: false,
  hash_limit_enabled: true,
  hash_max_mb: 500,
  include_subfolders: true,
  name_prefix: "",
  skip_same_folder_prompt: true,
};

const DEFAULT_SETTINGS: AppSettings = {
  folder: "",
  days: 7,
  use_hash: true,
  use_size: true,
  use_name: false,
  use_mtime: false,
  use_mime: false,
  hash_limit_enabled: true,
  hash_max_mb: 500,
  skip_same_folder_prompt: false,
  show_keep_full_paths: false,
  include_subfolders: true,
  name_prefix: "",
  recent_folders: [],
  view_mode: "simplified",
  auto_file_type_preset: "all",
  theme: "system",
  rename_components: DEFAULT_RENAME_COMPONENTS,
  rename_separator: "_",
};

type ConfirmState = {
  title: string;
  message: string;
  buttons: Array<{
    label: string;
    onClick: () => void;
    variant?: "danger" | "primary" | "default";
  }>;
} | null;

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [advancedSnapshot, setAdvancedSnapshot] = useState<Partial<AppSettings>>(
    {},
  );
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [keepChoiceOpen, setKeepChoiceOpen] = useState(false);
  const [keepChoiceGroups, setKeepChoiceGroups] = useState<DuplicateGroup[]>([]);
  const [lastScanMode, setLastScanMode] = useState<string | null>(null);
  const [lastScanDays, setLastScanDays] = useState(0);
  const [lastScanPrefix, setLastScanPrefix] = useState("");
  const [lastScanSubfolders, setLastScanSubfolders] = useState(true);
  const [lastScanHadFallback, setLastScanHadFallback] = useState(false);

  const [autoScanning, setAutoScanning] = useState(false);
  const [autoRenaming, setAutoRenaming] = useState(false);
  const [autoScanResult, setAutoScanResult] = useState<AutoRenameScanResult | null>(
    null,
  );
  const [autoPrefixSearch, setAutoPrefixSearch] = useState("");
  const [autoLastMessage, setAutoLastMessage] = useState("");
  const [autoLastMessageIsError, setAutoLastMessageIsError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [appVersion, setAppVersion] = useState("");

  // --- Auto-renamer post-scan filter state (frontend-only) ---
  const [extensionFilter, setExtensionFilter] = useState("");
  const [minSizeMb, setMinSizeMb] = useState("");
  const [maxSizeMb, setMaxSizeMb] = useState("");

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const closeInFlightRef = useRef(false);

  // Fetch app version from Tauri on mount
  useEffect(() => {
    getVersion().then((v) => setAppVersion(v));
  }, []);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      try {
        const [loaded, defaultFolder] = await Promise.all([
          api.getSettings(),
          api.getDefaultFolder(),
        ]);
        const merged: AppSettings = { ...DEFAULT_SETTINGS, ...loaded };
        if (!merged.folder) merged.folder = defaultFolder;
        if (!merged.auto_file_type_preset) merged.auto_file_type_preset = "all";
        // Ensure rename fields have defaults if missing from persisted settings.
        if (!merged.rename_components || !Array.isArray(merged.rename_components) || merged.rename_components.length === 0) {
          merged.rename_components = DEFAULT_RENAME_COMPONENTS;
        }
        if (!merged.rename_separator) merged.rename_separator = "_";
        setSettings(merged);
      } catch {
        try {
          const defaultFolder = await api.getDefaultFolder();
          setSettings((s) => ({ ...s, folder: defaultFolder }));
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);

  // Save settings — awaitable, used by close handler and after scans.
  const saveSettings = useCallback(async () => {
    try {
      await api.saveSettings(settingsRef.current);
    } catch {
      /* ignore */
    }
  }, []);

  const saveSettingsWithTimeout = useCallback(
    async (timeoutMs = 1200) => {
      await Promise.race([
        saveSettings(),
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    },
    [saveSettings],
  );

  // Use Tauri's onCloseRequested so the save completes before the
  // window actually closes (beforeunload cannot await async work).
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested((event) => {
      if (closeInFlightRef.current) return;
      closeInFlightRef.current = true;
      event.preventDefault();

      void (async () => {
        await saveSettingsWithTimeout();
        try {
          await win.close();
        } catch {
          closeInFlightRef.current = false;
        }
      })();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [saveSettingsWithTimeout]);

  // Drag-and-drop folder selection
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setIsDragging(true);
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (paths.length > 0) {
          updateSetting("folder", paths[0]);
        }
      } else {
        setIsDragging(false);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Listen for scan-progress events from backend
  useEffect(() => {
    const unlisten = listen<ScanProgress>("scan-progress", (event) => {
      setScanProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Theme management
  useEffect(() => {
    const apply = (theme: Theme) => {
      let dark: boolean;
      if (theme === "system") {
        dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      } else {
        dark = theme === "dark";
      }
      document.documentElement.classList.toggle("dark", dark);
    };

    apply(settings.theme);

    if (settings.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings.theme]);

  const cycleTheme = () => {
    const order: Theme[] = ["light", "dark", "system"];
    const idx = order.indexOf(settings.theme);
    const next = order[(idx + 1) % order.length];
    updateSetting("theme", next);
  };

  const viewMode = settings.view_mode;

  const setViewMode = (mode: ViewMode) => {
    if (viewMode === "advanced" && mode !== "advanced") {
      // Snapshot current advanced settings before leaving advanced mode.
      setAdvancedSnapshot({
        days: settings.days,
        use_hash: settings.use_hash,
        use_size: settings.use_size,
        use_name: settings.use_name,
        use_mtime: settings.use_mtime,
        use_mime: settings.use_mime,
        hash_limit_enabled: settings.hash_limit_enabled,
        hash_max_mb: settings.hash_max_mb,
        skip_same_folder_prompt: settings.skip_same_folder_prompt,
        include_subfolders: settings.include_subfolders,
        name_prefix: settings.name_prefix,
      });
    } else if (mode === "advanced" && viewMode !== "advanced") {
      // Restore advanced settings when entering advanced mode.
      if (Object.keys(advancedSnapshot).length > 0) {
        setSettings((s) => ({ ...s, ...advancedSnapshot, view_mode: mode }));
        return;
      }
    }
    setSettings((s) => ({ ...s, view_mode: mode }));
  };

  const updateSetting = (field: string, value: boolean | number | string) => {
    setSettings((s) => ({ ...s, [field]: value }));
  };

  const rememberFolder = (folder: string) => {
    setSettings((s) => {
      const cleaned = s.recent_folders.filter(
        (f) => f.toLowerCase() !== folder.toLowerCase(),
      );
      return { ...s, recent_folders: [folder, ...cleaned].slice(0, 20) };
    });
  };

  const handleScan = async () => {
    if (viewMode === "auto_renamer") {
      if (autoScanning || autoRenaming) return;
      await performAutoScan();
      return;
    }

    if (scanning) return;
    await handleDuplicateScan();
  };

  const handleDuplicateScan = async () => {
    const folder = settings.folder.trim();
    if (!folder) {
      setConfirmState({
        title: "Invalid folder",
        message: "Please choose a folder to scan.",
        buttons: [{ label: "OK", onClick: () => setConfirmState(null) }],
      });
      return;
    }

    // Use simplified defaults or current settings.
    const isSimplified = viewMode === "simplified";
    const scanSettings = isSimplified
      ? { ...settings, ...SIMPLIFIED_DEFAULTS }
      : settings;

    if (
      !scanSettings.use_hash &&
      !scanSettings.use_size &&
      !scanSettings.use_name &&
      !scanSettings.use_mtime &&
      !scanSettings.use_mime
    ) {
      setConfirmState({
        title: "No criteria",
        message: "Select at least one duplicate check.",
        buttons: [{ label: "OK", onClick: () => setConfirmState(null) }],
      });
      return;
    }

    setScanning(true);
    setScanResult(null);
    setScanProgress(null);
    setSelectedPaths(new Set());
    setFilterText("");

    try {
      const result = await api.scan({
        folder,
        days: scanSettings.days,
        use_hash: scanSettings.use_hash,
        use_size: scanSettings.use_size,
        use_name: scanSettings.use_name,
        use_mtime: scanSettings.use_mtime,
        use_mime: scanSettings.use_mime,
        hash_limit_enabled: scanSettings.hash_limit_enabled,
        hash_max_mb: scanSettings.hash_max_mb,
        include_subfolders: scanSettings.include_subfolders,
        name_prefix: scanSettings.name_prefix,
      });

      rememberFolder(folder);
      setScanResult(result);
      setLastScanMode(viewMode);
      setLastScanDays(scanSettings.days);
      setLastScanPrefix(scanSettings.name_prefix);
      setLastScanSubfolders(scanSettings.include_subfolders);
      setLastScanHadFallback(
        scanSettings.use_size || scanSettings.use_name || scanSettings.use_mtime || scanSettings.use_mime,
      );

      // Simplified mode: auto-prompt delete if duplicates found.
      if (isSimplified && result.groups.length > 0) {
        showSimplifiedConfirm(result);
      }
    } catch (e) {
      setConfirmState({
        title: "Scan failed",
        message: String(e),
        buttons: [{ label: "OK", onClick: () => setConfirmState(null) }],
      });
    } finally {
      setScanning(false);
      setScanProgress(null);
      saveSettings();
    }
  };

  const performAutoScan = async () => {
    const folder = settings.folder.trim();
    if (!folder) {
      setConfirmState({
        title: "Invalid folder",
        message: "Please choose a folder to scan.",
        buttons: [{ label: "OK", onClick: () => setConfirmState(null) }],
      });
      return;
    }

    setAutoScanning(true);
    setAutoScanResult(null);
    setAutoLastMessage("");
    setAutoLastMessageIsError(false);

    try {
      const result = await api.scanAutoRename({
        folder,
        days: settings.days,
        include_subfolders: settings.include_subfolders,
        name_prefix: settings.name_prefix,
        file_type_preset: settings.auto_file_type_preset,
      });
      rememberFolder(folder);
      setAutoScanResult(result);
      setLastScanDays(settings.days);
      setLastScanPrefix(settings.name_prefix);
      setLastScanSubfolders(settings.include_subfolders);
      setAutoLastMessageIsError(false);
    } catch (e) {
      setAutoLastMessage(String(e));
      setAutoLastMessageIsError(true);
    } finally {
      setAutoScanning(false);
      saveSettings();
    }
  };

  // --- Filtered candidates (post-scan, frontend-only) ---
  const filteredAutoCandidates = useMemo(() => {
    const candidates = autoScanResult?.candidates ?? [];

    // Prefix search
    const needle = autoPrefixSearch.trim().toLowerCase();

    // Extension allow-list: normalise to lowercase with leading dot
    const rawExts = extensionFilter
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .map((e) => (e.startsWith(".") ? e : `.${e}`));

    // Size bounds in bytes
    const minBytes = minSizeMb !== "" ? parseFloat(minSizeMb) * 1024 * 1024 : null;
    const maxBytes = maxSizeMb !== "" ? parseFloat(maxSizeMb) * 1024 * 1024 : null;

    return candidates.filter((c) => {
      if (needle && !c.name.toLowerCase().startsWith(needle)) return false;
      if (rawExts.length > 0 && !rawExts.includes(c.extension.toLowerCase())) return false;
      if (minBytes !== null && !isNaN(minBytes) && c.size < minBytes) return false;
      if (maxBytes !== null && !isNaN(maxBytes) && c.size > maxBytes) return false;
      return true;
    });
  }, [autoPrefixSearch, autoScanResult, extensionFilter, minSizeMb, maxSizeMb]);

  const handleAutoRename = () => {
    if (filteredAutoCandidates.length === 0) return;

    setConfirmState({
      title: "Confirm auto-rename",
      message:
        `This will rename ${filteredAutoCandidates.length} file(s) using the configured pattern.\n\n` +
        `Only files currently visible in the table will be renamed.\n\nProceed?`,
      buttons: [
        { label: "Cancel", onClick: () => setConfirmState(null) },
        {
          label: "Auto-rename",
          onClick: () => {
            setConfirmState(null);
            executeAutoRename(filteredAutoCandidates.map((c) => c.path));
          },
          variant: "danger",
        },
      ],
    });
  };

  const executeAutoRename = async (paths: string[]) => {
    if (paths.length === 0) return;

    setAutoRenaming(true);
    setAutoLastMessage("");
    setAutoLastMessageIsError(false);

    try {
      const result = await api.autoRename(paths, {
        components: settings.rename_components,
        separator: settings.rename_separator,
      });
      const summaryParts = [`Renamed ${result.renamed_count} file(s).`];
      if (result.skipped_count > 0) {
        summaryParts.push(`Skipped ${result.skipped_count} file(s).`);
      }
      if (result.error_count > 0) {
        summaryParts.push(`${result.error_count} error(s).`);
      }
      const summary = summaryParts.join(" ");
      setAutoLastMessage(summary);
      setAutoLastMessageIsError(result.error_count > 0);

      const details =
        result.errors.length > 0
          ? `\n\nFirst error:\n${result.errors[0].path}\n${result.errors[0].message}`
          : "";
      setConfirmState({
        title: result.error_count > 0 ? "Auto-rename completed with issues" : "Done",
        message: `${summary}${details}`,
        buttons: [{ label: "OK", onClick: () => setConfirmState(null) }],
      });
    } catch (e) {
      setAutoLastMessage(String(e));
      setAutoLastMessageIsError(true);
      setConfirmState({
        title: "Auto-rename failed",
        message: String(e),
        buttons: [{ label: "OK", onClick: () => setConfirmState(null) }],
      });
    } finally {
      setAutoRenaming(false);
    }

    await performAutoScan();
  };

  const showSimplifiedConfirm = (result: ScanResult) => {
    const totalDupes = result.groups.reduce((n, g) => n + g.files.length - 1, 0);
    const totalSize = result.groups.reduce((n, g) => {
      const sorted = [...g.files].sort((a, b) => b.mtime - a.mtime);
      return n + sorted.slice(1).reduce((s, f) => s + f.size, 0);
    }, 0);
    const sizeStr = humanSize(totalSize);

    setConfirmState({
      title: "Confirm delete",
      message:
        `Found ${result.groups.length} duplicate group(s) and ${totalDupes} deletable file(s).\n` +
        `Estimated space freed: ~${sizeStr}.\n` +
        `The newest file in each group will be kept.\n\n` +
        `Proceed?`,
      buttons: [
        { label: "Cancel", onClick: () => setConfirmState(null) },
        {
          label: "Review in Advanced",
          onClick: () => {
            setConfirmState(null);
            setViewMode("advanced");
          },
        },
        {
          label: "Delete duplicates",
          onClick: () => {
            setConfirmState(null);
            simplifiedDelete(result);
          },
          variant: "danger",
        },
      ],
    });
  };

  const simplifiedDelete = async (result: ScanResult) => {
    // Auto-keep newest (first file, sorted by mtime desc).
    const toDelete: string[] = [];
    for (const group of result.groups) {
      const sorted = [...group.files].sort((a, b) => b.mtime - a.mtime);
      for (let i = 1; i < sorted.length; i++) {
        toDelete.push(sorted[i].path);
      }
    }
    if (toDelete.length === 0) return;

    try {
      const count = await api.deleteFiles(toDelete);
      setConfirmState({
        title: "Done",
        message: `Deleted ${count} duplicate file(s).`,
        buttons: [
          {
            label: "OK",
            onClick: () => {
              setConfirmState(null);
              handleScan(); // Re-scan.
            },
          },
        ],
      });
    } catch (e) {
      setConfirmState({
        title: "Delete failed",
        message: String(e),
        buttons: [{ label: "OK", onClick: () => setConfirmState(null) }],
      });
    }
  };

  // Advanced mode: Delete duplicates with keep-choice dialog.
  const handleDeleteDuplicates = () => {
    if (!scanResult || scanResult.groups.length === 0) return;

    if (settings.skip_same_folder_prompt) {
      // Separate same-folder groups (auto-keep newest) from multi-folder groups.
      const manualGroups: DuplicateGroup[] = [];
      const autoKeep = new Map<number, string>(); // group index -> keep path

      scanResult.groups.forEach((group, gi) => {
        const folders = new Set(group.files.map((f) => f.folder));
        if (folders.size === 1) {
          const sorted = [...group.files].sort((a, b) => b.mtime - a.mtime);
          autoKeep.set(gi, sorted[0].path);
        } else {
          manualGroups.push(group);
        }
      });

      if (manualGroups.length === 0) {
        // All groups are same-folder, proceed directly.
        confirmAndDelete(autoKeep);
        return;
      }

      // Show keep-choice for multi-folder groups.
      setKeepChoiceGroups(manualGroups);
      setKeepChoiceOpen(true);
    } else {
      setKeepChoiceGroups(scanResult.groups);
      setKeepChoiceOpen(true);
    }
  };

  const handleKeepChoiceConfirm = (keepPaths: Map<number, string>) => {
    setKeepChoiceOpen(false);

    // Build full map including auto-kept groups.
    const fullKeep = new Map<number, string>();

    if (settings.skip_same_folder_prompt && scanResult) {
      scanResult.groups.forEach((group, gi) => {
        const folders = new Set(group.files.map((f) => f.folder));
        if (folders.size === 1) {
          const sorted = [...group.files].sort((a, b) => b.mtime - a.mtime);
          fullKeep.set(gi, sorted[0].path);
        }
      });
    }

    // Map manual choices back to original group indices.
    let manualIdx = 0;
    if (scanResult) {
      scanResult.groups.forEach((_group, gi) => {
        if (!fullKeep.has(gi)) {
          const manualKeepPath = keepPaths.get(manualIdx);
          if (manualKeepPath) fullKeep.set(gi, manualKeepPath);
          manualIdx++;
        }
      });
    }

    confirmAndDelete(fullKeep);
  };

  const confirmAndDelete = (keepPaths: Map<number, string>) => {
    if (!scanResult) return;

    const toDelete: string[] = [];
    scanResult.groups.forEach((group, gi) => {
      const keepPath = keepPaths.get(gi);
      for (const file of group.files) {
        if (file.path !== keepPath) toDelete.push(file.path);
      }
    });

    if (toDelete.length === 0) return;

    const totalSize = toDelete.reduce((sum, path) => {
      for (const group of scanResult.groups) {
        const file = group.files.find((f) => f.path === path);
        if (file) return sum + file.size;
      }
      return sum;
    }, 0);

    setConfirmState({
      title: "Confirm deletion",
      message:
        `This will delete ${toDelete.length} file(s), freeing ~${humanSize(totalSize)}.\n` +
        `The selected keep file in each group will be kept.\n\nProceed?`,
      buttons: [
        { label: "Cancel", onClick: () => setConfirmState(null) },
        {
          label: "Yes, delete",
          onClick: () => {
            setConfirmState(null);
            executeDelete(toDelete);
          },
          variant: "danger",
        },
      ],
    });
  };

  // Advanced mode: delete selected files.
  const handleDeleteSelected = () => {
    if (selectedPaths.size === 0 || !scanResult) return;

    // Check for fully-selected groups (all copies would be deleted).
    const fullySelectedGroups: string[] = [];
    for (const g of scanResult.groups) {
      const paths = g.files.map((f) => f.path);
      if (paths.every((p) => selectedPaths.has(p))) {
        fullySelectedGroups.push(`${g.files[0].name} (${g.files.length} copies)`);
      }
    }

    if (fullySelectedGroups.length > 0) {
      setConfirmState({
        title: "All copies selected",
        message:
          `Your selection includes every copy in these groups:\n\n` +
          fullySelectedGroups.map((g) => `  - ${g}`).join("\n") +
          `\n\nContinuing will delete ALL copies. Proceed?`,
        buttons: [
          { label: "Review", onClick: () => setConfirmState(null) },
          {
            label: "Delete all selected",
            onClick: () => {
              setConfirmState(null);
              confirmDeleteSelectedFinal();
            },
            variant: "danger",
          },
        ],
      });
      return;
    }

    confirmDeleteSelectedFinal();
  };

  const confirmDeleteSelectedFinal = () => {
    if (!scanResult) return;
    const paths = Array.from(selectedPaths);
    const totalSize = paths.reduce((sum, path) => {
      for (const group of scanResult.groups) {
        const file = group.files.find((f) => f.path === path);
        if (file) return sum + file.size;
      }
      return sum;
    }, 0);

    setConfirmState({
      title: "Confirm deletion",
      message:
        `This will delete ${paths.length} selected file(s), freeing ~${humanSize(totalSize)}.\n` +
        `Files not selected will be kept.\n\nProceed?`,
      buttons: [
        { label: "Cancel", onClick: () => setConfirmState(null) },
        {
          label: "Yes, delete",
          onClick: () => {
            setConfirmState(null);
            executeDelete(paths);
          },
          variant: "danger",
        },
      ],
    });
  };

  const executeDelete = async (paths: string[]) => {
    try {
      const count = await api.deleteFiles(paths);
      setConfirmState({
        title: "Done",
        message: `Deleted ${count} file(s).`,
        buttons: [
          {
            label: "OK",
            onClick: () => {
              setConfirmState(null);
              handleScan(); // Re-scan.
            },
          },
        ],
      });
    } catch (e) {
      setConfirmState({
        title: "Delete failed",
        message: String(e),
        buttons: [{ label: "OK", onClick: () => setConfirmState(null) }],
      });
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await api.openFolder(path);
    } catch {
      /* ignore */
    }
  };

  const handleCopyReport = () => {
    if (!scanResult) return;
    const lines: string[] = [`Found ${scanResult.groups.length} duplicate group(s)`, ""];
    for (const group of scanResult.groups) {
      lines.push(`${group.files[0].name}  [${group.key_description}]`);
      const sorted = [...group.files].sort((a, b) => b.mtime - a.mtime);
      for (const file of sorted) {
        lines.push(
          `  ${file.path}  (${file.size_human}, modified ${file.mtime_formatted})`,
        );
      }
      lines.push("");
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setConfirmState({
      title: "Copied",
      message: "Scan report copied to clipboard.",
      buttons: [{ label: "OK", onClick: () => setConfirmState(null) }],
    });
  };

  const isAdvanced = viewMode === "advanced";
  const isAutoRenamer = viewMode === "auto_renamer";
  const hasResults = scanResult !== null && scanResult.groups.length > 0;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Real Dedupe Renamer{" "}
            <span className="text-sm font-normal text-gray-400 dark:text-gray-500">v{appVersion}</span>
          </h1>
          <button
            onClick={cycleTheme}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title={`Theme: ${settings.theme}`}
          >
            {settings.theme === "light" ? "\u2600\uFE0F" : settings.theme === "dark" ? "\uD83C\uDF19" : "\uD83D\uDCBB"}
          </button>
        </div>

        {/* Scan controls */}
        <ScanView
          folder={settings.folder}
          onFolderChange={(f) => updateSetting("folder", f)}
          days={settings.days}
          onDaysChange={(d) => updateSetting("days", d)}
          onScan={handleScan}
          scanning={scanning || autoScanning}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          recentFolders={settings.recent_folders}
          onClearHistory={() => setSettings((s) => ({ ...s, recent_folders: [] }))}
          showDays={viewMode !== "simplified"}
          isDragging={isDragging}
        />

        {/* Settings (advanced only) */}
        {isAdvanced && (
          <SettingsPanel
            useHash={settings.use_hash}
            useSize={settings.use_size}
            useName={settings.use_name}
            useMtime={settings.use_mtime}
            useMime={settings.use_mime}
            hashLimitEnabled={settings.hash_limit_enabled}
            hashMaxMb={settings.hash_max_mb}
            includeSubfolders={settings.include_subfolders}
            namePrefix={settings.name_prefix}
            skipSameFolderPrompt={settings.skip_same_folder_prompt}
            onChange={updateSetting}
          />
        )}

        {/* Auto-renamer panel */}
        {isAutoRenamer && (
          <AutoRenamerPanel
            includeSubfolders={settings.include_subfolders}
            prefixScan={settings.name_prefix}
            prefixSearch={autoPrefixSearch}
            fileTypePreset={settings.auto_file_type_preset}
            extensionFilter={extensionFilter}
            minSizeMb={minSizeMb}
            maxSizeMb={maxSizeMb}
            renameComponents={settings.rename_components}
            renameSeparator={settings.rename_separator}
            onIncludeSubfoldersChange={(value) =>
              updateSetting("include_subfolders", value)
            }
            onPrefixScanChange={(value) => updateSetting("name_prefix", value)}
            onPrefixSearchChange={setAutoPrefixSearch}
            onFileTypePresetChange={(value) =>
              updateSetting("auto_file_type_preset", value)
            }
            onExtensionFilterChange={setExtensionFilter}
            onMinSizeMbChange={setMinSizeMb}
            onMaxSizeMbChange={setMaxSizeMb}
            onRenameComponentsChange={(components: RenameComponent[]) =>
              setSettings((s) => ({ ...s, rename_components: components }))
            }
            onRenameSeparatorChange={(sep: string) =>
              setSettings((s) => ({ ...s, rename_separator: sep }))
            }
          />
        )}

        {/* Delete duplicates button (advanced with results) */}
        {isAdvanced && hasResults && (
          <button
            onClick={handleDeleteDuplicates}
            className="px-6 py-2 text-sm font-semibold rounded-md bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-800/40"
          >
            Delete duplicates
          </button>
        )}

        {/* Auto-rename button */}
        {isAutoRenamer && autoScanResult !== null && (
          <button
            onClick={handleAutoRename}
            disabled={autoScanning || autoRenaming || filteredAutoCandidates.length === 0}
            className="px-6 py-2 text-sm font-semibold rounded-md bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-800/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {autoRenaming
              ? "Auto-renaming..."
              : `Auto-rename (${filteredAutoCandidates.length})`}
          </button>
        )}

        {/* Status bar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          {isAutoRenamer ? (
            <AutoRenameStatus
              scanning={autoScanning}
              renaming={autoRenaming}
              scanResult={autoScanResult}
              days={settings.days}
              prefixScan={settings.name_prefix}
              includeSubfolders={settings.include_subfolders}
              fileTypePreset={settings.auto_file_type_preset}
              prefixSearch={autoPrefixSearch}
              lastRunMessage={autoLastMessage}
              lastRunError={autoLastMessageIsError}
            />
          ) : (
            <StatusBar
              scanning={scanning}
              scanResult={scanResult}
              scanProgress={scanProgress}
              days={lastScanDays}
              namePrefix={lastScanPrefix}
              includeSubfolders={lastScanSubfolders}
              hashSkippedHasFallback={lastScanHadFallback}
              staleAdvancedNotice={
                isAdvanced && lastScanMode === "simplified" && scanResult !== null
              }
            />
          )}
        </div>

        {/* Results table (advanced only) */}
        {isAdvanced && (
          <ResultsTable
            groups={scanResult?.groups ?? []}
            selectedPaths={selectedPaths}
            onSelectionChange={setSelectedPaths}
            filterText={filterText}
            onFilterChange={setFilterText}
            onOpenFolder={handleOpenFolder}
            onDeleteSelected={handleDeleteSelected}
            onCopyReport={handleCopyReport}
            hasResults={hasResults}
          />
        )}

        {/* Auto-renamer table */}
        {isAutoRenamer && autoScanResult !== null && (
          <AutoRenameTable
            candidates={filteredAutoCandidates}
            totalCandidates={autoScanResult.candidates.length}
            prefixSearch={autoPrefixSearch}
            renameComponents={settings.rename_components}
            renameSeparator={settings.rename_separator}
          />
        )}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        buttons={confirmState?.buttons ?? []}
        onClose={() => setConfirmState(null)}
      />
      <KeepChoiceDialog
        open={keepChoiceOpen}
        groups={keepChoiceGroups}
        onConfirm={handleKeepChoiceConfirm}
        onCancel={() => setKeepChoiceOpen(false)}
        showFullPaths={settings.show_keep_full_paths}
        onToggleFullPaths={() =>
          updateSetting("show_keep_full_paths", !settings.show_keep_full_paths)
        }
      />
    </main>
  );
}

/** Quick human-readable file size (frontend-only helper). */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let i = -1;
  do {
    size /= 1024;
    i++;
  } while (size >= 1024 && i < units.length - 1);
  return `${size.toFixed(size < 10 ? 2 : size < 100 ? 1 : 0)} ${units[i]}`;
}
