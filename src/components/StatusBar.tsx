import { useRef } from "react";
import type { ScanProgress, ScanResult, ScanSkipReasons } from "../types";

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

function formatSkipNotice(scanSkipped: number, reasons: ScanSkipReasons): string {
  return `Skipped ${scanSkipped} file(s) during scan (permissions: ${reasons.permissions}, missing: ${reasons.missing}, transient I/O: ${reasons.transient_io}).`;
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
  const hashStartRef = useRef<number | null>(null);

  if (scanning) {
    const hasProgress = scanProgress !== null;
    const isHashing = hasProgress && scanProgress.phase === "hashing";
    const isScanning = hasProgress && scanProgress.phase === "scanning";
    const pct =
      isHashing && scanProgress.total > 0
        ? Math.round((scanProgress.current / scanProgress.total) * 100)
        : null;

    // Track hashing start time for ETA
    if (isHashing && hashStartRef.current === null) {
      hashStartRef.current = Date.now();
    }
    if (!isHashing) {
      hashStartRef.current = null;
    }

    // Compute ETA during hashing
    let eta: string | null = null;
    if (isHashing && pct !== null && pct > 0 && hashStartRef.current !== null) {
      const elapsedMs = Date.now() - hashStartRef.current;
      const remainMs = (elapsedMs / pct) * (100 - pct);
      const remainSec = remainMs / 1000;
      eta = remainSec < 60
        ? `~${Math.ceil(remainSec)}s remaining`
        : `~${(remainSec / 60).toFixed(1)}min remaining`;
    }

    const phaseLabel = isHashing
      ? "Phase 2: Computing hashes"
      : isScanning
        ? "Phase 1: Discovering files"
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
            {phaseLabel && scanProgress ? (
              <>
                <span className="font-semibold">{phaseLabel}</span>
                {" — "}
                {scanProgress.message}
              </>
            ) : (
              "Scanning..."
            )}
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
                {eta && <span className="ml-2">{eta}</span>}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Reset hashing timer when not scanning
  hashStartRef.current = null;

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
  summary += ` Scanned ${scanResult.total_files_scanned} file(s).`;
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
    notices.push(formatSkipNotice(scanResult.scan_skipped, scanResult.scan_skip_reasons));
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
