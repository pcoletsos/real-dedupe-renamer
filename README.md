# Real Dedupe Renamer

Desktop utility for duplicate-file cleanup and guided auto-renaming.

## Project Direction

- Primary stack: **Tauri v2 + Rust backend + React/TypeScript frontend**.
- Legacy stack: **Python/Tkinter** kept for legacy build compatibility and release publishing.
- Repository policy: **No binary artifacts in git** (`.exe`, bundles, archives stay in GitHub Releases).

## Download

Download published binaries from GitHub Releases:
- https://github.com/pcoletsos/real-dedupe-renamer/releases

## Develop (Tauri)

Prerequisites:
- Node.js 22+
- Rust stable toolchain
- Tauri system dependencies (platform-specific)

Run in development mode:

```bash
npm ci
npm run tauri dev
```

Build bundles locally:

```bash
npm ci
npm run tauri build
```

## Legacy Python Build (Release Compatibility)

The legacy Python app is **feature-frozen** — only critical bug, security, and compatibility fixes are accepted. It remains buildable and published in each `v2.*` release. See [docs/LEGACY_PYTHON_POLICY.md](docs/LEGACY_PYTHON_POLICY.md) for the full scope and deprecation policy.

```bash
python -m pip install -r requirements.txt
python -m pip install pyinstaller
pyinstaller delete_real_duplicates.spec
```

Output:
- `dist/delete_real_duplicates-<version>.exe`

## Release Publishing

Releases are automated via GitHub Actions:

- CI (`.github/workflows/ci.yml`): Tauri-focused checks (frontend, Rust tests, Tauri no-bundle build).
- Release (`.github/workflows/release.yml`): builds and publishes
  - legacy Python Windows EXE
  - Tauri bundles for Windows/macOS/Linux

Trigger release publishing by pushing a tag (for example `v2.1.1`).
You can also run the release workflow manually with an existing tag to backfill assets.

## Binary Artifact Policy

- Do not commit build outputs (`dist/`, `archive/`, `build/`, `.exe`, `.zip`, bundle artifacts).
- Publish all build artifacts through GitHub Releases.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before non-trivial changes. GitHub
is the live source of truth for issues, milestones, CI, and releases.
