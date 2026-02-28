interface SettingsPanelProps {
  useHash: boolean;
  useSize: boolean;
  useName: boolean;
  useMtime: boolean;
  useMime: boolean;
  hashLimitEnabled: boolean;
  hashMaxMb: number;
  includeSubfolders: boolean;
  namePrefix: string;
  skipSameFolderPrompt: boolean;
  onChange: (field: string, value: boolean | number | string) => void;
}

export default function SettingsPanel({
  useHash,
  useSize,
  useName,
  useMtime,
  useMime,
  hashLimitEnabled,
  hashMaxMb,
  includeSubfolders,
  namePrefix,
  skipSameFolderPrompt,
  onChange,
}: SettingsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Duplicate checks */}
      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
          Duplicate checks
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={useHash}
              onChange={(e) => onChange("use_hash", e.target.checked)}
              className="rounded"
            />
            Content hash (SHA-256)
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={useSize}
              onChange={(e) => onChange("use_size", e.target.checked)}
              className="rounded"
            />
            Size
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={useName}
              onChange={(e) => onChange("use_name", e.target.checked)}
              className="rounded"
            />
            File name
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={useMtime}
              onChange={(e) => onChange("use_mtime", e.target.checked)}
              className="rounded"
            />
            Modified time
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={useMime}
              onChange={(e) => onChange("use_mime", e.target.checked)}
              className="rounded"
            />
            MIME type
          </label>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={hashLimitEnabled}
              onChange={(e) => onChange("hash_limit_enabled", e.target.checked)}
              className="rounded"
            />
            Limit hashing to files up to
          </label>
          <input
            type="number"
            min={10}
            max={10000}
            value={hashMaxMb}
            onChange={(e) =>
              onChange("hash_max_mb", Math.max(10, Number(e.target.value) || 10))
            }
            className="w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-gray-100"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">MB</span>
        </div>
      </fieldset>

      {/* Scan options */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={includeSubfolders}
            onChange={(e) => onChange("include_subfolders", e.target.checked)}
            className="rounded"
          />
          Include subfolders
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Only scan file names starting with:
          </span>
          <input
            type="text"
            value={namePrefix}
            onChange={(e) => onChange("name_prefix", e.target.value)}
            placeholder="(leave blank for all files)"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Deletion behavior */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={skipSameFolderPrompt}
            onChange={(e) =>
              onChange("skip_same_folder_prompt", e.target.checked)
            }
            className="rounded"
          />
          Skip keep-choice dialog when duplicates are in the same folder (auto
          keep newest)
        </label>
      </div>
    </div>
  );
}
