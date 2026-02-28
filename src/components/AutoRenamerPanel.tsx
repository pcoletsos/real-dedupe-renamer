import type { AutoFileTypePreset, RenameComponent } from "../types";
import RenameComponentBuilder from "./RenameComponentBuilder";

interface AutoRenamerPanelProps {
  includeSubfolders: boolean;
  prefixScan: string;
  prefixSearch: string;
  fileTypePreset: AutoFileTypePreset;
  extensionFilter: string;
  minSizeMb: string;
  maxSizeMb: string;
  renameComponents: RenameComponent[];
  renameSeparator: string;
  onIncludeSubfoldersChange: (value: boolean) => void;
  onPrefixScanChange: (value: string) => void;
  onPrefixSearchChange: (value: string) => void;
  onFileTypePresetChange: (value: AutoFileTypePreset) => void;
  onExtensionFilterChange: (value: string) => void;
  onMinSizeMbChange: (value: string) => void;
  onMaxSizeMbChange: (value: string) => void;
  onRenameComponentsChange: (components: RenameComponent[]) => void;
  onRenameSeparatorChange: (separator: string) => void;
}

const FILE_TYPE_OPTIONS: Array<{ value: AutoFileTypePreset; label: string }> = [
  { value: "all", label: "All files" },
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "documents", label: "Documents" },
  { value: "archives", label: "Archives" },
];

export default function AutoRenamerPanel({
  includeSubfolders,
  prefixScan,
  prefixSearch,
  fileTypePreset,
  extensionFilter,
  minSizeMb,
  maxSizeMb,
  renameComponents,
  renameSeparator,
  onIncludeSubfoldersChange,
  onPrefixScanChange,
  onPrefixSearchChange,
  onFileTypePresetChange,
  onExtensionFilterChange,
  onMinSizeMbChange,
  onMaxSizeMbChange,
  onRenameComponentsChange,
  onRenameSeparatorChange,
}: AutoRenamerPanelProps) {
  return (
    <div className="space-y-4">
      {/* Scan controls */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={includeSubfolders}
            onChange={(e) => onIncludeSubfoldersChange(e.target.checked)}
            className="rounded"
          />
          Include subfolders
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">Prefix scan:</span>
          <input
            type="text"
            value={prefixScan}
            onChange={(e) => onPrefixScanChange(e.target.value)}
            placeholder="(leave blank for all files)"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Filters */}
      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
          Filters
        </legend>
        <div className="space-y-3">
          {/* Prefix search */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 dark:text-gray-300 w-28 shrink-0">Prefix search:</label>
            <input
              type="text"
              value={prefixSearch}
              onChange={(e) => onPrefixSearchChange(e.target.value)}
              placeholder="Filters candidates by file name prefix"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* File type preset (scan-side filter) */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 dark:text-gray-300 w-28 shrink-0">File type:</label>
            <select
              value={fileTypePreset}
              onChange={(e) => onFileTypePresetChange(e.target.value as AutoFileTypePreset)}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
            >
              {FILE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Extension allow-list (post-scan, frontend-only) */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 dark:text-gray-300 w-28 shrink-0">Extensions:</label>
            <input
              type="text"
              value={extensionFilter}
              onChange={(e) => onExtensionFilterChange(e.target.value)}
              placeholder=".jpg .png .pdf  (leave blank for all)"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {/* Min / max size (MB, post-scan, frontend-only) */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 dark:text-gray-300 w-28 shrink-0">Size (MB):</label>
            <input
              type="number"
              value={minSizeMb}
              onChange={(e) => onMinSizeMbChange(e.target.value)}
              placeholder="min"
              min={0}
              step={0.1}
              className="w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-gray-100"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">–</span>
            <input
              type="number"
              value={maxSizeMb}
              onChange={(e) => onMaxSizeMbChange(e.target.value)}
              placeholder="max"
              min={0}
              step={0.1}
              className="w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>
      </fieldset>

      {/* Rename schema builder */}
      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
          Rename pattern
        </legend>
        <RenameComponentBuilder
          components={renameComponents}
          separator={renameSeparator}
          onComponentsChange={onRenameComponentsChange}
          onSeparatorChange={onRenameSeparatorChange}
        />
      </fieldset>
    </div>
  );
}
