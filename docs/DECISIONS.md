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
