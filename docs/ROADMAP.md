# Roadmap

## How to use this roadmap (for humans and agents)
- Pick one item, mark its status, and log intent in `docs/PROJECT_LOG.md` before coding.
- Keep changes small; stop early if scope grows and mark the item [Paused].
- If you abandon work, mark [Abandoned] with a short reason and any partial artifacts.
- When done, mark [Done] and add a brief result note (tests run, files touched).

Status tags: [Planned], [In Progress], [Paused], [Blocked], [Abandoned], [Done]

## Now
- [Done] Align README and release artifacts (README references v1.1.0 while `dist/` contains 1.2.0/1.3.0). User value: accurate install/run guidance. Technical approach: update README, pick the current EXE/zip naming, and archive or remove older artifacts. Effort: S. Dependencies: decide the target version. Risks: removing files that users still rely on. Result: README now points to 1.4.0, older artifacts archived, new EXE built.
- [Done] Decide how to handle `.duplicate_cleaner_settings.json` files committed in repo and `dist/`. User value: avoid shipping user-specific paths and keep the repo clean. Technical approach: add runtime settings to `.gitignore` and provide a sanitized sample config for builds. Effort: S. Dependencies: packaging workflow agreement. Risks: builds may expect the committed settings file. Result: removed tracked settings files, added a sanitized sample, ignored runtime settings; Tests: not run.
- [Done] Hash size cap behavior for large files. User value: avoid silently skipping duplicates when hashing is capped. Technical approach: when size > cap, still group by non-hash criteria (size/name/mtime) or report skipped files in the UI. Effort: S. Dependencies: decision on desired behavior. Risks: slower scans if fallback grouping is enabled. Result: large files skip hashing but still group by other selected criteria with clearer UI messaging.
- [Done] Scan error handling in `gather_recent_files`. User value: scans do not fail on a single unreadable file. Technical approach: catch per-file `OSError`, track skipped count, and surface it in the summary. Effort: S. Dependencies: none. Risks: need clear messaging to avoid confusion. Result: unreadable files are skipped, counted, and reported in the scan summary.
- [Done] mtime precision when used as a criterion. User value: fewer false positives when files differ only by sub-second times. Technical approach: use `st_mtime_ns` or the full float; keep display formatting unchanged. Effort: S. Dependencies: none. Risks: small changes to grouping keys. Result: grouping uses full timestamp precision while display formatting stays the same. Tests: not run. Files: `delete_real_duplicates.py`, `docs/FEATURES.md`.
- [Planned] Confirm-delete dialog text accuracy. User value: avoid misleading messaging when a user chooses a non-newest file to keep. Technical approach: adjust confirmation copy to reflect actual selections. Effort: XS. Dependencies: none. Risks: none.
- [Planned] Guard UI callbacks after window close during scans. User value: avoid `TclError` if the window closes mid-scan. Technical approach: add a shutdown flag or `winfo_exists()` checks before `after` callbacks. Effort: S. Dependencies: none. Risks: none.
- [Planned] Debounce filter re-rendering. User value: responsive UI on large result sets. Technical approach: add a short `after` delay and cancel pending filter renders on keystroke. Effort: S. Dependencies: none. Risks: minor UI behavior change.
- [Planned] Safer size calculation before delete. User value: avoid crashes if files disappear between scan and delete. Technical approach: wrap `path.stat()` in try/except and treat missing files as size 0. Effort: XS. Dependencies: none. Risks: none.

## Next
- [Planned] Reduce scan memory when hashing is off. User value: lower RAM usage on large folders. Technical approach: let `find_duplicate_groups` stream inputs when `use_hash` is False; avoid `list(entries)` in `_run_scan_thread`. Effort: M. Dependencies: refactor grouping logic. Risks: behavior changes in edge cases if not tested.
- [Planned] Faster traversal with `os.scandir`/`os.walk`. User value: faster scans on large trees. Technical approach: replace `Path.rglob` with `os.walk` and reuse `entry.stat()` to avoid double stat calls. Effort: M. Dependencies: refactor `gather_recent_files`. Risks: path handling differences on Windows.
- [Planned] Add automated tests for core matching logic. User value: prevent regressions in `gather_recent_files` and `find_duplicate_groups`. Technical approach: introduce unit tests with fixture files and temp directories. Effort: M. Dependencies: test data harness. Risks: file-system tests can be flaky on CI without careful setup.
- [Planned] Scrollable keep-choice dialog for large duplicate sets. User value: UI remains usable when there are many groups. Technical approach: add a scrollable container or stepper per group. Effort: M. Dependencies: Tkinter layout work. Risks: increased UI complexity.
- [Planned] Extract core scan/grouping logic into a non-UI module. User value: better testability and simpler UI class. Technical approach: move scan/hash/group functions into a separate module with clean inputs/outputs. Effort: M. Dependencies: update imports and tests. Risks: refactor bugs.

## Later
- [Planned] Optional hashing thread pool. User value: faster hashing on SSDs and multi-core CPUs. Technical approach: parallelize hashing within size buckets with a bounded executor. Effort: L. Dependencies: careful UI progress handling. Risks: IO contention and increased CPU use.
- [Planned] Implement optional checks listed in the Help dialog (MIME/type, media metadata, embedded checksums). User value: tighter duplicate detection without full hashing. Technical approach: extend grouping keys and add optional dependencies (e.g., python-magic, pillow, mutagen). Effort: L. Dependencies: new libraries and UI configuration. Risks: performance cost and platform-specific edge cases.

## Pause / Abandon checklist
- Update the item status and add a short reason.
- Note any partial code paths and the next step needed to resume.
- Record commands/tests run in `docs/PROJECT_LOG.md`.
