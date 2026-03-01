# Roadmap

> Updated: 2026-03-02
> Direction: Tauri/Rust/React is the forward product stack.
> Legacy policy: Python/Tkinter is release-compatible only (no net-new feature work).

## Planning Rules
- Keep one source of truth for forward work in this file.
- Record execution details in `docs/PROJECT_LOG.md` when starting/completing roadmap items.
- Keep status current: `[Planned]`, `[In Progress]`, `[Paused]`, `[Blocked]`, `[Abandoned]`, `[Done]`.

---

## Milestones

### M0 - Stabilize release pipeline (v2.0.x)
- Target window: March 2026
- Outcome: reliable GitHub Releases for Tauri + legacy Python assets, without leaking internal bundle contents.

### M1 - Product quality baseline (v2.1.0)
- Target window: April-May 2026
- Outcome: stronger UX feedback, better scan reliability, and test coverage beyond backend unit tests.

### M2 - Feature depth (v2.2.0)
- Target window: June-July 2026
- Outcome: richer duplicate criteria and stronger auto-rename workflows.

---

## Track A - Release & Distribution

### A1. Harden release asset policy
- [Done] Publish only final distributables (`.exe`, `.msi`, `.dmg`, `.AppImage`, `.deb`, `.rpm`) from Tauri builds.
- [Done] Add explicit artifact naming rules so release assets remain consistent across app renames and versions.
- [Done] Add a release smoke-check step that verifies expected asset count per tag before publishing.

### A2. Release notes & version governance
- [Done] Add a `RELEASE_CHECKLIST.md` with tag flow, required checks, and rollback steps.
- [Done] Define version authority for Tauri (`src-tauri/Cargo.toml` + `src-tauri/tauri.conf.json`) and enforce consistency in CI.
- [Done] Add release note sections template: Breaking/Features/Fixes/Known issues.

### A3. Backfill and maintain v2 releases
- [Done] Backfilled `v2.0.0` and `v2.0.4` releases on GitHub with Tauri + legacy Python assets.
- [Planned] Ensure each future `v2.*` tag automatically publishes complete assets via `.github/workflows/release.yml`.

---

## Track B - Product (Tauri App)

### B1. Scan UX and confidence
- [Done] Improve scan progress UX with clearer phase text and better completion summaries.
- [Done] Expose skipped-file reasons count buckets (permissions, missing, transient I/O).
- [Done] Add user-visible warning when selected duplicate criteria materially reduce confidence (metadata-only matches).

### B2. Duplicate criteria roadmap
- [Planned] Expand optional checks beyond current MIME/type support (e.g., media metadata where feasible).
- [Planned] Evaluate a fast-hash mode (chunk/hash strategy) for large-file workflows with explicit caveats.
- [Done] Add criteria preset profiles (safe/default/aggressive) for simpler onboarding.

### B3. Auto-renamer roadmap
- [Done] Add deterministic collision preview parity tests between frontend preview and backend rename result.
- [Done] Add preview export (CSV/report) for dry-run rename plans.
- [Done] Add schema reset-to-default action.
- [Planned] Improve schema editing UX (duplicate component shortcuts, keyboard support).

---

## Track C - Quality & Testing

### C1. Test coverage expansion
- [Done] Add frontend unit tests for pure logic utilities (rename preview, selection/filter behavior).
- [Done] Add component tests for high-risk flows (delete confirm, settings panel, auto-renamer schema builder).
- [Planned] Add an end-to-end smoke suite (Tauri app launch + scan/delete/rename happy paths).

### C2. CI quality gates
- [Done] Add lint step for Rust (`cargo fmt --check`, `cargo clippy`) to CI.
- [Done] Add test-summary artifact uploads for easier CI triage.
- [Done] Add a release-workflow dry-run mode on `workflow_dispatch` without publishing.

---

## Track D - Legacy Python Policy

### D1. Scope control
- [In Progress] Legacy Python remains buildable and published to GitHub Releases.
- [Planned] Freeze legacy Python feature scope: only critical bug/security/compatibility fixes.
- [Planned] Mark legacy Python docs as historical where needed and keep primary docs Tauri-first.

### D2. Sunset criteria
- [Planned] Define objective deprecation criteria (download share, issue volume, support cost).
- [Planned] Reassess legacy Python retention in Q4 2026 based on those metrics.

---

## Near-Term Priority Queue

1. [Done] Add release smoke-check for expected asset matrix in `release.yml`.
2. [Done] Add Rust lint gates (`fmt`/`clippy`) to CI.
3. [Done] Add frontend unit tests for rename preview parity.
4. [Done] Add scan summary improvements for skipped-file reason buckets.
5. [Done] Write `RELEASE_CHECKLIST.md`.
