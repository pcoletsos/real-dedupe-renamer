# Release Checklist

This repository is Tauri-forward. Legacy Python is release-compatible only and must still be built/published for each `v2.*` release.

## 1. Pre-release (required)

- [ ] Confirm version is identical in:
  - `package.json` (`version`)
  - `src-tauri/Cargo.toml` (`package.version`)
  - `src-tauri/tauri.conf.json` (`version`)
- [ ] Confirm changelog updates are present (`CHANGELOG.md`).
- [ ] Confirm no generated artifacts are committed (`dist/`, `build/`, `src-tauri/target/` are git-ignored).
- [ ] Ensure CI is green on `main`:
  - frontend checks + unit tests
  - Rust tests
  - Rust `fmt` + `clippy`

## 2. Tag and release policy

- [ ] Use annotated semantic tags: `vMAJOR.MINOR.PATCH` (example: `v2.1.0`).
- [ ] Tag must match the source version exactly (`vX.Y.Z` <-> `X.Y.Z` in source files).
- [ ] Push tags to trigger `.github/workflows/release.yml`.
- [ ] For backfill/manual runs, use `workflow_dispatch` with:
  - `ref=<tag>`
  - `publish=true` (or `publish=false` for dry-run validation only)

## 3. Required release assets

The release workflow must publish exactly these distributables:

- [ ] Legacy Python (Windows): `.exe`
- [ ] Tauri Windows: NSIS `-setup.exe` and `.msi`
- [ ] Tauri macOS: `.dmg`
- [ ] Tauri Linux: `.AppImage`, `.deb`, `.rpm`

Asset names are normalized in the workflow before publish for consistency.

## 4. Release notes template

Use the following sections in each release:

1. Breaking changes
2. Features
3. Fixes
4. Known issues

The workflow appends `.github/RELEASE_NOTES_TEMPLATE.md` to generated notes.

## 5. Post-release verification

- [ ] Open the GitHub Release page and verify all required assets exist.
- [ ] Download one asset per platform to sanity-check availability.
- [ ] Confirm release notes sections are present.
- [ ] Confirm no raw bundle internals (e.g., unpacked `src-tauri/target/release/bundle/*`) are attached.

## 6. Rollback / hotfix

If a release is broken:

1. Mark the release as pre-release or add a warning in notes immediately.
2. If needed, delete incorrect assets and re-upload corrected ones.
3. If version is wrong, delete the release + tag and create a corrected tag.
4. Ship a patch tag (`vX.Y.(Z+1)`) for functional fixes instead of rewriting published history.
