import type { AutoRenameCandidateDto } from "../types";

interface AutoRenameTableProps {
  candidates: AutoRenameCandidateDto[];
  totalCandidates: number;
  prefixSearch: string;
}

export default function AutoRenameTable({
  candidates,
  totalCandidates,
  prefixSearch,
}: AutoRenameTableProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Showing {candidates.length} of {totalCandidates} candidate file(s).
      </div>
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2">File</th>
              <th className="text-left px-3 py-2">Folder</th>
              <th className="text-left px-3 py-2 w-24">Type</th>
              <th className="text-left px-3 py-2 w-40">Modified</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
                  {prefixSearch
                    ? "No files match the prefix search filter."
                    : "No files matched the current scan filters."}
                </td>
              </tr>
            )}
            {candidates.map((candidate) => (
              <tr
                key={candidate.path}
                className="border-t border-gray-50 hover:bg-blue-50"
              >
                <td className="px-3 py-1 text-gray-700">{candidate.name}</td>
                <td className="px-3 py-1 text-gray-500 text-xs truncate max-w-xs">
                  {candidate.folder}
                </td>
                <td className="px-3 py-1 text-gray-500 text-xs">
                  {candidate.extension || "(none)"}
                </td>
                <td className="px-3 py-1 text-gray-500 text-xs whitespace-nowrap">
                  {candidate.mtime_formatted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
