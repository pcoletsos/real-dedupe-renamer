import type { AutoFileTypePreset, AutoRenameScanResult } from "../types";

interface AutoRenameStatusProps {
  scanning: boolean;
  renaming: boolean;
  scanResult: AutoRenameScanResult | null;
  days: number;
  prefixScan: string;
  includeSubfolders: boolean;
  fileTypePreset: AutoFileTypePreset;
  prefixSearch: string;
  lastRunMessage: string;
  lastRunError: boolean;
}

function formatTime(seconds: number): string {
  if (seconds < 1) return `${seconds.toFixed(2)} s`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

const FILE_TYPE_LABELS: Record<AutoFileTypePreset, string> = {
  all: "all",
  images: "images",
  videos: "videos",
  audio: "audio",
  documents: "documents",
  archives: "archives",
};

export default function AutoRenameStatus({
  scanning,
  renaming,
  scanResult,
  days,
  prefixScan,
  includeSubfolders,
  fileTypePreset,
  prefixSearch,
  lastRunMessage,
  lastRunError,
}: AutoRenameStatusProps) {
  if (scanning) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">Scanning auto-rename candidates...</p>
      </div>
    );
  }

  if (renaming) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">Renaming files...</p>
      </div>
    );
  }

  if (!scanResult) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">Scan results will appear here.</p>
      </div>
    );
  }

  const scope = days <= 0 ? "all time" : `last ${days} day(s)`;
  let summary = `Found ${scanResult.candidates.length} candidate file(s) (${scope}, ${FILE_TYPE_LABELS[fileTypePreset]}).`;
  if (prefixScan) summary += ` Prefix scan: '${prefixScan}'.`;
  if (prefixSearch) summary += ` Prefix search: '${prefixSearch}'.`;
  if (!includeSubfolders) summary += " Subfolders: off.";
  summary += ` Time: ${formatTime(scanResult.elapsed_seconds)}`;

  const notices: string[] = [];
  if (scanResult.scan_skipped > 0) {
    notices.push(`Skipped ${scanResult.scan_skipped} file(s) due to scan errors.`);
  }
  if (lastRunMessage) notices.push(lastRunMessage);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
      <p className="text-sm text-gray-800 dark:text-gray-200">{summary}</p>
      {notices.length > 0 && (
        <p
          className={`text-sm mt-1 ${
            lastRunError ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {notices.join(" ")}
        </p>
      )}
    </div>
  );
}
