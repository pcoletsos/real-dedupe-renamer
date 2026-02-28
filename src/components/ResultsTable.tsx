import { useMemo, useState } from "react";
import type { DuplicateGroup, FileEntryDto } from "../types";

type SortCol = "name" | "folder" | "modified" | "size";
type SortDir = "asc" | "desc";

interface ResultsTableProps {
  groups: DuplicateGroup[];
  selectedPaths: Set<string>;
  onSelectionChange: (paths: Set<string>) => void;
  filterText: string;
  onFilterChange: (text: string) => void;
  onOpenFolder: (path: string) => void;
  onDeleteSelected: () => void;
  onCopyReport: () => void;
  hasResults: boolean;
}

function matchesFilter(file: FileEntryDto, needle: string): boolean {
  const lower = needle.toLowerCase();
  return (
    file.name.toLowerCase().includes(lower) ||
    file.folder.toLowerCase().includes(lower)
  );
}

function sortFiles(
  files: FileEntryDto[],
  col: SortCol,
  dir: SortDir,
): FileEntryDto[] {
  const sorted = [...files];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (col) {
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, {
          sensitivity: "accent",
        });
        break;
      case "folder":
        cmp = a.folder.localeCompare(b.folder, undefined, {
          sensitivity: "accent",
        });
        break;
      case "modified":
        cmp = a.mtime - b.mtime;
        break;
      case "size":
        cmp = a.size - b.size;
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export default function ResultsTable({
  groups,
  selectedPaths,
  onSelectionChange,
  filterText,
  onFilterChange,
  onOpenFolder,
  onDeleteSelected,
  onCopyReport,
  hasResults,
}: ResultsTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(
    () => new Set(groups.map((_, i) => i)),
  );
  const [sortCol, setSortCol] = useState<SortCol>("modified");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filteredGroups = useMemo(() => {
    if (!filterText.trim()) return groups;
    return groups.filter((g) =>
      g.files.some((f) => matchesFilter(f, filterText)),
    );
  }, [groups, filterText]);

  const toggleGroup = (idx: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleFile = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    onSelectionChange(next);
  };

  const toggleGroupFiles = (files: FileEntryDto[]) => {
    const paths = files.map((f) => f.path);
    const allSelected = paths.every((p) => selectedPaths.has(p));
    const next = new Set(selectedPaths);
    if (allSelected) {
      paths.forEach((p) => next.delete(p));
    } else {
      paths.forEach((p) => next.add(p));
    }
    onSelectionChange(next);
  };

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const expandAll = () =>
    setExpandedGroups(new Set(filteredGroups.map((_, i) => i)));
  const collapseAll = () => setExpandedGroups(new Set());

  const selectedCount = selectedPaths.size;
  const affectedGroups = new Set(
    filteredGroups
      .filter((g) => g.files.some((f) => selectedPaths.has(f.path)))
      .map((_, i) => i),
  ).size;

  const sortArrow = (col: SortCol) => {
    if (sortCol !== col) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  if (!hasResults) return null;

  return (
    <div className="space-y-2">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-800/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete selected
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedCount} file(s) selected / {affectedGroups} group(s)
            affected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopyReport}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Copy report
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Collapse all
          </button>
          <button
            onClick={expandAll}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Expand all
          </button>
        </div>
      </div>

      {/* Filter */}
      <input
        type="text"
        value={filterText}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder="Filter by name or folder..."
        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-gray-100"
      />

      {/* Table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="w-8 px-2 py-2" />
              <th
                className="text-left px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                onClick={() => handleSort("name")}
              >
                File / Group{sortArrow("name")}
              </th>
              <th
                className="text-left px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                onClick={() => handleSort("folder")}
              >
                Folder / Criteria{sortArrow("folder")}
              </th>
              <th
                className="text-left px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none w-40"
                onClick={() => handleSort("modified")}
              >
                Modified{sortArrow("modified")}
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none w-24"
                onClick={() => handleSort("size")}
              >
                Size{sortArrow("size")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-400 dark:text-gray-500">
                  {filterText
                    ? "No groups match filter."
                    : "No duplicate groups."}
                </td>
              </tr>
            )}
            {filteredGroups.map((group, gi) => {
              const expanded = expandedGroups.has(gi);
              const groupPaths = group.files.map((f) => f.path);
              const allChecked = groupPaths.every((p) =>
                selectedPaths.has(p),
              );
              const someChecked =
                !allChecked && groupPaths.some((p) => selectedPaths.has(p));
              const sortedFiles = sortFiles(group.files, sortCol, sortDir);
              const exampleName = group.files[0]?.name ?? "?";

              return (
                <GroupRows
                  key={gi}
                  groupIndex={gi}
                  expanded={expanded}
                  allChecked={allChecked}
                  someChecked={someChecked}
                  exampleName={exampleName}
                  fileCount={group.files.length}
                  keyDescription={group.key_description}
                  files={sortedFiles}
                  selectedPaths={selectedPaths}
                  onToggleGroup={() => toggleGroup(gi)}
                  onToggleGroupFiles={() => toggleGroupFiles(group.files)}
                  onToggleFile={toggleFile}
                  onOpenFolder={onOpenFolder}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Extracted to keep the main component cleaner */
function GroupRows({
  expanded,
  allChecked,
  someChecked,
  exampleName,
  fileCount,
  keyDescription,
  files,
  selectedPaths,
  onToggleGroup,
  onToggleGroupFiles,
  onToggleFile,
  onOpenFolder,
}: {
  groupIndex: number;
  expanded: boolean;
  allChecked: boolean;
  someChecked: boolean;
  exampleName: string;
  fileCount: number;
  keyDescription: string;
  files: FileEntryDto[];
  selectedPaths: Set<string>;
  onToggleGroup: () => void;
  onToggleGroupFiles: () => void;
  onToggleFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
}) {
  return (
    <>
      {/* Group header row */}
      <tr className="bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
        <td className="px-2 py-1.5 text-center">
          <input
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = someChecked;
            }}
            onChange={onToggleGroupFiles}
            className="rounded"
          />
        </td>
        <td className="px-2 py-1.5 text-center">
          <button
            onClick={onToggleGroup}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xs w-4"
          >
            {expanded ? "\u25BC" : "\u25B6"}
          </button>
        </td>
        <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-gray-200">
          {exampleName}{" "}
          <span className="text-gray-400 dark:text-gray-500 font-normal">
            ({fileCount} copies)
          </span>
        </td>
        <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs">
          {keyDescription}
        </td>
        <td className="px-3 py-1.5" />
        <td className="px-3 py-1.5" />
      </tr>
      {/* File rows */}
      {expanded &&
        files.map((file) => (
          <tr
            key={file.path}
            className={`border-t border-gray-50 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-default ${
              selectedPaths.has(file.path) ? "bg-blue-50 dark:bg-blue-900/30" : ""
            }`}
            onDoubleClick={() => onOpenFolder(file.folder)}
          >
            <td className="px-2 py-1 text-center">
              <input
                type="checkbox"
                checked={selectedPaths.has(file.path)}
                onChange={() => onToggleFile(file.path)}
                className="rounded"
              />
            </td>
            <td className="px-2 py-1" />
            <td className="px-3 py-1 pl-8 text-gray-700 dark:text-gray-300">{file.name}</td>
            <td className="px-3 py-1 text-gray-500 dark:text-gray-400 text-xs truncate max-w-xs">
              {file.folder}
            </td>
            <td className="px-3 py-1 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
              {file.mtime_formatted}
            </td>
            <td className="px-3 py-1 text-right text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
              {file.size_human}
            </td>
          </tr>
        ))}
    </>
  );
}
