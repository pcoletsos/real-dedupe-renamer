# Phase 4 Implementation Plan

## Goal

Upgrade the Auto-Renamer with two new sections:

1. **Filters** — expanded controls for narrowing which files are candidates
2. **Rename Components** — a drag-and-drop builder that lets the user choose and order the parts that make up the new filename

---

## Current Behaviour (baseline)

The rename pattern is hardcoded in `autorenamer.rs`:

```
{sanitized_folder_name}_{YYYYMMDD_HHMMSS}_{seq:03}.{ext}
```

The timestamp already comes from the file's own `created` / `modified` metadata (fixed in Phase 3 bugfix). The sequence number prevents collisions within a batch.

---

## 1. Expanded Filters Section

### What to add (frontend only, no backend changes)

The existing Filters fieldset in `AutoRenamerPanel` already has:
- Prefix search (filters displayed candidates by filename prefix)
- File type preset dropdown

Add two more rows:

| Control | Description |
|---------|-------------|
| **Extensions** | Comma-separated extension allow-list, e.g. `mp4, mov, avi`. Empty = all extensions. |
| **Min size / Max size** | Optional numeric inputs (MB). Leave blank to skip that bound. |

These are frontend-only post-scan filters applied to `candidates` before display and before rename — no new backend params needed (the candidate list is already fetched; we just filter it in JS before passing paths to `cmd_auto_rename`).

### State additions in `App.tsx`

```ts
extensionFilter: string     // raw comma-separated input, e.g. "mp4, mov"
minSizeMb: string           // empty string or numeric string
maxSizeMb: string           // empty string or numeric string
```

### Filter logic (pure JS in `App.tsx` or `AutoRenameTable.tsx`)

```ts
function applyFilters(candidates: AutoRenameCandidateDto[]): AutoRenameCandidateDto[] {
  let result = candidates;

  // existing prefix search
  if (prefixSearch) result = result.filter(c => c.name.toLowerCase().startsWith(prefixSearch.toLowerCase()));

  // new: extension allow-list
  const exts = extensionFilter.split(',').map(e => e.trim().toLowerCase().replace(/^\./, '')).filter(Boolean);
  if (exts.length > 0) result = result.filter(c => exts.includes(c.extension.replace(/^\./, '').toLowerCase()));

  // new: size bounds (need size on AutoRenameCandidateDto — see backend change below)
  if (minSizeMb) result = result.filter(c => c.size >= parseFloat(minSizeMb) * 1024 * 1024);
  if (maxSizeMb) result = result.filter(c => c.size <= parseFloat(maxSizeMb) * 1024 * 1024);

  return result;
}
```

### Backend change for size filter

`AutoRenameCandidateDto` in `src-tauri/src/types.rs` is missing `size`. Add:

```rust
pub struct AutoRenameCandidateDto {
    pub path: String,
    pub name: String,
    pub folder: String,
    pub extension: String,
    pub size: u64,          // ← add
    pub mtime: f64,
    pub mtime_formatted: String,
    pub created: f64,       // ← add: Unix seconds from file creation time (0 if unavailable)
}
```

`created` is needed by the rename component system (see section 2).

In `commands.rs` `scan_auto_rename_blocking`, populate both fields:

```rust
let size = entry.size;
let created = std::fs::metadata(&entry.path)
    .and_then(|m| m.created())
    .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs_f64())
    .unwrap_or(0.0);

AutoRenameCandidateDto { path, name, folder, extension, size, mtime: entry.mtime, mtime_formatted, created }
```

Add `size: number` and `created: number` to `AutoRenameCandidateDto` in `src/types.ts`.

---

## 2. Rename Components Builder

### Component types

```ts
type RenameComponentKind =
  | "folder_name"    // parent folder name (sanitized)
  | "date_created"   // YYYYMMDD from file creation time
  | "date_modified"  // YYYYMMDD from last modified time
  | "time_created"   // HHMMSS from file creation time
  | "time_modified"  // HHMMSS from last modified time
  | "sequence"       // zero-padded sequence: 001, 002…
  | "original_stem"  // original filename without extension
  | "literal";       // fixed user-supplied text

interface RenameComponent {
  id: string;                  // uuid-style key for React (nanoid or crypto.randomUUID)
  kind: RenameComponentKind;
  value?: string;              // only used for "literal"
  pad_width?: number;          // only used for "sequence" (default 3)
}
```

Extension is always appended last — it is not a component.

### Default component list (mirrors current hardcoded behaviour)

```ts
const DEFAULT_RENAME_COMPONENTS: RenameComponent[] = [
  { id: "1", kind: "folder_name" },
  { id: "2", kind: "date_created" },
  { id: "3", kind: "time_created" },
  { id: "4", kind: "sequence", pad_width: 3 },
];
```

Separator between components: configurable string, default `"_"`.

### Persisting to settings

Add to `AppSettings` (both `src/types.ts` and `src-tauri/src/settings.rs`):

```ts
rename_components: RenameComponent[];
rename_separator: string;
```

```rust
pub rename_components: serde_json::Value,  // stored as opaque JSON blob
pub rename_separator: String,
```

Using `serde_json::Value` on the Rust side avoids duplicating the full enum in Rust — the component building happens entirely in Rust but the schema is passed in as JSON from the frontend each time `cmd_auto_rename` is called. Rust deserializes it at rename time.

### Frontend: `RenameComponentBuilder` component

New file: `src/components/RenameComponentBuilder.tsx`

**Layout:**

```
┌─ Rename Components ──────────────────────────────────────────────────────┐
│  Separator: [_____]                                                       │
│                                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ ≡ Folder name│ │ ≡ Date cre.. │ │ ≡ Time cre.. │ │ ≡ Sequence   │   │
│  │            × │ │            × │ │            × │ │  pad: [3]  × │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                          [+ Add…  ▼]     │
│                                                                           │
│  Preview: Downloads_20251126_095312_001.mp4                               │
└───────────────────────────────────────────────────────────────────────────┘
```

- Components are displayed as horizontal **chips** in a flex-wrap row.
- Each chip has a drag handle (`≡`) on the left and a remove button (`×`) on the right.
- Chips with sub-options (sequence `pad_width`, literal `value`) show a small inline input.
- **Drag-and-drop reorder**: use HTML5 native drag API (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) — this is purely within the webview so no Tauri involvement is needed.
- **Add button**: opens a small dropdown listing available component types not yet present (or always listed for types that can appear multiple times: `literal`).
- **Live preview**: computed from the component list + separator using a sample file (folder = "Downloads", created = today, sequence = 1, original stem = "IMG_1234"). Updates instantly on every change.

### Drag-and-drop implementation (HTML5)

```tsx
// State
const [dragIndex, setDragIndex] = useState<number | null>(null);

// On each chip:
<div
  draggable
  onDragStart={() => setDragIndex(i)}
  onDragOver={(e) => { e.preventDefault(); }}
  onDrop={() => {
    if (dragIndex === null || dragIndex === i) return;
    const reordered = [...components];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(i, 0, moved);
    onChange(reordered);
    setDragIndex(null);
  }}
>
```

No external drag-and-drop library needed.

### Backend: component-based renaming

**`src-tauri/src/types.rs`** — add `RenameSchema`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameSchema {
    pub components: Vec<RenameComponentDef>,
    pub separator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RenameComponentDef {
    FolderName,
    DateCreated,
    DateModified,
    TimeCreated,
    TimeModified,
    Sequence { pad_width: usize },
    OriginalStem,
    Literal { value: String },
}
```

**`src-tauri/src/autorenamer.rs`** — replace hardcoded pattern:

- Change `auto_rename_paths(paths)` → `auto_rename_paths(paths, schema: &RenameSchema)`
- In the per-file loop, build the name by iterating `schema.components`:

```rust
fn build_name(
    schema: &RenameSchema,
    folder_name: &str,
    original_stem: &str,
    extension: &str,
    created: Option<chrono::DateTime<chrono::Local>>,
    modified: Option<chrono::DateTime<chrono::Local>>,
    seq: u32,
) -> String {
    let sep = &schema.separator;
    let parts: Vec<String> = schema.components.iter().map(|c| match c {
        RenameComponentDef::FolderName        => sanitize_filename_component(folder_name),
        RenameComponentDef::DateCreated       => created.unwrap_or_else(chrono::Local::now).format("%Y%m%d").to_string(),
        RenameComponentDef::DateModified      => modified.unwrap_or_else(chrono::Local::now).format("%Y%m%d").to_string(),
        RenameComponentDef::TimeCreated       => created.unwrap_or_else(chrono::Local::now).format("%H%M%S").to_string(),
        RenameComponentDef::TimeModified      => modified.unwrap_or_else(chrono::Local::now).format("%H%M%S").to_string(),
        RenameComponentDef::Sequence { pad_width } => format!("{:0>width$}", seq, width = pad_width),
        RenameComponentDef::OriginalStem      => sanitize_filename_component(original_stem),
        RenameComponentDef::Literal { value } => sanitize_filename_component(value),
    }).collect();
    format!("{}{}", parts.join(sep), extension)
}
```

#### Sequence component: collision-only behaviour

The `Sequence` component must **not** be appended to every file. It is only inserted into the name when needed to break a collision. Algorithm:

1. Build the candidate name with `seq = None` (skip the `Sequence` component entirely).
2. Check if that name is taken (exists on disk OR already in `reserved_targets`).
3. If **not** taken → use the name as-is (no sequence suffix at all).
4. If **taken** → rebuild the name with the `Sequence` component included, starting at `seq = 1`, incrementing until a free slot is found.

```rust
// First: try without sequence
let base_name = build_name(schema, folder_name, original_stem, extension,
                            created, modified, None);
let base_candidate = parent.join(&base_name);

let target = if base_candidate != *source
    && !base_candidate.exists()
    && !reserved_targets.contains(&base_candidate)
{
    base_candidate   // unique — no sequence needed
} else {
    // Collision: find a free slot with sequence suffix
    let mut seq = 1u32;
    loop {
        let name = build_name(schema, folder_name, original_stem, extension,
                               created, modified, Some(seq));
        seq += 1;
        let candidate = parent.join(&name);
        if candidate == *source { continue; }
        if !candidate.exists() && !reserved_targets.contains(&candidate) {
            break candidate;
        }
    }
};
```

`build_name` gains an `Option<u32>` for seq and skips `Sequence` components when it is `None`:

```rust
RenameComponentDef::Sequence { pad_width } => match seq {
    Some(n) => format!("{:0>width$}", n, width = pad_width),
    None    => String::new(),   // omitted; filtered out by parts.retain(|p| !p.is_empty())
},
```

- Test helper `auto_rename_paths_with_timestamp` is retired; tests replaced with schema-based equivalents.

**`src-tauri/src/commands.rs`** — update `cmd_auto_rename`:

```rust
#[tauri::command(rename_all = "snake_case")]
pub async fn cmd_auto_rename(
    paths: Vec<String>,
    rename_schema: RenameSchema,
) -> Result<AutoRenameResult, String> { ... }
```

### Preview computation (frontend, pure TS)

```ts
function buildPreview(components: RenameComponent[], separator: string): string {
  const sample = {
    folder_name: "Downloads",
    date_created: "20251126",
    date_modified: "20251126",
    time_created: "095312",
    time_modified: "095312",
    sequence: (n: number) => String(n).padStart(3, "0"),
    original_stem: "IMG_1234",
  };

  const parts = components.map((c) => {
    switch (c.kind) {
      case "folder_name":    return sample.folder_name;
      case "date_created":   return sample.date_created;
      case "date_modified":  return sample.date_modified;
      case "time_created":   return sample.time_created;
      case "time_modified":  return sample.time_modified;
      case "sequence":       return sample.sequence(1);
      case "original_stem":  return sample.original_stem;
      case "literal":        return c.value ?? "";
      default:               return "";
    }
  });
  return parts.filter(Boolean).join(separator) + ".mp4";
}
```

---

## 3. Per-File Rename Preview in the Candidates Table

Each row in `AutoRenameTable` shows a **"New name"** column so the user can see exactly what each file will be renamed to before clicking Rename.

### How it works

Because sequence numbers are only appended on collision, the preview must use a **two-pass** approach over the whole filtered list:

1. **Pass 1** — compute base names (no sequence) for every candidate.
2. **Pass 2** — find which base names collide. For colliding groups, assign sequence numbers (1, 2, 3…) in list order.

A `buildAllPreviews(candidates, components, separator): string[]` function returns one preview name per candidate in the same order.

The per-file helper used internally:

```ts
function buildFilePreview(
  components: RenameComponent[],
  separator: string,
  candidate: AutoRenameCandidateDto,
  seq: number | null,                  // null = omit sequence component
): string {
  const createdDt  = new Date(candidate.created * 1000);
  const modifiedDt = new Date(candidate.mtime   * 1000);

  const pad = (d: Date) => ({
    date: d.getFullYear().toString()
      + String(d.getMonth() + 1).padStart(2, "0")
      + String(d.getDate()).padStart(2, "0"),
    time: String(d.getHours()).padStart(2, "0")
      + String(d.getMinutes()).padStart(2, "0")
      + String(d.getSeconds()).padStart(2, "0"),
  });

  const created  = pad(createdDt);
  const modified = pad(modifiedDt);
  const folderName = candidate.folder.split(/[\\/]/).pop() ?? "folder";
  const originalStem = candidate.name.replace(/\.[^.]+$/, "");

  const parts = components.map((c) => {
    switch (c.kind) {
      case "folder_name":   return folderName;
      case "date_created":  return created.date;
      case "date_modified": return modified.date;
      case "time_created":  return created.time;
      case "time_modified": return modified.time;
      case "sequence":      return seq !== null ? String(seq).padStart(c.pad_width ?? 3, "0") : "";
      case "original_stem": return originalStem;
      case "literal":       return c.value ?? "";
      default:              return "";
    }
  });

  return parts.filter(Boolean).join(separator) + candidate.extension;
}

// Two-pass preview for the whole list — mirrors backend collision logic.
function buildAllPreviews(
  candidates: AutoRenameCandidateDto[],
  components: RenameComponent[],
  separator: string,
): string[] {
  // Pass 1: base names (no sequence)
  const bases = candidates.map((c) => buildFilePreview(components, separator, c, null));

  // Pass 2: find collisions and assign sequence numbers
  const counts = new Map<string, number>();
  bases.forEach((b) => counts.set(b, (counts.get(b) ?? 0) + 1));

  const seqCounters = new Map<string, number>();
  return bases.map((base, i) => {
    if ((counts.get(base) ?? 0) <= 1) return base;    // unique — no sequence
    const n = (seqCounters.get(base) ?? 0) + 1;
    seqCounters.set(base, n);
    return buildFilePreview(components, separator, candidates[i], n);
  });
}
```

### `AutoRenameTable` changes

- Accept two extra props: `renameComponents: RenameComponent[]` and `renameSeparator: string`
- Compute `const previews = buildAllPreviews(candidates, renameComponents, renameSeparator)` once
- Use `previews[index]` for each row
- Add a **"New name"** column between "File" and "Folder":

```
| File (current) | New name       | Folder | Type | Modified |
|----------------|----------------|--------|------|----------|
| IMG_1234.mp4   | Downloads_20251126_095312_001.mp4 | C:\… | .mp4 | … |
```

- Render the new name in a muted blue so it's visually distinct from the current name:
  `className="text-blue-600 dark:text-blue-400 text-xs font-mono"`

### Caveat (add as footnote in the UI)

Sequence numbers are only shown when two or more files in the current list would produce the same name. The actual rename may use a different sequence number if a file with that name already exists on disk. All other components are exact.

### No backend changes needed

`buildFilePreview` runs entirely in the frontend using the `created` and `mtime` fields already planned in section 1.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src-tauri/src/types.rs` | Add `RenameSchema`, `RenameComponentDef`; add `size` + `created` to `AutoRenameCandidateDto` |
| `src-tauri/src/autorenamer.rs` | Replace hardcoded pattern with schema-driven `build_name`; accept `RenameSchema` param; update tests |
| `src-tauri/src/commands.rs` | Add `rename_schema: RenameSchema` to `cmd_auto_rename`; populate `size`+`created` in `scan_auto_rename_blocking` |
| `src-tauri/src/settings.rs` | Add `rename_components: serde_json::Value`, `rename_separator: String` |
| `src/types.ts` | Add `RenameComponent`, `RenameComponentKind`, `RenameSchema`; add `size`+`created` to `AutoRenameCandidateDto`; add fields to `AppSettings` |
| `src/App.tsx` | Add `extensionFilter`, `minSizeMb`, `maxSizeMb` state; add rename component state; wire to `AutoRenamerPanel` and `cmd_auto_rename` |
| `src/components/AutoRenamerPanel.tsx` | Expand Filters fieldset with extension + size rows; add `RenameComponentBuilder` below filters |
| `src/components/RenameComponentBuilder.tsx` | New component: separator input, draggable chips, add dropdown, live preview |
| `src/components/AutoRenameTable.tsx` | Add "New name" column with per-file preview; show `size_human` column; accept filtered list and rename schema props |
| `src/utils/renamePreview.ts` | New file: `buildPreview` (sample), `buildFilePreview` (per-file, seq optional), `buildAllPreviews` (two-pass collision-aware list) |

---

## Implementation Order

1. **Backend types + DTO** — add `size`/`created` to `AutoRenameCandidateDto`, add `RenameSchema`/`RenameComponentDef` to `types.rs`
2. **Backend autorenamer** — schema-driven `build_name`, update `cmd_auto_rename` signature, update tests
3. **Frontend types** — add all new TS types and settings fields
4. **`src/utils/renamePreview.ts`** — `buildPreview` + `buildFilePreview` pure functions
5. **`RenameComponentBuilder` component** — chips, drag-and-drop, uses `buildPreview`
6. **`AutoRenameTable` update** — "New name" column using `buildFilePreview`
7. **`AutoRenamerPanel` filters expansion** — extension + size inputs
8. **`App.tsx` wiring** — state, defaults, pass-through to commands and table
9. **Verify** — `cargo test`, `cargo check`, `tsc --noEmit`
