# Project Log

## 2025-11-28
Date: 2025-11-28
User-facing changes:
- Initial Tkinter desktop UI to scan for duplicate files with hash/size/name/mtime criteria, days-back filtering, and a keep/delete workflow.
Internal changes:
- Added core Python app, README, requirements (optional send2trash), .gitignore, and LICENSE.
- Implemented SHA-256 hashing with size bucketing for duplicate grouping.
Commits/areas touched:
- `8e51edc` chore: initial import (`delete_real_duplicates.py`, `README.md`, `requirements.txt`, `.gitignore`)
- `d805fbe` Initial commit (`LICENSE`)
- `54ee353` Merge main into master (merge commit)
Confidence: [High]
Notes / Decisions:
- Chose Tkinter for a lightweight GUI and a single-script architecture.
- Duplicate detection centers on SHA-256 hashing plus optional size/name/mtime criteria.

## 2025-11-29
Date: 2025-11-29
User-facing changes:
- UI upgraded to a results table with grouping, sorting, filtering, and collapse/expand actions.
- Added copy report, CSV export, right-click copy of rows/groups, and a scan-progress spinner.
- Added settings persistence and a "skip keep-choice dialog for same-folder duplicates" toggle.
- Windows executable build artifacts added.
Internal changes:
- Refactored UI structure and introduced a Treeview-based results pane.
- Added PyInstaller spec and build outputs in `build/` and `dist/`.
Commits/areas touched:
- `660e40b` refactor + PyInstaller build (`delete_real_duplicates.py`, `delete_real_duplicates.spec`, `build/`, `dist/`)
- `b413b3c` settings management and UI enhancements (`delete_real_duplicates.py`, `.duplicate_cleaner_settings.json`)
Confidence: [High]
Notes / Decisions:
- Persist settings in `.duplicate_cleaner_settings.json` alongside the app.
- Distribute Windows builds via PyInstaller one-file, windowed EXE.

## 2025-11-30
Date: 2025-11-30
User-facing changes:
- Error/confirmation dialogs refined with consistent UI feedback.
- Added rename-kept-files option with timestamped pattern and setting persistence.
- Release artifacts updated and README pointed to v1.1.0 EXE/zip.
Internal changes:
- Build artifacts updated to ensure JSON module support for packaged app.
- Release zip added and later renamed to include version.
- Commit message "Implement feature X" corresponds to a release zip only; no source diff found.
Commits/areas touched:
- `17491c9` refactor error handling/UI feedback (`delete_real_duplicates.py`)
- `4c64c56` build/README updates for JSON module (`README.md`, `build/`, `dist/`)
- `8023106` release zip added (`release-delete-real-duplicates.zip`)
- `50ee637` rename release artifacts + README tweak (`README.md`, `dist/`, `release-delete-real-duplicates-v1.1.0.zip`)
- `04bf597` rename-kept feature + settings path update (`delete_real_duplicates.py`, `.duplicate_cleaner_settings.json`)
- `dfb363f` persist rename_kept_enabled setting (`.duplicate_cleaner_settings.json`)
Confidence: [Medium]
Notes / Decisions:
- Kept-file renaming uses `name_YYYY-MM-DD_HH-MM-SS_###.ext` for uniqueness.

## 2025-12-03
Date: 2025-12-03
User-facing changes:
- Added scan scope controls: name prefix filter and include subfolders toggle.
- Added recent-folder dropdown history for faster folder selection.
Internal changes:
- Expanded settings persistence to store name prefix, include-subfolders, and recent folders.
Commits/areas touched:
- `c279106` scan options + settings updates (`delete_real_duplicates.py`, `.duplicate_cleaner_settings.json`)
Confidence: [High]

## 2025-12-04
Date: 2025-12-04
User-facing changes:
- Added "Clear history" for recent folders.
- New packaged build artifacts labeled 1.2.0.
Internal changes:
- Refactor pass plus PyInstaller spec/build updates; settings file adjustments.
Commits/areas touched:
- `41e360f` refactor + build artifacts (`delete_real_duplicates.py`, `delete_real_duplicates.spec`, `build/`, `dist/`, `.duplicate_cleaner_settings.json`)
Confidence: [Medium]

## 2025-12-10
Date: 2025-12-10
User-facing changes:
- New packaged build artifacts labeled 1.3.0.
Internal changes:
- Refactor pass with updated build outputs and a settings file in `dist/`.
Commits/areas touched:
- `2cab631` refactor + build artifacts (`delete_real_duplicates.spec`, `build/`, `dist/`, `.duplicate_cleaner_settings.json`)
Confidence: [Medium]

## 2025-12-22
Date: 2025-12-22
Intent:
- Align README and release artifacts for 1.4.0, archive older builds, and build a new EXE after merge.
Status: Done
User-facing changes:
- README now references the 1.4.0 EXE and current artifact layout.
Internal changes:
- Archived older release artifacts, updated the PyInstaller spec name, and built the 1.4.0 EXE.
Files touched:
- `README.md`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`, `dist/`, `archive/`, `build/`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start)
Date: 2025-12-23
Intent:
- Decide how to handle committed `.duplicate_cleaner_settings.json` files and replace them with a sanitized sample.
Status: In Progress
Planned files:
- `.gitignore`, `.duplicate_cleaner_settings.json`, `dist/.duplicate_cleaner_settings.json`, `.duplicate_cleaner_settings.sample.json`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/DECISIONS.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done)
Date: 2025-12-23
Intent:
- Decide how to handle committed `.duplicate_cleaner_settings.json` files and replace them with a sanitized sample.
Status: Done
User-facing changes:
- None (repo hygiene only).
Internal changes:
- Stopped tracking runtime settings, added a sanitized sample, and documented the decision.
Files touched:
- `.gitignore`, `.duplicate_cleaner_settings.sample.json`, `dist/.duplicate_cleaner_settings.sample.json`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/DECISIONS.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.4.4)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.4.4 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.4.4 EXE, and archived the 1.4.3 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.4.4.exe`, `archive/delete_real_duplicates-1.4.3.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Release 1.4.1)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.4.1 executable and core features header.
Internal changes:
- Updated PyInstaller spec name, built the 1.4.1 EXE, and archived the 1.4.0 artifact.
Files touched:
- `README.md`, `delete_real_duplicates.spec`, `dist/delete_real_duplicates-1.4.1.exe`, `archive/delete_real_duplicates-1.4.0.exe`
- `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Hash size cap behavior)
Date: 2025-12-23
Intent:
- Improve hash size cap behavior so large files still group by non-hash criteria with clear messaging.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/FEATURES.md`
- `README.md`, `delete_real_duplicates.spec`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Hash size cap behavior)
Date: 2025-12-23
Intent:
- Improve hash size cap behavior so large files still group by non-hash criteria with clear messaging.
Status: Done
User-facing changes:
- Large files above the hash cap now still group by size/name/mtime, and the scan summary explains the fallback.
Internal changes:
- Hash cap no longer drops files from grouping; UI/help text updated to clarify hash-skipped behavior.
Files touched:
- `delete_real_duplicates.py`, `README.md`, `docs/FEATURES.md`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.4.2)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.4.2 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.4.2 EXE, and archived the 1.4.1 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.4.2.exe`, `archive/delete_real_duplicates-1.4.1.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Scan error handling)
Date: 2025-12-23
Intent:
- Make `gather_recent_files` resilient to per-file `OSError` failures, track skipped files, and show the skipped count in the scan summary.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/FEATURES.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Scan error handling)
Date: 2025-12-23
Intent:
- Make `gather_recent_files` resilient to per-file `OSError` failures, track skipped files, and show the skipped count in the scan summary.
Status: Done
User-facing changes:
- Scans skip unreadable files without failing, and the scan summary reports how many were skipped.
Internal changes:
- `gather_recent_files` counts per-file `OSError` skips and the UI summary includes the skipped count.
Files touched:
- `delete_real_duplicates.py`, `docs/FEATURES.md`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.4.3)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.4.3 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.4.3 EXE, and archived the 1.4.2 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.4.3.exe`, `archive/delete_real_duplicates-1.4.2.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - mtime precision)
Date: 2025-12-23
Intent:
- Improve modified time matching precision when used as a criterion.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/FEATURES.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - mtime precision)
Date: 2025-12-23
Intent:
- Improve modified time matching precision when used as a criterion.
Status: Done
User-facing changes:
- Modified-time matching uses full timestamp precision to avoid false positives from sub-second differences.
Internal changes:
- Grouping keys now use the full `mtime` float instead of truncating to seconds.
Files touched:
- `delete_real_duplicates.py`, `docs/FEATURES.md`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Start - Visual keep/delete indicators)
Date: 2025-12-23
Intent:
- Add a status column and legend to the keep-choice dialog to clarify keep vs delete.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/FEATURES.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Visual keep/delete indicators)
Date: 2025-12-23
Intent:
- Add a status column and legend to the keep-choice dialog to clarify keep vs delete.
Status: Done
User-facing changes:
- Keep-choice dialog shows a KEEP/DELETE status column and legend synced to the selection.
Internal changes:
- Dialog layout now uses a two-column grid per group to display status labels alongside radio choices.
Files touched:
- `delete_real_duplicates.py`, `docs/FEATURES.md`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.4.5)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.4.5 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.4.5 EXE, and archived the 1.4.4 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.4.5.exe`, `archive/delete_real_duplicates-1.4.4.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Keep-choice dialog hides filenames)
Date: 2025-12-23
Intent:
- Hide filenames in the keep-choice dialog by default, add a dialog-only toggle to show full paths, and persist the setting.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/FEATURES.md`
- `README.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Keep-choice dialog hides filenames)
Date: 2025-12-23
Intent:
- Hide filenames in the keep-choice dialog by default, add a dialog-only toggle to show full paths, and persist the setting.
Status: Done
User-facing changes:
- Keep-choice dialog now defaults to folder-only display with a toggle to show full path + filename; the setting persists.
Internal changes:
- Stored a new keep-dialog display preference in settings and updated dialog rendering.
Files touched:
- `delete_real_duplicates.py`, `docs/FEATURES.md`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.4.6)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.4.6 executable and document the keep-dialog path toggle.
Internal changes:
- Updated the PyInstaller spec name, built the 1.4.6 EXE, and archived the 1.4.5 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.4.6.exe`, `archive/delete_real_duplicates-1.4.5.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Delete selected workflow)
Date: 2025-12-23
Intent:
- Add in-table multi-select with a Delete selected workflow, including selection counts and full-group safety confirm.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/FEATURES.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Delete selected workflow)
Date: 2025-12-23
Intent:
- Add in-table multi-select with a Delete selected workflow, including selection counts and full-group safety confirm.
Status: Done
User-facing changes:
- Results table supports multi-select with Delete selected actions, a selection count indicator, and a full-group delete warning.
Internal changes:
- Added selection tracking and a delete-selected flow that respects rename-kept behavior.
Files touched:
- `delete_real_duplicates.py`, `docs/FEATURES.md`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.5.0)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.5.0 executable and document Delete selected.
Internal changes:
- Updated the PyInstaller spec name, built the 1.5.0 EXE, and archived the 1.4.6 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.5.0.exe`, `archive/delete_real_duplicates-1.4.6.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Release 1.6.0)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.6.0 executable and document group selection + action button cues.
Internal changes:
- Updated the PyInstaller spec name, built the 1.6.0 EXE, and archived the 1.5.0 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.6.0.exe`, `archive/delete_real_duplicates-1.5.0.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Selection + button tint cues)
Date: 2025-12-23
Intent:
- Auto-select child rows when a group row is selected, tint delete buttons red, and add a magnifying glass + green tint to Scan.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/FEATURES.md`
- `README.md`, `delete_real_duplicates.spec`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Selection + button tint cues)
Date: 2025-12-23
Intent:
- Auto-select child rows when a group row is selected, tint delete buttons red, and add a magnifying glass + green tint to Scan.
Status: Done
User-facing changes:
- Group selection now auto-selects child file rows, delete actions are tinted red, and Scan shows a magnifying glass with a green tint.
Internal changes:
- Selection change handler expands group selections and button styles map to delete/scan actions.
Files touched:
- `delete_real_duplicates.py`, `docs/FEATURES.md`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Start - UI layout audit + optimization)
Date: 2025-12-23
Intent:
- Audit the main window layout for alignment, consistent button sizing, and a stable message area for long summaries.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - UI layout audit + optimization)
Date: 2025-12-23
Intent:
- Audit the main window layout for alignment, consistent button sizing, and a stable message area for long summaries.
Status: Done
User-facing changes:
- Standardized button widths, added a fixed-height status area with wrapped summary/notice text, and tightened spacing in the main window.
Internal changes:
- Summary text shortened to avoid overly long messages; message area now updates wrap length on resize.
Files touched:
- `delete_real_duplicates.py`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.6.1)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.6.1 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.6.1 EXE, and archived the 1.6.0 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.6.1.exe`, `archive/delete_real_duplicates-1.6.0.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - UI layout audit follow-up)
Date: 2025-12-23
Intent:
- Improve the main window status area, restore scan time in the summary, and remove the Scan emoji.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - UI layout audit follow-up)
Date: 2025-12-23
Intent:
- Improve the main window status area, restore scan time in the summary, and remove the Scan emoji.
Status: Done
User-facing changes:
- Status area is now a labeled panel with wrapped text, scan time is restored, and Scan no longer uses emoji.
Internal changes:
- Repositioned the selection count into the action row to reduce dead space.
Files touched:
- `delete_real_duplicates.py`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.6.2)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.6.2 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.6.2 EXE, and archived the 1.6.1 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.6.2.exe`, `archive/delete_real_duplicates-1.6.1.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Folder row spacing)
Date: 2025-12-23
Intent:
- Tighten the folder row layout so the path dropdown leaves room for Browse/Clear history and removes empty space beneath.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Folder row spacing)
Date: 2025-12-23
Intent:
- Tighten the folder row layout so the path dropdown leaves room for Browse/Clear history and removes empty space beneath.
Status: Done
User-facing changes:
- Folder selector row now uses a single right-side action cluster and a narrower path dropdown to avoid empty space.
Internal changes:
- Removed the extra grid column created by separate Browse/Clear history placement.
Files touched:
- `delete_real_duplicates.py`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.6.3)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.6.3 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.6.3 EXE, and archived the 1.6.2 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.6.3.exe`, `archive/delete_real_duplicates-1.6.2.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Full-group confirm dialog layout)
Date: 2025-12-23
Intent:
- Optimize the "All Copies Selected" dialog layout to reduce empty space and tighten wrapping.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Full-group confirm dialog layout)
Date: 2025-12-23
Intent:
- Optimize the "All Copies Selected" dialog layout to reduce empty space and tighten wrapping.
Status: Done
User-facing changes:
- Full-group delete confirmation now uses a tighter, labeled layout with wrapped group names to reduce empty space.
Internal changes:
- Added a dedicated dialog layout for the full-group confirmation flow.
Files touched:
- `delete_real_duplicates.py`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.6.4)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.6.4 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.6.4 EXE, and archived the 1.6.3 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.6.4.exe`, `archive/delete_real_duplicates-1.6.3.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Full-group dialog buttons)
Date: 2025-12-23
Intent:
- Align the full-group confirm dialog buttons to the same height, move review/cancel to the left, and reduce button emphasis.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Full-group dialog buttons)
Date: 2025-12-23
Intent:
- Align the full-group confirm dialog buttons to the same height, move review/cancel to the left, and reduce button emphasis.
Status: Done
User-facing changes:
- Full-group confirm dialog buttons now share the same height and font size, with Review on the left and Delete on the right.
Internal changes:
- Added dialog-specific button styles for consistent sizing.
Files touched:
- `delete_real_duplicates.py`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.6.5)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.6.5 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.6.5 EXE, and archived the 1.6.4 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.6.5.exe`, `archive/delete_real_duplicates-1.6.4.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Roadmap update - simplified view task)
Date: 2025-12-23
Intent:
- Add a planned roadmap item for a simplified view alternative with safe defaults.
Status: Done
User-facing changes:
- None (planning entry only).
Internal changes:
- Added a new planned item for a simplified view/advanced view split.
Files touched:
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.6.6)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.6.6 executable and core features header.
Internal changes:
- Updated the PyInstaller spec name, built the 1.6.6 EXE, and archived the 1.6.5 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `dist/delete_real_duplicates-1.6.6.exe`, `archive/delete_real_duplicates-1.6.5.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Simplified view)
Date: 2025-12-23
Intent:
- Add a simplified view mode with fixed defaults, auto-keep newest, and a final confirmation before deleting.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `README.md`, `docs/FEATURES.md`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Simplified view)
Date: 2025-12-23
Intent:
- Add a simplified view mode with fixed defaults, auto-keep newest, and a final confirmation before deleting.
Status: Done
User-facing changes:
- Added a view toggle with a simplified mode that applies fixed defaults, hides advanced controls, and confirms auto-delete with a Review in Advanced option.
Internal changes:
- Persisted view mode in settings and added a simplified auto-delete flow that keeps the newest file per group.
Files touched:
- `delete_real_duplicates.py`, `.duplicate_cleaner_settings.sample.json`, `dist/.duplicate_cleaner_settings.sample.json`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`, `docs/FEATURES.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.7.0)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.7.0 executable and document the simplified view.
Internal changes:
- Updated PyInstaller spec name, built the 1.7.0 EXE, and archived the 1.6.6 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `build/`, `dist/delete_real_duplicates-1.7.0.exe`, `archive/delete_real_duplicates-1.6.6.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Confirm delete cancel placement)
Date: 2025-12-23
Intent:
- Move the confirm-delete Cancel button to the bottom-left for clearer safe action placement.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Confirm delete cancel placement)
Date: 2025-12-23
Intent:
- Move the confirm-delete Cancel button to the bottom-left for clearer safe action placement.
Status: Done
User-facing changes:
- Confirm delete dialogs now show Cancel on the left to emphasize the safe action.
Internal changes:
- Updated modal dialog button layout to align Cancel left and destructive actions right.
Files touched:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.7.1)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.7.1 executable.
Internal changes:
- Updated PyInstaller spec name, built the 1.7.1 EXE, and archived the 1.7.0 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `build/`, `dist/delete_real_duplicates-1.7.1.exe`, `archive/delete_real_duplicates-1.7.0.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Simplified confirm dialog layout)
Date: 2025-12-23
Intent:
- Move Cancel to the bottom-left and place Review in Advanced below the primary buttons in the simplified confirm dialog.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Simplified confirm dialog layout)
Date: 2025-12-23
Intent:
- Move Cancel to the bottom-left and place Review in Advanced below the primary buttons in the simplified confirm dialog.
Status: Done
User-facing changes:
- Simplified confirm dialog now separates Review in Advanced into its own row and keeps Cancel on the left.
Internal changes:
- Added a dedicated simplified confirm dialog layout.
Files touched:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.7.2)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.7.2 executable.
Internal changes:
- Updated PyInstaller spec name, built the 1.7.2 EXE, and archived the 1.7.1 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `build/`, `dist/delete_real_duplicates-1.7.2.exe`, `archive/delete_real_duplicates-1.7.1.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Status box border continuity)
Date: 2025-12-23
Intent:
- Fix the status box border line discontinuity in the main window.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Status box border continuity)
Date: 2025-12-23
Intent:
- Fix the status box border line discontinuity in the main window.
Status: Done
User-facing changes:
- Status panel now shows a continuous border without breaks.
Internal changes:
- Replaced the status label frame with a framed box to keep borders continuous.
Files touched:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.7.3)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.7.3 executable.
Internal changes:
- Updated PyInstaller spec name, built the 1.7.3 EXE, and archived the 1.7.2 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `build/`, `dist/delete_real_duplicates-1.7.3.exe`, `archive/delete_real_duplicates-1.7.2.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Help access without menu bar)
Date: 2025-12-23
Intent:
- Provide access to Help without the menubar to reduce wasted vertical space.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `README.md`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Help access without menu bar)
Date: 2025-12-23
Intent:
- Provide access to Help without the menubar to reduce wasted vertical space.
Status: Done
User-facing changes:
- Added a Help button that opens How to use and Optional checks without a menu bar.
Internal changes:
- Removed the menubar wiring and added a help popup menu near the View toggle.
Files touched:
- `delete_real_duplicates.py`, `README.md`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.7.4)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.7.4 executable.
Internal changes:
- Updated PyInstaller spec name, built the 1.7.4 EXE, and archived the 1.7.3 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `build/`, `dist/delete_real_duplicates-1.7.4.exe`, `archive/delete_real_duplicates-1.7.3.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Discreet help icon)
Date: 2025-12-23
Intent:
- Replace the Help button with a question-mark icon aligned to the top-right.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `README.md`, `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Discreet help icon)
Date: 2025-12-23
Intent:
- Replace the Help button with a question-mark icon aligned to the top-right.
Status: Done
User-facing changes:
- Help access now uses a ? icon in the top-right.
Internal changes:
- Updated the help button label and docs to reflect the icon.
Files touched:
- `delete_real_duplicates.py`, `README.md`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.

## 2025-12-23 (Release 1.7.5)
Date: 2025-12-23
Intent:
- Bump release references and rebuild the Windows EXE after merging to main.
Status: Done
User-facing changes:
- Updated README to point at the 1.7.5 executable.
Internal changes:
- Updated PyInstaller spec name, built the 1.7.5 EXE, and archived the 1.7.4 artifact.
Files touched:
- `README.md`, `docs/FEATURES.md`, `delete_real_duplicates.spec`
- `build/`, `dist/delete_real_duplicates-1.7.5.exe`, `archive/delete_real_duplicates-1.7.4.exe`, `docs/PROJECT_LOG.md`
Tests:
- `python -m PyInstaller delete_real_duplicates.spec`

## 2025-12-23 (Start - Help icon top-right)
Date: 2025-12-23
Intent:
- Move the help ? icon to the top-right and make it a minimal link-style control.
Status: In Progress
Planned files:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run (start entry).

## 2025-12-23 (Done - Help icon top-right)
Date: 2025-12-23
Intent:
- Move the help ? icon to the top-right and make it a minimal link-style control.
Status: Done
User-facing changes:
- Help icon is now a small top-right link instead of a full button beside view controls.
Internal changes:
- Added a header row to host the help icon and adjusted layout rows.
Files touched:
- `delete_real_duplicates.py`
- `docs/ROADMAP.md`, `docs/PROJECT_LOG.md`
Tests:
- Not run.
