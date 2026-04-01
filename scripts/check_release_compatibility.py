#!/usr/bin/env python3
"""Validate release-facing compatibility surfaces for the repo.

This keeps the Tauri release versioning and the legacy Python policy visible
and synchronized without attempting a full release publish.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(rel_path: str) -> str:
    path = ROOT / rel_path
    if not path.exists():
        raise FileNotFoundError(f"Missing required file: {rel_path}")
    return path.read_text(encoding="utf-8")


def parse_package_json_version() -> str:
    data = json.loads(read_text("package.json"))
    version = data.get("version")
    if not isinstance(version, str) or not version:
        raise ValueError("package.json version is missing")
    return version


def parse_tauri_cargo_version() -> str:
    text = read_text("src-tauri/Cargo.toml")
    match = re.search(r'(?m)^version\s*=\s*"([^"]+)"\s*$', text)
    if not match:
        raise ValueError("src-tauri/Cargo.toml version is missing")
    return match.group(1)


def parse_tauri_conf_version() -> str:
    data = json.loads(read_text("src-tauri/tauri.conf.json"))
    version = data.get("version")
    if not isinstance(version, str) or not version:
        package = data.get("package", {})
        if not isinstance(package, dict):
            raise ValueError("src-tauri/tauri.conf.json version is missing")
        version = package.get("version")
    if not isinstance(version, str) or not version:
        raise ValueError("src-tauri/tauri.conf.json version is missing")
    return version


def parse_pyproject_version() -> str:
    text = read_text("pyproject.toml")
    match = re.search(r'(?m)^version\s*=\s*"([^"]+)"\s*$', text)
    if not match:
        raise ValueError("pyproject.toml version is missing")
    return match.group(1)


def main() -> int:
    errors: list[str] = []

    try:
        package_version = parse_package_json_version()
        cargo_version = parse_tauri_cargo_version()
        tauri_conf_version = parse_tauri_conf_version()
    except Exception as exc:  # pragma: no cover - surfaced in CI output
        print(f"::error::{exc}")
        return 1

    if package_version != cargo_version:
        errors.append(f"package.json version ({package_version}) must match src-tauri/Cargo.toml ({cargo_version}).")

    if package_version != tauri_conf_version:
        errors.append(
            f"package.json version ({package_version}) must match src-tauri/tauri.conf.json ({tauri_conf_version})."
        )

    try:
        pyproject_version = parse_pyproject_version()
    except Exception as exc:  # pragma: no cover - surfaced in CI output
        print(f"::error::{exc}")
        return 1

    if not pyproject_version:
        errors.append("pyproject.toml version must remain present for the legacy Python release surface.")

    readme = read_text("README.md")
    if "https://github.com/pcoletsos/real-dedupe-renamer/releases" not in readme:
        errors.append("README.md must point to the pcoletsos/real-dedupe-renamer GitHub Releases page.")

    release_notes = read_text(".github/RELEASE_NOTES_TEMPLATE.md")
    if "Legacy Python compatibility" not in release_notes:
        errors.append(".github/RELEASE_NOTES_TEMPLATE.md must keep the Legacy Python compatibility section visible.")

    legacy_policy = read_text("docs/LEGACY_PYTHON_POLICY.md")
    if "feature-frozen" not in legacy_policy.lower() and "legacy" not in legacy_policy.lower():
        errors.append("docs/LEGACY_PYTHON_POLICY.md must keep the legacy compatibility policy visible.")

    if not (ROOT / "delete_real_duplicates.spec").exists():
        errors.append("delete_real_duplicates.spec must exist for the legacy release path.")

    if not (ROOT / "requirements.txt").exists():
        errors.append("requirements.txt must exist for the legacy Python release path.")

    if errors:
        for error in errors:
            print(f"::error::{error}")
        return 1

    print(
        "Release compatibility checks passed: "
        f"package.json={package_version}, Cargo.toml={cargo_version}, tauri.conf.json={tauri_conf_version}, pyproject.toml={pyproject_version}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
