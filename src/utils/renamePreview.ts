/**
 * Frontend-only rename preview logic.
 *
 * Mirrors the Rust `build_name` logic so the UI can show per-file
 * "New name" previews without a round-trip to the backend.
 */

import type { AutoRenameCandidateDto, RenameComponent } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitize(input: string): string {
  return input.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim().replace(/^\.+|\.+$/g, "");
}

function padStart(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const mo = padStart(d.getMonth() + 1, 2);
  const day = padStart(d.getDate(), 2);
  return `${y}${mo}${day}`;
}

function fmtTime(d: Date): string {
  const h = padStart(d.getHours(), 2);
  const mi = padStart(d.getMinutes(), 2);
  const s = padStart(d.getSeconds(), 2);
  return `${h}${mi}${s}`;
}

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Build a single filename from schema components.
 *
 * @param components  Ordered list of rename components.
 * @param separator   Separator between parts.
 * @param folderName  Name of the parent folder.
 * @param originalStem File stem (name without extension).
 * @param extension   Extension including the leading dot (e.g. ".jpg"), or "".
 * @param createdDate Date object for file creation (or null).
 * @param modifiedDate Date object for file modification (or null).
 * @param seq         Sequence number (null → Sequence component is omitted).
 */
export function buildName(
  components: RenameComponent[],
  separator: string,
  folderName: string,
  originalStem: string,
  extension: string,
  createdDate: Date | null,
  modifiedDate: Date | null,
  seq: number | null,
): string {
  const now = new Date();
  const c = createdDate ?? now;
  const m = modifiedDate ?? now;

  const cDate = fmtDate(c);
  const cTime = fmtTime(c);
  const mDate = fmtDate(m);
  const mTime = fmtTime(m);

  const parts: string[] = [];

  for (const comp of components) {
    switch (comp.kind) {
      case "folder_name": {
        const s = sanitize(folderName);
        if (s) parts.push(s);
        break;
      }
      case "original_stem": {
        const s = sanitize(originalStem);
        if (s) parts.push(s);
        break;
      }
      case "date_created":
        parts.push(cDate);
        break;
      case "time_created":
        parts.push(cTime);
        break;
      case "date_modified":
        parts.push(mDate);
        break;
      case "time_modified":
        parts.push(mTime);
        break;
      case "literal": {
        const s = sanitize(comp.value ?? "");
        if (s) parts.push(s);
        break;
      }
      case "sequence":
        if (seq !== null) {
          parts.push(padStart(seq, comp.pad_width ?? 3));
        }
        // When seq is null, omit the sequence part (base-name pass).
        break;
    }
  }

  const stem = parts.length > 0 ? parts.join(separator) : sanitize(originalStem) || "file";
  return `${stem}${extension}`;
}

// ---------------------------------------------------------------------------
// Sample-based live preview (for the RenameComponentBuilder)
// ---------------------------------------------------------------------------

/**
 * Returns a sample filename built from placeholder metadata so the user can
 * see what the schema looks like without needing real files.
 */
export function buildPreview(components: RenameComponent[], separator: string): string {
  const sampleCreated = new Date(2024, 3, 15, 9, 30, 0); // 2024-04-15 09:30:00
  const sampleModified = new Date(2024, 5, 20, 14, 45, 0); // 2024-06-20 14:45:00
  return buildName(
    components,
    separator,
    "Downloads",
    "photo",
    ".jpg",
    sampleCreated,
    sampleModified,
    null, // no sequence in sample (unless Sequence component is present — then use 1)
  );
}

// ---------------------------------------------------------------------------
// Per-file preview
// ---------------------------------------------------------------------------

/**
 * Build the preview filename for a single candidate.
 *
 * @param seq `null` → base-name pass (Sequence omitted); `number` → with sequence.
 */
export function buildFilePreview(
  components: RenameComponent[],
  separator: string,
  candidate: AutoRenameCandidateDto,
  seq: number | null,
): string {
  // Derive folder name from the folder path.
  const folderName = candidate.folder.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "folder";

  // File stem = name without extension.
  const dotIdx = candidate.name.lastIndexOf(".");
  const originalStem =
    dotIdx > 0 ? candidate.name.slice(0, dotIdx) : candidate.name;

  const extension = candidate.extension.startsWith(".")
    ? candidate.extension
    : candidate.extension
    ? `.${candidate.extension}`
    : "";

  const createdDate = candidate.created > 0 ? new Date(candidate.created * 1000) : null;
  const modifiedDate = candidate.mtime > 0 ? new Date(candidate.mtime * 1000) : null;

  return buildName(
    components,
    separator,
    folderName,
    originalStem,
    extension,
    createdDate,
    modifiedDate,
    seq,
  );
}

// ---------------------------------------------------------------------------
// Two-pass collision-aware list preview
// ---------------------------------------------------------------------------

/**
 * Compute a collision-aware "new name" for every candidate in the list.
 *
 * Pass 1 — compute base names (seq = null, Sequence component omitted).
 * Pass 2 — for each base name that appears more than once, assign
 *           sequential numbers (1, 2, …) to each member of the collision
 *           group using the Sequence component.  If the schema has no
 *           Sequence component, all colliding files keep the same base name
 *           (the rename button will still work, but the backend will resolve
 *           collisions at rename time).
 *
 * Returns a `Map<path, newName>`.
 */
export function buildAllPreviews(
  candidates: AutoRenameCandidateDto[],
  components: RenameComponent[],
  separator: string,
): Map<string, string> {
  // Pass 1: base names.
  const baseNames = new Map<string, string>(); // path → base name
  for (const c of candidates) {
    baseNames.set(c.path, buildFilePreview(components, separator, c, null));
  }

  // Count occurrences of each base name.
  const counts = new Map<string, number>();
  for (const name of baseNames.values()) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  // Pass 2: assign sequential numbers only for colliding groups.
  const seqCounters = new Map<string, number>(); // baseName → next seq
  const result = new Map<string, string>(); // path → final name

  for (const c of candidates) {
    const base = baseNames.get(c.path)!;
    if ((counts.get(base) ?? 1) > 1) {
      const seq = (seqCounters.get(base) ?? 1);
      seqCounters.set(base, seq + 1);
      result.set(c.path, buildFilePreview(components, separator, c, seq));
    } else {
      result.set(c.path, base);
    }
  }

  return result;
}
