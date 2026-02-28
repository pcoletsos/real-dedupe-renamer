# Codebase Analysis

> Generated: 2026-02-24 | Analyzer: Claude Code onboarding review
> Status: **Historical snapshot before the Tauri-first transition.**
> This document describes an earlier Python-centric state and is intentionally kept for project history.
> For current direction and release policy, see [README.md](../README.md).

## High-Level Architecture Summary

**Real Dedupe Renamer** is a single-file Python desktop application (monolith) that finds and removes duplicate files. It is a Tkinter GUI tool targeting Windows, packaged as a standalone `.exe` via PyInstaller.

- **Architecture style:** Monolith — all logic lives in one 1,889-line Python file (`delete_real_duplicates.py`). No modules, no packages, no tests, no build tooling beyond PyInstaller.
- **Runtime:** CPython 3.9+ with Tkinter (bundled in standard Python). Single external dependency: `send2trash>=1.8.0` (optional, for Recycle Bin deletion).

---

## Folder-by-Folder Breakdown

| Path | Purpose | Notes |
|---|---|---|
| `delete_real_duplicates.py` | **Entire application** — core logic + UI | 1,889 lines, 1 class (`DuplicateCleanerUI`) + ~10 standalone functions |
| `delete_real_duplicates.spec` | PyInstaller build config | One-file windowed EXE, bundles SVG asset |
| `requirements.txt` | Single dependency: `send2trash>=1.8.0` | Optional — app falls back to hard delete |
| `assets/` | Single SVG help icon (`help-circle-outline.svg`) | Bundled into EXE via spec `datas` |
| `dist/` | Current release EXE (v1.7.15, ~11 MB) + sample settings | Deployment artifact |
| `build/` | PyInstaller intermediate artifacts | Multiple `.pkg` files for recent versions; should be gitignored |
| `archive/` | **34 old versioned EXEs + 1 zip** (~357 MB) | Every historical release binary tracked in git |
| `docs/DECISIONS.md` | 6 architectural decision records | Clean and well-maintained |
| `docs/FEATURES.md` | Feature catalog with verification steps | Up to date with v1.7.15 |
| `docs/ROADMAP.md` | Roadmap with status tags | 5 planned items remain (tests, perf, refactoring) |
| `docs/PROJECT_LOG.md` | Detailed session-by-session work log | ~48 KB — extensive |
| `.duplicate_cleaner_settings.sample.json` | Sanitized sample config | Shipped in dist; runtime copy is gitignored |
| `release-<legacy-name>-v1.7.11.zip` | Old release zip in repo root (~11 MB) | Should be in `archive/` or removed |

---

## Entry Points and Execution Flow

1. **Entry point:** `delete_real_duplicates.py:1888` — `if __name__ == "__main__": main()`
2. `main()` creates a `tk.Tk()` root and instantiates `DuplicateCleanerUI`
3. `__init__` builds the full UI (styles, variables, layout), loads settings from JSON
4. **Scan flow:** `_scan()` -> spawns `_run_scan_thread()` on background thread -> calls `gather_recent_files()` + `find_duplicate_groups()` -> marshals results back via `root.after()` -> `_on_scan_complete()` -> renders results
5. **Delete flow:** Two paths — simplified mode (`_simplified_confirm_and_delete()`) auto-keeps newest; advanced mode (`_delete()`) shows keep-choice dialog (`_prompt_keep_choices()`) per group
6. **Settings:** Loaded from `.duplicate_cleaner_settings.json` at startup (`_load_settings()`), saved on every relevant change (`_save_settings()`)

---

## Key Technical Details

- **Duplicate detection:** SHA-256 content hash (streamed 1 MB chunks), with optional size/name/mtime criteria. Size-bucketing pre-filters before hashing.
- **Threading:** Background scan thread with `threading.Thread`; UI updates marshaled via `root.after()`. Shutdown flag prevents `TclError` on close.
- **Deletion safety:** Prefers `send2trash` (Recycle Bin), falls back to `Path.unlink()`. Full-group deletion requires explicit confirmation.
- **Settings path:** `Path.cwd() / ".duplicate_cleaner_settings.json"` — depends on working directory, not executable location.

---

## Risks and Technical Debt

### Critical

| # | Issue | Location |
|---|---|---|
| R1 | ~357 MB of binary artifacts tracked in git (`archive/` has 34 EXEs). Bloats repo, slows cloning. Should use GitHub Releases. | `archive/`, `dist/` |
| R2 | Zero automated tests. Core logic is testable but untested. Any refactor carries regression risk. | (missing) |
| R3 | Entire app in one 1,889-line file. UI class alone is ~1,650 lines with 60+ methods. | `delete_real_duplicates.py` |

### Moderate

| # | Issue | Location |
|---|---|---|
| R4 | `build/` directory tracked in git with intermediate PyInstaller artifacts. | `build/` |
| R5 | Stale release zip in repo root (v1.7.11, 11 MB) — inconsistent with `archive/` convention. | repo root |
| R6 | Settings path uses `Path.cwd()`, not executable directory. Breaks when launched from a shortcut or different working directory. | `delete_real_duplicates.py:23` |
| R7 | No CI/CD pipeline. Builds are manual PyInstaller runs. No linting, formatting, or automated releases. | (missing) |
| R8 | `_MEIPASS` resource path relies on PyInstaller internals. | `delete_real_duplicates.py:41` |

### Minor

| # | Issue | Location |
|---|---|---|
| R9 | `type: ignore` comments for `send2trash` and `_MEIPASS`. Acceptable but worth revisiting. | scattered |
| R10 | README has duplicate step numbering (two step 9s). | `README.md` |

---

## Missing Documentation

- No `CONTRIBUTING.md` or development setup instructions
- No build instructions (how to run PyInstaller, what Python version is expected)
- No changelog (PROJECT_LOG is a raw work log, not user-facing)
- No license explanation in docs (LICENSE file exists — MIT)

---

## Suggested Review Priority (for project owner)

1. **Repository hygiene:** Remove binaries from git history (or gitignore `archive/`, `build/`, root zip). Move releases to GitHub Releases.
2. **Read the single source file** — focus on `find_duplicate_groups()` (line 147), `_delete()` / `_simplified_confirm_and_delete()` (destructive paths), and `_run_scan_thread()` / `_on_scan_complete()` (threading model).
3. **Review the roadmap** (`docs/ROADMAP.md`) — highest-value planned items are automated tests and extracting core logic into a separate module.
4. **Settings path behavior** — decide if `Path.cwd()` is intentional or should be `Path(__file__).parent`.
5. **Build process** — document how to produce the EXE and consider a build script.
