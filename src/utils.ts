import type { FileEntryDto } from "./types";

/**
 * Deterministic sort: newest first, with path as stable tiebreaker
 * for files with identical mtime.
 */
export function sortNewestFirst(files: FileEntryDto[]): FileEntryDto[] {
  return [...files].sort(
    (a, b) => b.mtime - a.mtime || a.path.localeCompare(b.path),
  );
}

/** Quick human-readable file size. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let i = -1;
  do {
    size /= 1024;
    i++;
  } while (size >= 1024 && i < units.length - 1);
  return `${size.toFixed(size < 10 ? 2 : size < 100 ? 1 : 0)} ${units[i]}`;
}

/** Build a lookup map of path → file size from scan groups. */
export function buildSizeMap(
  groups: { files: { path: string; size: number }[] }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const g of groups) {
    for (const f of g.files) {
      map.set(f.path, f.size);
    }
  }
  return map;
}
