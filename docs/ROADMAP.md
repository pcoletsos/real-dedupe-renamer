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
- [Planned] Extract core scan/grouping/delete logic into `core.py`. User value: better testability, simpler UI class, and a clear porting guide for the Rust rewrite. Technical approach: move `gather_recent_files`, `find_duplicate_groups`, `delete_files`, `_sha256`, `_normalize_name`, `_describe_key`, `human_size`, `_safe_path_size`, and `default_downloads_folder` into `core.py` with clean inputs/outputs; update `delete_real_duplicates.py` to import from `core`. Effort: M. Dependencies: none. Risks: refactor bugs — mitigate with manual testing before automated tests exist.

### Add automated tests (D009)
- [Planned] Add pytest tests for `core.py`. User value: prevent regressions and define the behavioral spec for the Rust rewrite. Technical approach: unit tests with temp directories for `gather_recent_files` (filtering by days, prefix, subfolders, error skipping), `find_duplicate_groups` (hash, size, name, mtime criteria, hash cap), and `delete_files` (send2trash and fallback paths). Effort: M. Dependencies: core module extraction. Risks: filesystem tests can be flaky — use `tmp_path` fixtures.

### Add linting
- [Planned] Add ruff linter with `pyproject.toml` config. User value: consistent code style, catch real bugs. Technical approach: add `pyproject.toml` with ruff rules, fix any existing violations. Effort: S. Dependencies: none. Risks: none.

### Add CI pipeline
- [Planned] Add GitHub Actions workflow: lint + test on push. User value: automated quality gate. Technical approach: single workflow file, runs ruff and pytest on Python 3.9+. Effort: S. Dependencies: tests and linting must exist first. Risks: none.

### Version string management
- [Planned] Wire `__version__` from `delete_real_duplicates.py` into the `.spec` file so there is one place to bump the version. User value: no more version drift between source and build config. Technical approach: read `__version__` in the spec file or use a shared constant. Effort: S. Dependencies: none. Risks: none.

---

## Phase 2 — Tauri v2 rewrite (Next)

Goal: Rebuild the application as a Rust + Tauri v2 app with a modern web frontend. The Python tests from Phase 1 define the acceptance criteria. See D007 and D010 for architecture details.

### Scaffold Tauri v2 project
- [Planned] Initialize a Tauri v2 project with the chosen frontend framework (React or Svelte) and Tailwind CSS. User value: project skeleton ready for development. Technical approach: `npm create tauri-app`, configure Tailwind, verify dev build on Windows and macOS. Effort: S. Dependencies: Phase 1 completed (need the behavioral spec). Risks: Tauri v2 toolchain setup on both platforms.

### Port core logic to Rust
- [Planned] Implement `scanner.rs`, `hasher.rs`, `grouper.rs`, `deleter.rs`, `settings.rs` matching the behavior of `core.py`. User value: fast, correct backend. Technical approach: port each function using `walkdir` for traversal, `sha2` or `ring` for hashing, `rayon` for parallel hashing, and the `trash` crate for cross-platform recycle bin. Effort: L. Dependencies: Tauri scaffold. Risks: behavioral differences in edge cases — verify against Python test cases.
  - Key Rust crates: `walkdir`, `sha2`, `rayon`, `trash`, `serde` + `serde_json` (settings).
  - Parallel hashing within size buckets replaces the Python roadmap item "optional hashing thread pool" — it comes naturally with `rayon`.

### Build frontend UI
- [Planned] Implement the scan view, results table, keep-choice dialog, and settings panel. User value: modern, responsive, cross-platform UI. Technical approach: React or Svelte components with Tailwind CSS; call Rust backend via Tauri `invoke()` commands; support both Simplified and Advanced view modes. Effort: L. Dependencies: Rust backend commands available. Risks: UI/UX iteration may take multiple rounds.
  - The results table should support: sortable columns, collapsible groups, inline filtering, multi-select, right-click context menu.
  - The keep-choice dialog should support: per-row KEEP/DELETE indicators, show/hide full paths toggle, "Keep newest in all groups" shortcut.
  - Scrollable keep-choice dialog for large duplicate sets (replaces the Python roadmap item for this).

### Cross-platform packaging and release
- [Planned] Configure Tauri builds for Windows (.msi/.exe) and macOS (.dmg/.app). User value: native installers for both platforms. Technical approach: Tauri's built-in bundler, GitHub Actions for CI/CD release builds. Effort: M. Dependencies: frontend and backend complete. Risks: code signing requirements on macOS.

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
