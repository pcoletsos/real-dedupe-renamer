import { open } from "@tauri-apps/plugin-dialog";
import type { ViewMode } from "../types";

interface ScanViewProps {
  folder: string;
  onFolderChange: (folder: string) => void;
  days: number;
  onDaysChange: (days: number) => void;
  onScan: () => void;
  scanning: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  recentFolders: string[];
  onClearHistory: () => void;
  showDays: boolean;
  isDragging?: boolean;
}

export default function ScanView({
  folder,
  onFolderChange,
  days,
  onDaysChange,
  onScan,
  scanning,
  viewMode,
  onViewModeChange,
  recentFolders,
  onClearHistory,
  showDays,
  isDragging,
}: ScanViewProps) {
  const handleBrowse = async () => {
    const selected = await open({ directory: true, defaultPath: folder || undefined });
    if (typeof selected === "string") {
      onFolderChange(selected);
    }
  };

  return (
    <div className="space-y-3">
      {/* View mode toggle */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="viewMode"
            checked={viewMode === "simplified"}
            onChange={() => onViewModeChange("simplified")}
            title="Simplified Duplicate Deletion"
          />
          <span title="Simplified Duplicate Deletion">SDD</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="viewMode"
            checked={viewMode === "advanced"}
            onChange={() => onViewModeChange("advanced")}
            title="Advanced Duplicate Deletion"
          />
          <span title="Advanced Duplicate Deletion">ADD</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="viewMode"
            checked={viewMode === "auto_renamer"}
            onChange={() => onViewModeChange("auto_renamer")}
          />
          Auto-Renamer
        </label>
      </div>

      {/* Folder chooser */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Folder to scan:
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={folder}
            onChange={(e) => onFolderChange(e.target.value)}
            list="recent-folders"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-100"
            placeholder="Choose a folder..."
          />
          <datalist id="recent-folders">
            {recentFolders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <button
            onClick={handleBrowse}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Browse...
          </button>
          {recentFolders.length > 0 && (
            <button
              onClick={onClearHistory}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              Clear history
            </button>
          )}
        </div>
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed border-blue-500 bg-blue-50/80 dark:bg-blue-900/40 z-10">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Drop folder here</span>
          </div>
        )}
      </div>

      {/* Days back (advanced only) */}
      {showDays && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Days back:
          </label>
          <input
            type="number"
            min={0}
            max={365}
            value={days}
            onChange={(e) =>
              onDaysChange(
                Math.max(0, Math.min(365, Number(e.target.value) || 0)),
              )
            }
            className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-gray-100"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">Quick:</span>
          {[
            { label: "all", val: 0 },
            { label: "week", val: 7 },
            { label: "month", val: 30 },
          ].map(({ label, val }) => (
            <button
              key={label}
              onClick={() => onDaysChange(val)}
              className={`px-2 py-1 text-xs border rounded ${
                days === val
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Scan button */}
      <button
        onClick={onScan}
        disabled={scanning}
        className="px-6 py-2 text-sm font-semibold rounded-md bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-800/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {scanning ? "Scanning..." : "Scan"}
      </button>
    </div>
  );
}
