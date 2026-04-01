# GEMINI.md

Use `CONTRIBUTING.md` as the canonical workflow contract for this repository.
Do not implement non-trivial work directly on `main`.

## Read first

1. `CONTRIBUTING.md` - issue-first workflow, milestones, branch naming, PR policy
2. `AGENTS.md` - repo map and hard engineering constraints
3. `README.md` - repo orientation and runtime entry points
4. `docs/LEGACY_PYTHON_POLICY.md` - compatibility policy for the frozen Python surface

## Live source of truth

- Issues and milestones: GitHub
- CI and release runs: GitHub Actions
- Releases: GitHub Releases

`docs/ROADMAP.md` and `docs/PROJECT_LOG.md` are snapshots only.

## Agent rules

- Reuse or create a GitHub issue before non-trivial implementation.
- Every non-trivial issue needs a milestone. Use `Backlog` when no thematic milestone fits.
- Create a correctly named branch before editing:
  `actor/type/scope/task-id`
- Keep PR titles in Conventional Commit format so the final squash commit is compliant.
- Normal merge path is squash. Rebase is maintainer-only.
- Keep legacy Python compatibility visible when touching packaging or release workflow surfaces.

Quick prompt shorthand is defined in `CONTRIBUTING.md`:

- `start <task>`
- `record it`
- `publish it`
- `propose it`
- `land it`
- `ship it`
- `finish it`
- `finish it for #<id>`
