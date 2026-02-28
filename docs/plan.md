# Phase 3 Implementation Plan

## 1. Drag-and-Drop Folder Selection (Small)

**Approach:** Use Tauri v2's `onDragDropEvent` from `@tauri-apps/api/webview` — the standard HTML5 drag/drop API doesn't expose file system paths in a Tauri webview.

### Frontend changes:
- **`src/App.tsx`**: Listen for drag-drop events from `getCurrentWebview().onDragDropEvent()` at the app level. On `drop` event with a directory path, call `updateSetting("folder", path)`. Track drag state (`isDragging`) to show visual feedback.
- **`src/components/ScanView.tsx`**: Accept `isDragging` prop. When true, show a blue-highlighted drop overlay on the folder input area with "Drop folder here" text.

No backend changes needed.

---

## 2. Dark Mode Support (Small)

**Approach:** Class-based dark mode with Tailwind v4. Support three modes: light, dark, system (follows OS preference).

### Backend changes:
- **`src-tauri/src/settings.rs`**: Add `theme: String` field to `AppSettings` (default: `"system"`).

### Frontend changes:
- **`src/types.ts`**: Add `theme: "light" | "dark" | "system"` to `AppSettings`.
- **`src/App.tsx`**: Add `DEFAULT_SETTINGS.theme = "system"`. On mount and when `settings.theme` changes, compute effective theme (light/dark) and toggle `dark` class on `<html>`. Listen to `matchMedia('(prefers-color-scheme: dark)')` for system mode.
- **`src/index.css`**: Add Tailwind v4 dark mode config: `@custom-variant dark (&:where(.dark, .dark *));`. Add dark color variables/overrides.
- **Header in `App.tsx`**: Add a theme toggle button (sun/moon icon) cycling light → dark → system.
- **All components**: Add `dark:` variants to background, text, and border classes:
  - `bg-gray-50` → also `dark:bg-gray-900`
  - `bg-white` → also `dark:bg-gray-800`
  - `text-gray-900` → also `dark:text-gray-100`
  - `text-gray-700` → also `dark:text-gray-300`
  - `text-gray-500` → also `dark:text-gray-400`
  - `border-gray-200` → also `dark:border-gray-700`
  - `border-gray-300` → also `dark:border-gray-600`
  - And similar for colored elements (red, green, blue, amber)

Components to update: `ScanView`, `SettingsPanel`, `StatusBar`, `ResultsTable`, `ConfirmDialog`, `KeepChoiceDialog`, `AutoRenamerPanel`, `AutoRenameStatus`, `AutoRenameTable`, `App.tsx` main container.

---

## 3. Progress Reporting During Scans (Medium)

**Approach:** Use Tauri's event system to emit progress events from Rust to the frontend during scans. Two phases: file discovery (scanning) and file hashing (grouping).

### Backend changes:
- **`src-tauri/src/types.rs`**: Add `ScanProgress` struct:
  ```rust
  pub struct ScanProgress {
      pub phase: String,         // "scanning" | "hashing"
      pub current: usize,
      pub total: usize,          // 0 if unknown
      pub message: String,       // e.g., "Scanning files..." or "Hashing file 5 of 20"
  }
  ```
- **`src-tauri/src/commands.rs`**: Change `cmd_scan` signature to accept `app: tauri::AppHandle`. Pass it into scanner and grouper functions. Emit `"scan-progress"` events at intervals.
- **`src-tauri/src/scanner.rs`**: Add optional progress callback parameter to `gather_recent_files`. Emit progress every ~100 files or every 200ms.
- **`src-tauri/src/grouper.rs`**: Add optional progress callback parameter to `find_duplicate_groups`. Emit progress for each file being hashed.

### Frontend changes:
- **`src/types.ts`**: Add `ScanProgress` interface.
- **`src/App.tsx`**: During scan, listen for `"scan-progress"` events using `listen()` from `@tauri-apps/api/event`. Store progress state. Unlisten on scan completion.
- **`src/components/StatusBar.tsx`**: Accept optional `progress` prop. When scanning and progress is available, show a progress bar with phase label and count (e.g., "Hashing 5 / 20 files...").

---

## 4. Optional MIME-Type Duplicate Check (Large)

**Approach:** Use the `infer` crate to detect file type by reading magic bytes (file header), not extension. This provides a "same content type" grouping criterion.

### Backend changes:
- **`src-tauri/Cargo.toml`**: Add `infer = "0.16"` dependency.
- **`src-tauri/src/types.rs`**: Add `CriterionValue::MimeType(String)` variant. Update `describe_key` to handle it (e.g., `"mime image/jpeg"`).
- **`src-tauri/src/grouper.rs`**: Add `use_mime: bool` parameter to `find_duplicate_groups`. When enabled, read first 8KB of each file, detect MIME type with `infer::get()`, and add to grouping key. Fallback: use `"unknown"` if detection fails.
- **`src-tauri/src/commands.rs`**: Add `use_mime: bool` parameter to `cmd_scan`, pass through to grouper.
- **`src-tauri/src/settings.rs`**: Add `use_mime: bool` field (default: `false`).

### Frontend changes:
- **`src/types.ts`**: Add `use_mime: boolean` to `AppSettings` and `ScanParams`.
- **`src/App.tsx`**: Add `use_mime: false` to `DEFAULT_SETTINGS`. Pass through in scan call.
- **`src/components/SettingsPanel.tsx`**: Add "MIME type" checkbox alongside existing criteria checkboxes.
- **`src/api.ts`**: Add `use_mime` to scan parameters.

---

## Implementation Order

1. **Dark mode** — touches all components so do it first to avoid rework
2. **Drag-and-drop** — small, self-contained
3. **Progress reporting** — medium, spans backend and frontend
4. **MIME-type check** — largest, backend-heavy

## Files Changed Summary

| File | Features |
|------|----------|
| `src-tauri/Cargo.toml` | MIME (infer crate) |
| `src-tauri/src/types.rs` | Progress, MIME |
| `src-tauri/src/commands.rs` | Progress, MIME |
| `src-tauri/src/scanner.rs` | Progress |
| `src-tauri/src/grouper.rs` | Progress, MIME |
| `src-tauri/src/settings.rs` | Dark mode, MIME |
| `src/types.ts` | Dark mode, Progress, MIME |
| `src/api.ts` | MIME |
| `src/App.tsx` | All four features |
| `src/index.css` | Dark mode |
| `src/components/ScanView.tsx` | Drag-and-drop, Dark mode |
| `src/components/SettingsPanel.tsx` | MIME, Dark mode |
| `src/components/StatusBar.tsx` | Progress, Dark mode |
| `src/components/ResultsTable.tsx` | Dark mode |
| `src/components/ConfirmDialog.tsx` | Dark mode |
| `src/components/KeepChoiceDialog.tsx` | Dark mode |
| `src/components/AutoRenamerPanel.tsx` | Dark mode |
| `src/components/AutoRenameStatus.tsx` | Dark mode |
| `src/components/AutoRenameTable.tsx` | Dark mode |
