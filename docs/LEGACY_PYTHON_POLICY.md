# Legacy Python Policy

> Effective: 2026-03-05
> Applies to: `delete_real_duplicates.py`, `core.py`, `delete_real_duplicates.spec`, `requirements.txt`, `tests/test_core.py`

## Current Status

The legacy Python/Tkinter application remains **buildable and published** as a Windows EXE in every `v2.*` GitHub Release alongside the Tauri installers. The release workflow (`release.yml`) builds the legacy EXE automatically on each tagged release.

## Scope Freeze

Legacy Python is under a **feature freeze** as of March 2026. No net-new feature work will be done in the Python codebase.

### Acceptable changes

Only the following change categories are permitted:

| Category | Example | Approval |
|---|---|---|
| **Critical bug fix** | Crash on scan, data loss during delete | Merge directly |
| **Security patch** | Dependency vulnerability (e.g., `send2trash` CVE) | Merge directly |
| **Compatibility fix** | PyInstaller or Python version bump breaks the build | Merge directly |
| **Build tooling** | Update `.spec` file for new PyInstaller flags | Merge directly |

### Prohibited changes

- New features, UI enhancements, or behavioral changes
- New dependencies beyond what `requirements.txt` already lists
- Performance optimizations (invest that effort in the Tauri app instead)
- Refactoring for code quality (the code is frozen, not evolving)

## Documentation Policy

- Primary documentation (README, RELEASE_CHECKLIST, ROADMAP) is **Tauri-first**.
- Legacy Python docs (`FEATURES.md`, `CODEBASE_ANALYSIS.md`) are marked as **historical** and kept for reference only.
- Decision records that predate the Tauri rewrite (D001–D006, D008) are labeled as legacy context.
- Changelog entries for versions before 2.0 reflect the Python-era feature set.

## Deprecation Criteria

The legacy Python EXE will be evaluated for removal from the release matrix based on these objective metrics:

| Metric | Threshold for deprecation | How to measure |
|---|---|---|
| **Download share** | Legacy EXE < 5% of total release downloads for two consecutive releases | GitHub Release asset download counts |
| **Issue volume** | Zero legacy-specific issues opened in the trailing 6 months | GitHub Issues labeled `legacy-python` or mentioning the Python app |
| **Support cost** | Zero hours spent on legacy Python maintenance in the trailing 6 months | Commit history touching `*.py`, `*.spec`, `requirements.txt` |
| **Build breakage** | PyInstaller or Python version incompatibility that would require significant effort to fix | CI failure in `build-python-legacy` job |

All four metrics are evaluated together. Meeting any single threshold is a signal, not an automatic trigger. Meeting three or more is a strong case for deprecation.

## Reassessment Schedule

| Checkpoint | Date | Action |
|---|---|---|
| **First review** | Q4 2026 (October) | Evaluate all four deprecation metrics. If thresholds are met, open a deprecation RFC issue. |
| **Decision** | Q4 2026 or Q1 2027 | If RFC is approved, remove `build-python-legacy` from `release.yml` and update docs. |
| **Grace period** | One release after decision | Final release includes the legacy EXE with a deprecation notice in release notes. |

If deprecation criteria are **not** met at Q4 2026, reassess again at Q2 2027.

## Related Documents

- [ROADMAP.md](ROADMAP.md) — Track D items
- [README.md](../README.md) — Project direction
- [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) — Release asset matrix
- [DECISIONS.md](DECISIONS.md) — D011: Tauri-forward development policy
