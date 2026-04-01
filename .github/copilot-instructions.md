# Copilot instructions

Read `CONTRIBUTING.md` first. It is the canonical workflow contract for this repository.

## Short version

- GitHub is the live source of truth for issues, milestones, CI, and releases.
- Non-trivial work is issue-first and milestone-backed.
- Create a branch from `main` using `actor/type/scope/task-id` before editing.
- Keep PR titles in Conventional Commit format.
- Squash merge is the default path.

## Repo map

- `src/` - React + TypeScript frontend
- `src-tauri/` - Tauri v2 shell and Rust backend
- `core.py` and `delete_real_duplicates.py` - legacy Python compatibility surface
- `tests/` - Python tests for the legacy surface
- `.github/` - issue templates, PR template, CODEOWNERS, guardrails, and workflows

## Repo-specific scopes

Use these scope values in branches, PR titles, and issue forms when relevant:

- `tauri`
- `rust`
- `python-legacy`
- `release`
- `docs`
- `shared`

## Useful commands

```bash
npm ci
npm run tauri build --no-bundle
npx vitest run
npx tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml
python -m pytest tests -v
```
