import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as api from "./api";
import type { AppSettings, DuplicateGroup, ScanResult } from "./types";
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
  hash_limit_enabled: true,
  hash_max_mb: 500,
  skip_same_folder_prompt: false,
  show_keep_full_paths: false,
  include_subfolders: true,
  name_prefix: "",
  recent_folders: [],
  view_mode: "simplified",
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
  const [advancedSnapshot, setAdvancedSnapshot] = useState<Partial<AppSettings>>({});
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
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Load settings on mount
  useEffect(() => {
    (async () => {
      try {
        const [loaded, defaultFolder] = await Promise.all([
          api.getSettings(),
          api.getDefaultFolder(),
        ]);
        const merged = { ...DEFAULT_SETTINGS, ...loaded };
        if (!merged.folder) merged.folder = defaultFolder;
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

  // Use Tauri's onCloseRequested so the save completes before the
  // window actually closes (beforeunload cannot await async work).
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested(async () => {
      await saveSettings();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [saveSettings]);

  const viewMode = settings.view_mode;

  const setViewMode = (mode: "simplified" | "advanced") => {
    if (mode === "simplified" && viewMode === "advanced") {
      // Snapshot current advanced settings before switching
      setAdvancedSnapshot({
        days: settings.days,
        use_hash: settings.use_hash,
        use_size: settings.use_size,
        use_name: settings.use_name,
        use_mtime: settings.use_mtime,
        hash_limit_enabled: settings.hash_limit_enabled,
        hash_max_mb: settings.hash_max_mb,
        skip_same_folder_prompt: settings.skip_same_folder_prompt,
        include_subfolders: settings.include_subfolders,
        name_prefix: settings.name_prefix,
      });
    } else if (mode === "advanced" && viewMode === "simplified") {
      // Restore advanced settings
      if (Object.keys(advancedSnapshot).length > 0) {
        setSettings((s) => ({ ...s, ...advancedSnapshot }));
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
    if (scanning) return;

    const folder = settings.folder.trim();
    if (!folder) {
      setConfirmState({
        title: "Invalid folder",
        message: "Please choose a folder to scan.",
        buttons: [
          { label: "OK", onClick: () => setConfirmState(null) },
        ],
      });
      return;
    }

    // Use simplified defaults or current settings
    const isSimplified = viewMode === "simplified";
    const scanSettings = isSimplified
      ? { ...settings, ...SIMPLIFIED_DEFAULTS }
      : settings;

    if (
      !scanSettings.use_hash &&
      !scanSettings.use_size &&
      !scanSettings.use_name &&
      !scanSettings.use_mtime
    ) {
      setConfirmState({
        title: "No criteria",
        message: "Select at least one duplicate check.",
        buttons: [
          { label: "OK", onClick: () => setConfirmState(null) },
        ],
      });
      return;
    }

    setScanning(true);
    setScanResult(null);
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
        scanSettings.use_size || scanSettings.use_name || scanSettings.use_mtime,
      );

      // Simplified mode: auto-prompt delete if duplicates found
      if (isSimplified && result.groups.length > 0) {
        showSimplifiedConfirm(result);
      }
    } catch (e) {
      setConfirmState({
        title: "Scan failed",
        message: String(e),
        buttons: [
          { label: "OK", onClick: () => setConfirmState(null) },
        ],
      });
    } finally {
      setScanning(false);
      saveSettings();
    }
  };

  const showSimplifiedConfirm = (result: ScanResult) => {
    const totalDupes = result.groups.reduce(
      (n, g) => n + g.files.length - 1,
      0,
    );
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
        {
          label: "Cancel",
          onClick: () => setConfirmState(null),
        },
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
    // Auto-keep newest (first file, sorted by mtime desc)
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
              handleScan(); // Re-scan
            },
          },
        ],
      });
    } catch (e) {
      setConfirmState({
        title: "Delete failed",
        message: String(e),
        buttons: [
          { label: "OK", onClick: () => setConfirmState(null) },
        ],
      });
    }
  };

  // Advanced mode: Delete duplicates with keep-choice dialog
  const handleDeleteDuplicates = () => {
    if (!scanResult || scanResult.groups.length === 0) return;

    if (settings.skip_same_folder_prompt) {
      // Separate same-folder groups (auto-keep newest) from multi-folder groups
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
        // All groups are same-folder, proceed directly
        confirmAndDelete(autoKeep);
        return;
      }

      // Show keep-choice for multi-folder groups
      setKeepChoiceGroups(manualGroups);
      setKeepChoiceOpen(true);
    } else {
      setKeepChoiceGroups(scanResult.groups);
      setKeepChoiceOpen(true);
    }
  };

  const handleKeepChoiceConfirm = (keepPaths: Map<number, string>) => {
    setKeepChoiceOpen(false);

    // Build full map including auto-kept groups
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

    // Map manual choices back to original group indices
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

  // Advanced mode: delete selected files
  const handleDeleteSelected = () => {
    if (selectedPaths.size === 0 || !scanResult) return;

    // Check for fully-selected groups (all copies would be deleted)
    const fullySelectedGroups: string[] = [];
    for (const g of scanResult.groups) {
      const paths = g.files.map((f) => f.path);
      if (paths.every((p) => selectedPaths.has(p))) {
        fullySelectedGroups.push(
          `${g.files[0].name} (${g.files.length} copies)`,
        );
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
              handleScan(); // Re-scan
            },
          },
        ],
      });
    } catch (e) {
      setConfirmState({
        title: "Delete failed",
        message: String(e),
        buttons: [
          { label: "OK", onClick: () => setConfirmState(null) },
        ],
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
    const lines: string[] = [
      `Found ${scanResult.groups.length} duplicate group(s)`,
      "",
    ];
    for (const group of scanResult.groups) {
      lines.push(
        `${group.files[0].name}  [${group.key_description}]`,
      );
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
      buttons: [
        { label: "OK", onClick: () => setConfirmState(null) },
      ],
    });
  };

  const isAdvanced = viewMode === "advanced";
  const hasResults = scanResult !== null && scanResult.groups.length > 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            Delete Real Duplicates{" "}
            <span className="text-sm font-normal text-gray-400">v2.0.0</span>
          </h1>
        </div>

        {/* Scan controls */}
        <ScanView
          folder={settings.folder}
          onFolderChange={(f) => updateSetting("folder", f)}
          days={settings.days}
          onDaysChange={(d) => updateSetting("days", d)}
          onScan={handleScan}
          scanning={scanning}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          recentFolders={settings.recent_folders}
          onClearHistory={() => setSettings((s) => ({ ...s, recent_folders: [] }))}
          showDays={isAdvanced}
        />

        {/* Settings (advanced only) */}
        {isAdvanced && (
          <SettingsPanel
            useHash={settings.use_hash}
            useSize={settings.use_size}
            useName={settings.use_name}
            useMtime={settings.use_mtime}
            hashLimitEnabled={settings.hash_limit_enabled}
            hashMaxMb={settings.hash_max_mb}
            includeSubfolders={settings.include_subfolders}
            namePrefix={settings.name_prefix}
            skipSameFolderPrompt={settings.skip_same_folder_prompt}
            onChange={updateSetting}
          />
        )}

        {/* Delete duplicates button (advanced with results) */}
        {isAdvanced && hasResults && (
          <button
            onClick={handleDeleteDuplicates}
            className="px-6 py-2 text-sm font-semibold rounded-md bg-red-100 text-red-800 hover:bg-red-200"
          >
            Delete duplicates
          </button>
        )}

        {/* Status bar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <StatusBar
            scanning={scanning}
            scanResult={scanResult}
            days={lastScanDays}
            namePrefix={lastScanPrefix}
            includeSubfolders={lastScanSubfolders}
            hashSkippedHasFallback={lastScanHadFallback}
            staleAdvancedNotice={
              isAdvanced && lastScanMode === "simplified" && scanResult !== null
            }
          />
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
