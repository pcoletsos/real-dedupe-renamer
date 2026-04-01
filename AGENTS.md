# AGENTS.md

Read `CONTRIBUTING.md` first. It is the canonical workflow contract for this
repository.

## Read first

| File | Purpose |
|---|---|
| `CONTRIBUTING.md` | Canonical workflow contract |
| `README.md` | Repo orientation and runtime entry points |
| `docs/DECISIONS.md` | Architectural record |
| `docs/ROADMAP.md` | Planning snapshot |
| `docs/LEGACY_PYTHON_POLICY.md` | Legacy compatibility policy |
| `docs/PROJECT_LOG.md` | Delivery history snapshot |

## Live source of truth

GitHub is the live source of truth for:

- issues and milestones
- CI and release runs
- releases

If markdown and GitHub disagree, GitHub wins.

## Before you edit

For any non-trivial task:

1. search for an existing GitHub issue
2. reuse it or create a new one
3. ensure the issue has a milestone
4. use `Backlog` when no thematic milestone fits
5. create a branch before editing

Do not implement non-trivial work directly on `main`.

## Repo map

- `src/`: React + TypeScript frontend
- `src-tauri/`: Tauri v2 shell and Rust backend
- `core.py` and `delete_real_duplicates.py`: legacy Python compatibility surface
- `tests/`: Python tests for the legacy compatibility layer
- `.github/`: contribution templates, guardrails, and workflows

## Hard engineering constraints

- Keep the Tauri stack, the Rust backend, and the legacy Python app explicitly separated in docs and templates.
- Keep legacy Python compatibility visible in contributor-facing workflow surfaces.
- Keep release versions synchronized across the Tauri stack files.
- Do not commit build artifacts such as `dist/`, `build/`, `src-tauri/target/`, or generated bundles.

## Useful commands

```bash
npm ci
npm run tauri dev
npm run tauri build --no-bundle
npx vitest run
npx tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml
python -m pytest tests -v
```
