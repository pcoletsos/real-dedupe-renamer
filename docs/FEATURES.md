# Features

## Scanning and Matching

### Duplicate criteria toggles (hash, size, name, modified time)
- Description: Find duplicates by selectable criteria, including SHA-256 content hashing.
- Where: `delete_real_duplicates.py`
- Status: Done
- How to verify: Run a scan on a folder with known duplicates and toggle criteria to see group changes.

### Scan scope controls (days back, include subfolders, name prefix)
- Description: Limit scans by modified time window, recurse or not into subfolders, and optionally require a filename prefix.
- Where: `delete_real_duplicates.py`
- Status: Done
- How to verify: Set Days to 0 vs 7, toggle Include subfolders, and set a name prefix, then compare results.

### Hash size cap
- Description: Skip hashing files above a configurable size limit while still grouping them by other enabled criteria, and report a warning.
- Where: `delete_real_duplicates.py`
- Status: Done
- How to verify: Set a small hash limit and scan a folder with larger files; confirm the summary warns and large files still group by size/name/mtime.

## Results and Review

### Grouped results table with sorting and filtering
- Description: Treeview-based results show duplicate groups, support sorting by columns, filtering by name/folder, and collapse/expand all.
- Where: `delete_real_duplicates.py`
- Status: Done
- How to verify: Run a scan, sort columns, apply a filter, and collapse/expand groups.

### Reports and clipboard actions
- Description: Copy a text report, export CSV, and copy individual rows or groups via right-click; double-click opens the file's folder.
- Where: `delete_real_duplicates.py`
- Status: Done
- How to verify: After a scan, use Copy report, Export CSV, right-click Copy row/group, and double-click a file row.

## Deletion and Safety

### Keep-choice workflow with same-folder auto-keep
- Description: Prompts for a keep choice per group with a "Keep newest in all groups" shortcut; optionally auto-keeps newest when all duplicates share a folder.
- Where: `delete_real_duplicates.py`
- Status: Done
- How to verify: Scan duplicates, click Delete duplicates, and test the dialog and same-folder toggle.

### Safe delete with optional renaming
- Description: Deletes to Recycle Bin when send2trash is installed, falls back to direct delete, and can rename kept files to a timestamped pattern.
- Where: `delete_real_duplicates.py`, `requirements.txt`
- Status: Done (send2trash optional)
- How to verify: Install `send2trash`, enable rename, delete duplicates in a test folder, and verify recycle/rename behavior.

## Settings and Persistence

### Persistent settings and recent folders
- Description: Saves scan options, toggles, and recent folders in a JSON settings file alongside the app.
- Where: `delete_real_duplicates.py`, `.duplicate_cleaner_settings.json`
- Status: Done
- How to verify: Change settings, close and reopen the app, and inspect the JSON file.

## Help and Guidance

### In-app help dialogs
- Description: Help menu offers "How to use" and "Optional checks" guidance.
- Where: `delete_real_duplicates.py`
- Status: Done
- How to verify: Open the Help menu and read both dialogs.

## Distribution

### Windows executable packaging
- Description: PyInstaller spec and the current versioned EXE are committed in `dist/`, with older artifacts archived.
- Where: `delete_real_duplicates.spec`, `dist/delete_real_duplicates-1.4.2.exe`, `archive/`
- Status: Done
- How to verify: Run `dist/delete_real_duplicates-1.4.2.exe` or `python delete_real_duplicates.py`.
