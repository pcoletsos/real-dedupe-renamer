# Changelog

All notable changes to this project are documented in this file.

## 2.1.0
### Features
- Scan progress UX: structured phase labels ("Phase 1: Discovering files" / "Phase 2: Computing hashes"), estimated time remaining during hashing, total files scanned in completion summary.
- Confidence warning when content hashing is disabled, explaining metadata-only matches may include different content.
- Criteria preset profiles (Safe / Default / Aggressive) for simpler onboarding.
- CSV export for auto-rename dry-run plans.
- Schema reset-to-default button in the rename component builder.

### Testing & CI
- Component test infrastructure: jsdom environment, @testing-library/react, HTMLDialogElement polyfill.
- Component tests for ConfirmDialog, SettingsPanel, and RenameComponentBuilder (14 new tests, 20 total).
- CI test artifact uploads: JUnit XML for frontend, text capture for Rust per-OS results.

## 1.7.15
- Fix crash when files disappear between scan and delete (safer size calculation).

## 1.7.14
- Debounce filter re-rendering for responsive UI on large result sets.

## 1.7.13
- Guard UI callbacks after window close to prevent errors during scans.

## 1.7.12
- Fix confirm-delete dialog copy to reflect the actual keep selection.

## 1.7.11
- Remove stale build package artifacts from repository.

## 1.7.10
- Enlarge help icon to 16px for better visibility.

## 1.7.9
- Switch to SVG-based help icon rendering.

## 1.7.8
- Add help icon PNG assets (12/14/16px variants).

## 1.7.7
- Remove extra vertical spacing from help icon header.

## 1.7.6
- Move help icon to top-right corner.

## 1.7.5
- Replace Help button with a discreet question-mark icon.

## 1.7.4
- Add Help button without menu bar to reclaim vertical space.

## 1.7.3
- Fix status panel border continuity.

## 1.7.2
- Separate Review in Advanced button in simplified confirm dialog.

## 1.7.1
- Move Cancel button to left in confirm dialogs.

## 1.7.0
- Add Simplified view mode: hides advanced controls, uses fixed defaults (hash-only, 7 days, 500 MB cap), and auto-deletes duplicates with a confirmation prompt. Review in Advanced option available.

## 1.6.5 – 1.6.6
- Add simplified view roadmap task and documentation.

## 1.6.1 – 1.6.4
- UI layout refinements: tighter folder rows, refined status area and scan label, unified full-group confirm dialog buttons.

## 1.6.0
- Add selection color cues and button tints: delete buttons tinted red, Scan uses a magnifying-glass icon with green tint.

## 1.5.0
- Add in-table multi-select and "Delete selected" workflow: select specific rows (or entire groups) and delete them directly. Full-group selections trigger a safety confirmation.

## 1.4.6
- Hide filenames in keep-choice dialog by default; add toggle to show full path + filename.

## 1.4.5
- Add per-row KEEP/DELETE status column with legend in the keep-choice dialog.

## 1.4.4
- Improve modified-time precision matching (full timestamp instead of truncated).

## 1.4.3
- Handle scan errors gracefully: skip unreadable files, report skipped count in summary.

## 1.4.2
- Handle hash size cap fallback: large files skip hashing but still group by other enabled criteria.

## 1.4.1
- Sanitize settings template; stop shipping user-specific paths.

## 1.4.0
- Align README and release artifacts. Archive older EXEs.
- Name prefix filter and subfolder toggle for scans.
- Rename-kept-files option.
- Settings management and persistence.

## Pre-1.4
- Initial release with SHA-256 duplicate detection, Tkinter GUI, keep-choice workflow, CSV export, and PyInstaller packaging.
