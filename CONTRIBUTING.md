# Contributing to Real Dedupe Renamer

`CONTRIBUTING.md` is the canonical workflow contract for this repository.
Agent-facing files such as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and
`.github/copilot-instructions.md` should point here instead of redefining the
process.

## Source of truth

- GitHub is the live source of truth for issues, milestones, CI runs, and releases.
- `docs/ROADMAP.md` and `docs/PROJECT_LOG.md` are planning and history snapshots.
- `docs/DECISIONS.md` is the architectural record.
- `README.md` is the quick orientation layer, not the policy layer.

## Non-trivial changes are issue-first

Treat the following as non-trivial and route them through a GitHub issue before implementation:

- Tauri, Rust, or frontend behavior changes
- legacy Python compatibility changes
- release automation, packaging, or versioning changes
- workflow, repo-admin, or GitHub settings changes
- docs changes that affect contributor flow or release expectations
- refactors, test/tooling work, or delivery changes that affect the repo surface

### Required workflow

1. Search GitHub issues and milestones first.
2. Reuse an existing issue if it already covers the work.
3. If no matching issue exists, create one before implementation starts.
4. Every non-trivial issue must have a milestone:
   - Use an existing thematic milestone when it clearly fits.
   - Use `Backlog` when no thematic milestone fits.
   - Create a new thematic milestone only for a genuine new workstream.
5. Create a work branch from `main` using the canonical naming scheme.
6. Implement the change and run the relevant validation.
7. Open a pull request with the required template fields completed.
8. Merge with squash as the normal path. Rebase is a maintainer-only exception.

Do not start non-trivial implementation directly on `main`.

## Quick agent prompts

These are shorthand prompts for coding agents. They are not shell commands.

- `start <task>`: issue + milestone + branch, then begin work
- `record it`: commit current changes
- `publish it`: push current branch
- `propose it`: open or update the PR
- `land it`: squash-merge the PR after checks and approval
- `ship it`: commit + push + PR
- `finish it`: commit + push + PR + merge
- `finish it for #<id>`: canonical full-flow shorthand tied to an issue

## Branch naming

Canonical branch format:

```text
<actor>/<type>/<scope>/<task>-<id>
```

Rules:

- all segments must be lowercase and kebab-case
- `<id>` is mandatory
- keep names concise
- use `shared` only when no single domain clearly dominates the work

Allowed values:

| Segment | Allowed values |
|---|---|
| `actor` | `codex`, `claude`, `copilot`, `gemini`, `local`, `human` |
| `type` | `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf` |
| `scope` | `tauri`, `rust`, `python-legacy`, `release`, `docs`, `shared` |

Examples:

- `codex/chore/shared/contribution-operating-system-2`
- `human/fix/rust/windows-path-resolution-41`

## Commits and pull requests

Intermediate commit messages are not a blocking policy surface.

The enforced Conventional Commit format applies to:

- the pull request title
- the final squash commit message

Required format:

```text
<type>(<scope>): <description>
```

Allowed `type` and `scope` values match the branch naming tables above.

### PR requirements

Every normal PR must include:

- a linked issue
- a short summary of what changed and why
- the affected scope
- the validation that was run
- a legacy Python compatibility note when that surface is touched
- release compatibility notes when packaging or versioning is touched

### Trivial docs-only exception

Issue-less PRs are allowed only when every changed file is limited to:

- `docs/**`
- `*.md`
- `*.txt`

This exception is invalid if the PR touches any of the following:

- workflows
- configs
- scripts
- code-bearing paths
- release metadata

Use the PR template checkboxes to declare this exception explicitly.

## Merge and release policy

- `main` is the integration branch.
- Squash merge is the normal and documented merge path.
- Rebase merge remains available only as a maintainer exception.
- Merge commits should stay disabled.
- Production releases are driven only from semver tags such as `v2.1.1`.
- Plain pushes to `main` do not release production artifacts.

## Required checks

The branch protection baseline is:

- `Contribution guardrails`
- `Tauri/frontend checks`
- `Rust tests`
- `release compatibility checks`

## Repo-specific engineering constraints

- The primary stack is Tauri v2 + Rust backend + React/TypeScript frontend.
- The legacy Python/Tkinter app is feature-frozen and kept only for compatibility releases.
- Legacy Python compatibility must stay visible in issue, PR, and release templates.
- Versioning for the Tauri stack should stay synchronized across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
- Schema or release packaging changes should keep the release workflow and release notes template in sync.

## Useful commands

```bash
# Frontend / Tauri
npm ci
npm run tauri dev
npm run tauri build --no-bundle
npx vitest run
npx tsc --noEmit

# Rust
cargo test --manifest-path src-tauri/Cargo.toml

# Legacy Python
python -m pytest tests -v
python -m pip install -r requirements.txt
python -m pip install pyinstaller
pyinstaller delete_real_duplicates.spec

# Live GitHub state
gh issue list --repo pcoletsos/real-dedupe-renamer --state open
gh api repos/pcoletsos/real-dedupe-renamer/milestones --paginate
```
