import type { ScanProgress, ScanResult } from "../types";

interface StatusBarProps {
  scanning: boolean;
  scanResult: ScanResult | null;
  scanProgress: ScanProgress | null;
  days: number;
  namePrefix: string;
  includeSubfolders: boolean;
  hashSkippedHasFallback: boolean;
  staleAdvancedNotice: boolean;
}

function formatTime(seconds: number): string {
  if (seconds < 1) return `${seconds.toFixed(2)} s`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${(seconds / 60).toFixed(1)} min`;
}

export default function StatusBar({
  scanning,
  scanResult,
  scanProgress,
  days,
  namePrefix,
  includeSubfolders,
  hashSkippedHasFallback,
  staleAdvancedNotice,
}: StatusBarProps) {
  if (scanning) {
    const hasProgress = scanProgress !== null;
    const isHashing = hasProgress && scanProgress.phase === "hashing";
    const pct =
      isHashing && scanProgress.total > 0
        ? Math.round((scanProgress.current / scanProgress.total) * 100)
        : null;

    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-blue-600 dark:text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {hasProgress ? scanProgress.message : "Scanning..."}
          </span>
        </div>
        {/* Progress bar */}
        {hasProgress && (
          <div className="mt-2">
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              {pct !== null ? (
                <div
                  className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
              ) : (
                <div className="h-full bg-blue-500 dark:bg-blue-400 rounded-full animate-pulse w-full" />
              )}
            </div>
            {pct !== null && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {pct}% ({scanProgress.current} / {scanProgress.total})
              </p>
            )}
          </div>
        )}
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
  const totalDupes = scanResult.groups.reduce(
    (sum, g) => sum + g.files.length - 1,
    0,
  );

  let summary: string;
  if (scanResult.groups.length === 0) {
    summary = `No duplicates found (${scope}).`;
  } else {
    summary = `Found ${scanResult.groups.length} duplicate group(s), ${totalDupes} deletable file(s) (${scope}).`;
  }
  if (namePrefix) summary += ` Prefix: '${namePrefix}'.`;
  if (!includeSubfolders) summary += " Subfolders: off.";
  summary += ` Time: ${formatTime(scanResult.elapsed_seconds)}`;

  const notices: string[] = [];
  if (scanResult.hash_skipped > 0) {
    notices.push(
      hashSkippedHasFallback
        ? "Hashing skipped for some large files; other checks were used."
        : "Hashing skipped for some large files; no other checks enabled.",
    );
  }
  if (scanResult.scan_skipped > 0) {
    notices.push(
      `Skipped ${scanResult.scan_skipped} file(s) due to scan errors.`,
    );
  }
  if (staleAdvancedNotice) {
    notices.push(
      "Results reflect simplified defaults; rescan to apply advanced settings.",
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
      <p className="text-sm text-gray-800 dark:text-gray-200">{summary}</p>
      {notices.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{notices.join(" ")}</p>
      )}
    </div>
  );
}
