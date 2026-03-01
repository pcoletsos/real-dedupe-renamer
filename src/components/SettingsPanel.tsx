type CriteriaPreset = "safe" | "default" | "aggressive" | "custom";

const PRESETS: Record<Exclude<CriteriaPreset, "custom">, { label: string; hash: boolean; size: boolean; name: boolean; mtime: boolean; mime: boolean }> = {
  safe:       { label: "Safe (hash only)",       hash: true,  size: false, name: false, mtime: false, mime: false },
  default:    { label: "Default (hash + size)",   hash: true,  size: true,  name: false, mtime: false, mime: false },
  aggressive: { label: "Aggressive (all checks)", hash: true,  size: true,  name: true,  mtime: true,  mime: true  },
};

function detectPreset(h: boolean, s: boolean, n: boolean, m: boolean, mi: boolean): CriteriaPreset {
  for (const [key, p] of Object.entries(PRESETS) as [Exclude<CriteriaPreset, "custom">, typeof PRESETS[keyof typeof PRESETS]][]) {
    if (p.hash === h && p.size === s && p.name === n && p.mtime === m && p.mime === mi) return key;
  }
  return "custom";
}

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
  const currentPreset = detectPreset(useHash, useSize, useName, useMtime, useMime);

  function applyPreset(key: string) {
    const p = PRESETS[key as Exclude<CriteriaPreset, "custom">];
    if (!p) return;
    onChange("use_hash", p.hash);
    onChange("use_size", p.size);
    onChange("use_name", p.name);
    onChange("use_mtime", p.mtime);
    onChange("use_mime", p.mime);
  }

  return (
    <div className="space-y-4">
      {/* Duplicate checks */}
      <fieldset className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
          Duplicate checks
        </legend>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Preset:</span>
          <select
            value={currentPreset}
            onChange={(e) => applyPreset(e.target.value)}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 dark:bg-gray-700 dark:text-gray-100"
          >
            {Object.entries(PRESETS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
            {currentPreset === "custom" && (
              <option value="custom" disabled>Custom</option>
            )}
          </select>
        </div>
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
        {/* Confidence warning */}
        {!useHash && (
          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded text-xs text-amber-800 dark:text-amber-300">
            Warning: Without content hashing, duplicates are matched by metadata only. Files with identical metadata may have different content.
          </div>
        )}
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
