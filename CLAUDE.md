# CLAUDE.md

Read `CONTRIBUTING.md` first. It is the canonical workflow contract for this repo.

## Read next

| File | Purpose |
|---|---|
| `AGENTS.md` | Repo map and hard engineering constraints |
| `README.md` | Orientation and current entry points |
| `docs/LEGACY_PYTHON_POLICY.md` | Legacy compatibility policy |
| `docs/DECISIONS.md` | Architectural record |
| `docs/ROADMAP.md` | Planning snapshot |

## Live source of truth

Use GitHub for issues, milestones, CI, and releases.

Do not answer workflow, milestone, or release questions from markdown snapshots alone.

## Workflow reminders

- Reuse or create a GitHub issue before non-trivial implementation.
- Every non-trivial issue needs a milestone. Use `Backlog` when nothing else fits.
- Create a correctly named branch before editing.
- Keep PR titles in Conventional Commit format.
- Squash is the normal merge path.
- Keep legacy Python compatibility visible when touching release or compatibility surfaces.

Quick prompt shorthand is defined in `CONTRIBUTING.md`:

- `start <task>`
- `record it`
- `publish it`
- `propose it`
- `land it`
- `ship it`
- `finish it`
- `finish it for #<id>`
