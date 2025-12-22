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
