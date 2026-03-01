import { useMemo } from "react";
import type { AutoRenameCandidateDto, RenameComponent } from "../types";
import { buildAllPreviews } from "../utils/renamePreview";

interface AutoRenameTableProps {
  candidates: AutoRenameCandidateDto[];
  totalCandidates: number;
  prefixSearch: string;
  renameComponents: RenameComponent[];
  renameSeparator: string;
}

export default function AutoRenameTable({
  candidates,
  totalCandidates,
  prefixSearch,
  renameComponents,
  renameSeparator,
}: AutoRenameTableProps) {
  // Two-pass collision-aware preview names.
  const previews = useMemo(
    () => buildAllPreviews(candidates, renameComponents, renameSeparator),
    [candidates, renameComponents, renameSeparator],
  );

  function exportCsv() {
    const header = "Current Name,New Name,Path";
    const rows = candidates.map((c) => {
      const newName = previews.get(c.path) ?? c.name;
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return `${esc(c.name)},${esc(newName)},${esc(c.path)}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rename-plan.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Showing {candidates.length} of {totalCandidates} candidate file(s).
        </div>
        {candidates.length > 0 && (
          <button
            type="button"
            onClick={exportCsv}
            className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Export CSV
          </button>
        )}
      </div>
      <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left px-3 py-2">File</th>
              <th className="text-left px-3 py-2 text-blue-700 dark:text-blue-300">New name</th>
              <th className="text-left px-3 py-2 w-24">Type</th>
              <th className="text-left px-3 py-2 w-40">Modified</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400 dark:text-gray-500">
                  {prefixSearch
                    ? "No files match the prefix search filter."
                    : "No files matched the current scan filters."}
                </td>
              </tr>
            )}
            {candidates.map((candidate) => {
              const newName = previews.get(candidate.path) ?? candidate.name;
              const changed = newName !== candidate.name;
              return (
                <tr
                  key={candidate.path}
                  className="border-t border-gray-50 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  <td className="px-3 py-1 text-gray-700 dark:text-gray-300">{candidate.name}</td>
                  <td
                    className={`px-3 py-1 text-xs font-mono truncate max-w-xs ${
                      changed
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                    title={newName}
                  >
                    {newName}
                  </td>
                  <td className="px-3 py-1 text-gray-500 dark:text-gray-400 text-xs">
                    {candidate.extension || "(none)"}
                  </td>
                  <td className="px-3 py-1 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                    {candidate.mtime_formatted}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
