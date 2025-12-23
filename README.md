# Delete Real Duplicates

Desktop utility to find and remove real duplicate files with a guided UI. It groups duplicates, lets you choose which copy to keep, and can auto-skip prompts when duplicates live in the same folder.

## Latest build
- Windows executable (no Python needed): `dist/delete_real_duplicates-1.7.2.exe`  
  Built from the current codebase (PyInstaller one-file, windowed). Run it directly or share the EXE.

## Run options
1) **Executable:** double-click `dist/delete_real_duplicates-1.7.2.exe` (or run from a terminal).
2) **Source (Python 3.9+):**
   ```bash
   python -m pip install -r requirements.txt  # installs optional send2trash
   python delete_real_duplicates.py
   ```

## Core features (v1.7.2)
- Duplicate criteria toggles: content hash (SHA-256), size, file name, modified time.
- View modes: Simplified (default) hides advanced controls, uses fixed defaults, and auto-deletes after confirmation with a Review in Advanced option; Advanced shows the full results table.
- Hash size cap: optionally skip hashing very large files while still comparing them with other checks.
- Same-folder fast path: if all copies are in one folder, auto-keep the newest and skip the keep-choice dialog.
- Keep-choice dialog: per-row KEEP/DELETE status column with legend, plus a toggle to show full path + filename (folders only by default).
- Results table: sortable columns, collapsible groups, filter by name/folder, double-click to open a file’s folder, right-click to copy a row/group.
- Delete selected: multi-select rows in the results table; selecting a group row auto-selects its child files; full-group selections warn before deleting all copies.
- Reports/exports: copy the full report to clipboard or export CSV.
- UI gating: copy/export/collapse/expand and filter enable only when results exist.
- Progress: Scan button shows animated progress during scans.
- Action cues: delete buttons are tinted red, and Scan uses a magnifying glass with a green tint.
- Settings persistence: last folder, days, criteria, hash limit, same-folder toggle, and keep-dialog display preference saved to `.duplicate_cleaner_settings.json`.
- Help menu: “How to use” and “Optional checks” explain hashing, criteria, and tips.
- Dialogs center on the app window for confirmations/errors/info.

## UI guide
1) **View mode:** choose Simplified (quick clean) or Advanced (full controls + results table).
2) **Folder:** choose a folder (defaults to Downloads).
3) **Days back:** limit to recently modified files. Presets: `all`, `week (7)`, `month (30)`.
4) **Duplicate checks:** enable Hash + Size for accuracy; add Name/Modified time for stricter matching; adjust/disable the hash size cap if needed.
5) **Same-folder skip:** when on, groups whose duplicates all share a folder auto-keep the newest copy; only mixed-folder groups prompt.
6) **Scan:** click Scan; the button animates while working.
7) **Review results table (Advanced):**
   - Sort by clicking headers (sort order persists after scans/filters).
   - Filter box narrows by name or folder substring.
   - Collapse/Expand all for large result sets.
   - Double-click a file row to open its folder.
   - Right-click a row/group to copy it.
   - Selecting a group row also selects all child file rows.
8) **Delete duplicates:**
   - Simplified: confirm the auto-delete prompt; choose Review in Advanced to inspect.
   - Use "Delete selected" (button or right-click) to remove only highlighted rows; full-group selections warn before deleting all copies.
   - Delete actions are tinted red to reinforce destructive actions.
   - Keep-choice dialog per group unless auto-skipped by same-folder mode.
   - Status column shows KEEP/DELETE per row; the legend explains how selections map to deletions.
   - Use "Show full path + filename" if you need filenames; otherwise the dialog shows folders only.
   - "Keep newest in all groups" shortcut speeds selection.
   - Confirmation shows file count and estimated space freed.
   - Deletions go to Recycle Bin when `send2trash` is available; otherwise, files are removed directly.
9) **Reports/Exports:**
   - "Copy report" puts a text summary on the clipboard.
   - "Export CSV" saves file, folder, modified, size (bytes/human), and criteria.

## Notes
- Content hash reads the whole file; size is a cheap prefilter. Accuracy can drop if you enable the hash size cap because large files are compared without hashes.
- Settings file: `.duplicate_cleaner_settings.json` lives alongside the app.
- Built for Windows; Tkinter is bundled in the EXE. Running from source requires Tkinter (included with standard Python installers).***
