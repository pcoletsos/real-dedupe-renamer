# Roadmap

## How to use this roadmap (for humans and agents)
- Pick one item, mark its status, and log intent in `docs/PROJECT_LOG.md` before coding.
- Keep changes small; stop early if scope grows and mark the item [Paused].
- If you abandon work, mark [Abandoned] with a short reason and any partial artifacts.
- When done, mark [Done] and add a brief result note (tests run, files touched).

Status tags: [Planned], [In Progress], [Paused], [Blocked], [Abandoned], [Done]

---

## Phase 1 — Stabilize the Python codebase (Now)

Goal: Make the current Python app modular, tested, and maintainable. This phase produces the behavioral specification that the Tauri rewrite must satisfy.

### Extract core module (D008)
- [Done] Extracted 9 core functions + `FileEntry` + `__version__` into `core.py`. `delete_real_duplicates.py` now imports from `core`. Files touched: `core.py` (new), `delete_real_duplicates.py` (modified). Result: 40 tests pass, app runs identically.

### Add automated tests (D009)
- [Done] Added 40 pytest tests in `tests/test_core.py` covering all core functions: `human_size`, `_sha256`, `_normalize_name`, `_safe_path_size`, `default_downloads_folder`, `gather_recent_files`, `find_duplicate_groups`, `delete_files`, `_describe_key`. All use `tmp_path` fixtures. Files touched: `tests/__init__.py` (new), `tests/test_core.py` (new).

### Add linting
- [Done] Added ruff linter via `pyproject.toml` (line-length 120, target py39, select E/W/F/I/UP/B/SIM/RUF). Fixed 127 violations including modernized type annotations and a latent bug (undefined `exc` in scan error handler). Files touched: `pyproject.toml` (new), `core.py`, `delete_real_duplicates.py`.

### Add CI pipeline
- [Done] Added GitHub Actions workflow: lint (ubuntu, py3.12) + test matrix (ubuntu+windows, py3.9–3.12). File: `.github/workflows/ci.yml` (new).

### Version string management
- [Done] `__version__` lives in `core.py`; `.spec` file reads it dynamically via `importlib.util`. Version bump now requires updating 2 places (`core.py` + `pyproject.toml`), down from 3. Files touched: `delete_real_duplicates.spec` (modified).

---

## Phase 2 — Tauri v2 rewrite (Next)

Goal: Rebuild the application as a Rust + Tauri v2 app with a modern web frontend. The Python tests from Phase 1 define the acceptance criteria. See D007 and D010 for architecture details.

### Scaffold Tauri v2 project
- [Done] Initialized Tauri v2 project with React + TypeScript + Tailwind CSS v4. Vite bundler, port 1420 dev server. Files: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, icons. Result: `npx tauri build --no-bundle` produces `real-dedupe-renamer.exe`.

### Port core logic to Rust
- [Done] Implemented 6 Rust modules matching `core.py` behavior: `types.rs` (FileEntry, CriterionValue, DTOs, human_size, describe_key), `scanner.rs` (safe_path_size, gather_recent_files), `hasher.rs` (sha256_file), `grouper.rs` (normalize_name, find_duplicate_groups with size bucketing), `deleter.rs` (delete_files with trash + fallback), `settings.rs` (AppSettings, load/save JSON). Crates: walkdir, sha2, rayon, trash, serde, chrono, directories, thiserror, open. 37 Rust tests pass. Files: `src-tauri/src/*.rs`.

### Build frontend UI
- [Done] Implemented React frontend with 6 components: ScanView (folder picker via tauri-plugin-dialog, days input, view mode toggle), SettingsPanel (criteria checkboxes, hash limit, subfolders, prefix, deletion behavior), ResultsTable (collapsible groups, sortable columns, checkbox multi-select, inline filter, copy report), KeepChoiceDialog (per-group radio buttons, KEEP/DELETE indicators, full-paths toggle, keep-newest shortcut), StatusBar (summary, notices, spinner), ConfirmDialog (reusable modal). Both Simplified and Advanced view modes work. TypeScript types match Rust DTOs. Files: `src/App.tsx`, `src/components/*.tsx`, `src/types.ts`, `src/api.ts`.

### Cross-platform CI
- [Done] Updated CI workflow with: Python lint + test (existing), Rust test matrix (ubuntu/windows/macos), frontend TypeScript check + Vite build, full Tauri build matrix (ubuntu/windows/macos, no-bundle). File: `.github/workflows/ci.yml`.

---

## Phase 3 — Post-rewrite enhancements (Later)

These items become feasible or easier after the Tauri rewrite.

- [Planned] Optional checks: MIME/type, media metadata, embedded checksums. User value: tighter duplicate detection without full hashing. Technical approach: Rust crates for MIME detection, image/audio metadata. Effort: L. Dependencies: Tauri rewrite complete. Risks: platform-specific edge cases.
- [Planned] Drag-and-drop folder selection. User value: faster folder picking. Technical approach: HTML5 drag-and-drop events in the frontend, pass path to Rust backend. Effort: S. Dependencies: Tauri frontend. Risks: none.
- [Planned] Dark mode support. User value: comfortable use in low-light environments. Technical approach: Tailwind dark mode classes, respect OS preference via `prefers-color-scheme`. Effort: S. Dependencies: Tauri frontend. Risks: none.
- [Planned] Progress reporting during scans. User value: see real-time file count and hashing progress. Technical approach: Tauri event system to stream progress from Rust to frontend. Effort: M. Dependencies: Tauri rewrite. Risks: none.

---

## Superseded Python-only items

The following items from the original roadmap are superseded by the Tauri rewrite plan:

- ~~Reduce scan memory when hashing is off~~ — will be addressed naturally in Rust with iterators and zero-copy patterns.
- ~~Faster traversal with `os.scandir`/`os.walk`~~ — Rust's `walkdir` crate is faster than any Python approach.
- ~~Optional hashing thread pool~~ — `rayon` parallelism in the Rust hasher replaces this.
- ~~Scrollable keep-choice dialog~~ — the web frontend has native scrolling; no special work needed.

---

## Pause / Abandon checklist
- Update the item status and add a short reason.
- Note any partial code paths and the next step needed to resume.
- Record commands/tests run in `docs/PROJECT_LOG.md`.
