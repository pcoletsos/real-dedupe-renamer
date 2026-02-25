import type { AutoFileTypePreset } from "../types";

interface AutoRenamerPanelProps {
  includeSubfolders: boolean;
  prefixScan: string;
  prefixSearch: string;
  fileTypePreset: AutoFileTypePreset;
  onIncludeSubfoldersChange: (value: boolean) => void;
  onPrefixScanChange: (value: string) => void;
  onPrefixSearchChange: (value: string) => void;
  onFileTypePresetChange: (value: AutoFileTypePreset) => void;
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
  onIncludeSubfoldersChange,
  onPrefixScanChange,
  onPrefixSearchChange,
  onFileTypePresetChange,
}: AutoRenamerPanelProps) {
  return (
    <div className="space-y-4">
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
          <span className="text-sm text-gray-700">Prefix scan:</span>
          <input
            type="text"
            value={prefixScan}
            onChange={(e) => onPrefixScanChange(e.target.value)}
            placeholder="(leave blank for all files)"
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      <fieldset className="border border-gray-200 rounded-md p-3">
        <legend className="text-sm font-medium text-gray-700 px-1">
          Filters
        </legend>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 w-24">Prefix search:</label>
            <input
              type="text"
              value={prefixSearch}
              onChange={(e) => onPrefixSearchChange(e.target.value)}
              placeholder="Filters candidates by file name prefix"
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 w-24">File type:</label>
            <select
              value={fileTypePreset}
              onChange={(e) =>
                onFileTypePresetChange(e.target.value as AutoFileTypePreset)
              }
              className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
            >
              {FILE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
