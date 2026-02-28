# Decisions

## D001 - Tkinter desktop UI in Python
Decision: Build the tool as a Tkinter GUI driven by a single Python script.
Context: The project targets a simple Windows-friendly desktop utility without heavyweight dependencies.
Options considered: CLI-only tool; alternative GUI frameworks (Qt, Electron); web UI.
Consequences: Minimal dependencies and easy packaging, but UI capabilities are limited to Tkinter widgets.

## D002 - SHA-256 based duplicate detection with optional criteria
Decision: Use SHA-256 content hashing plus optional size, name, and modified-time checks, with size bucketing to reduce hashing work.
Context: Need accurate duplicate detection while keeping scans fast on large directories.
Options considered: Hash-only; size-only; partial hashing; metadata-only checks.
Consequences: Accurate matches when hashing is on, with faster scans via size bucketing; large files may be skipped if the hash size cap is enabled.

## D003 - Local JSON settings file in the app working directory
Decision: Persist settings in `.duplicate_cleaner_settings.json` alongside the app.
Context: Keep user choices between runs and support both source and packaged EXE execution.
Options considered: OS-specific config directories; registry settings; no persistence.
Consequences: Easy to locate and bundle, but the file can contain user-specific paths and lives next to the executable.

## D004 - Safe deletion via send2trash with fallback
Decision: Prefer Recycle Bin/Trash deletion when `send2trash` is available, otherwise delete directly.
Context: Minimize the risk of accidental permanent deletions.
Options considered: Always hard delete; custom recycle implementation.
Consequences: Safer deletions when dependency is installed; behavior falls back to hard delete if missing.

## D005 - Windows distribution via PyInstaller one-file EXE
Decision: Package a windowed EXE using PyInstaller (`delete_real_duplicates.spec`).
Context: Users should be able to run the tool without installing Python.
Options considered: Source-only distribution; installer-based packaging.
Consequences: Large build artifacts and versioned EXEs tracked in `dist/`; documentation must stay aligned with build versions.

## D006 - Ignore runtime settings in git and ship a sanitized sample
Decision: Stop committing `.duplicate_cleaner_settings.json` and provide a sanitized `.duplicate_cleaner_settings.sample.json` for builds/releases.
Context: The committed settings files contained user-specific paths and should not ship in release artifacts.
Options considered: Keep a tracked settings file; move settings to an OS config directory; rely on defaults only.
Consequences: Runtime settings are untracked and recreated locally; builds include a safe template for reference.

## D007 - Rewrite in Rust + Tauri v2 for cross-platform modern UI
Decision: Rewrite the application using a Rust backend with a Tauri v2 shell and a web-based frontend (React or Svelte with HTML/CSS).
Context: The current Tkinter UI looks dated and is limited in customization. The project needs to run on both Windows and macOS with a modern look and fast performance. Binary size is not a primary concern; modern appearance and execution speed are the priorities.
Options considered:
- **Stay in Python, swap to CustomTkinter** — incremental improvement but still Tkinter under the hood, still needs PyInstaller, no meaningful speed gain.
- **C# + Avalonia** — native-feeling cross-platform UI, but less design flexibility than HTML/CSS and smaller ecosystem for modern component libraries.
- **Go + Wails** — webview-based like Tauri, simpler language than Rust, but Go's file I/O and hashing are not meaningfully faster than Rust, and the ecosystem is smaller.
- **TypeScript + Electron** — rich UI ecosystem, but ships a full Chromium (~80+ MB), high memory usage, and the JS backend offers no speed improvement over Python for file I/O.
- **Rust + Tauri v2** (chosen) — native OS webview (WebView2 on Windows, WebKit on macOS), full HTML/CSS/JS design freedom, Rust backend excels at file I/O and hashing (10-50x faster than Python for CPU/IO-bound work), small binary, no GC pauses.
Consequences: Steep initial learning curve for Rust. Two-language stack (Rust + JS/TS). Full UI rebuild required. However, the core logic is small (~200 lines) and straightforward to port. The result will be a genuinely modern, fast, cross-platform application.

## D008 - Extract core Python logic before rewriting
Decision: Before starting the Tauri rewrite, extract all business logic from `delete_real_duplicates.py` into a standalone `core.py` module with clean inputs/outputs, separate from Tkinter UI code.
Context: The current 1,900-line single file mixes business logic (scanning, hashing, grouping, deletion) with 1,650 lines of Tkinter UI code. This coupling makes it impossible to test the logic independently and makes the rewrite harder because a porter would need to untangle UI state from domain logic simultaneously.
Options considered:
- Rewrite directly from the monolith — risky, easy to miss edge cases buried in UI callbacks.
- Extract first, then rewrite — adds a step but produces a clear specification of what the Rust backend must do.
Consequences: Extra work in a codebase that will eventually be replaced, but the extracted module (a) is immediately valuable for testing and maintenance of the current Python version, (b) serves as a precise porting guide for the Rust rewrite, and (c) reduces risk of behavioral regressions during the rewrite.

## D009 - Add automated tests as the behavioral specification for the rewrite
Decision: Write unit tests against the extracted `core.py` module. These tests define the expected behavior that any future implementation (Python or Rust) must satisfy.
Context: The project currently has zero automated tests. Any refactor or rewrite carries regression risk. Tests written against the current Python logic become the acceptance criteria for the Rust port — if the Rust implementation passes equivalent test cases, it is behaviorally correct.
Options considered:
- No tests, rely on manual QA — too risky for a rewrite.
- Tests only after the Rust rewrite — the rewrite itself would have no safety net.
- Tests now against Python core (chosen) — provides immediate value and a porting spec.
Consequences: Test investment in Python is not wasted even though the codebase will be rewritten. The test cases (inputs, expected outputs, edge cases) transfer directly to Rust test files. Framework: pytest with temp directories for filesystem tests.

## D010 - Tauri v2 architecture: Rust commands + web frontend
Decision: Structure the Tauri v2 app with Rust backend commands and a reactive web frontend.
Context: Need a clean separation of concerns that maps naturally to Tauri's architecture.
Architecture:
```
src-tauri/                ← Rust backend (Tauri commands)
  src/
    main.rs               ← Tauri app entry point
    scanner.rs             ← Directory walking and file filtering
    hasher.rs              ← SHA-256 hashing with parallel execution (rayon)
    grouper.rs             ← Duplicate grouping by criteria
    deleter.rs             ← Trash/delete (trash crate for cross-platform recycle bin)
    settings.rs            ← JSON settings persistence

src/                      ← Web frontend (React or Svelte + Tailwind CSS)
  App.tsx / App.svelte
  components/
    ScanView              ← Folder picker, scan options, scan button
    ResultsTable          ← Sortable/filterable grouped results
    KeepChoiceDialog      ← Per-group keep/delete selection
    Settings              ← Preferences panel
```
The Rust backend exposes Tauri commands (`scan`, `delete`, `get_settings`, `save_settings`) that the frontend invokes asynchronously. The frontend contains zero business logic — it only renders state and dispatches user actions.
Options considered:
- Monolithic Rust file (mirroring current Python) — would repeat the same maintainability problem.
- Separate Rust crates — overkill for this project size.
- Module-per-concern in a single crate (chosen) — right-sized, easy to navigate.
Consequences: Clean separation from day one. Each Rust module can be tested independently. The frontend can be redesigned without touching backend logic.

## D011 - Tauri-forward development + GitHub Releases for binaries
Decision: Continue forward development on the Tauri stack, keep the Python app as a legacy build target, and publish all binaries via GitHub Releases instead of storing executables/archives in git.
Context: The repository now contains both a legacy Python app and a Tauri rewrite. Shipping binaries in the raw repository creates noise and repository bloat.
Options considered:
- Keep dual-stack active development in CI and docs.
- Remove Python entirely.
- Tauri-forward with legacy Python release compatibility (chosen).
Consequences: Mainline CI focuses on Tauri quality gates. Release automation builds and publishes both legacy Python and Tauri artifacts to GitHub Releases. Binary artifacts remain out of source control.
