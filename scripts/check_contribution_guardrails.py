#!/usr/bin/env python3
"""Validate the repo contribution contract for pull requests.

This script is intentionally small and dependency-free so it can run in CI and
locally without extra tooling.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


BRANCH_RE = re.compile(
    r"^(?:codex|claude|copilot|gemini|local|human)/(?:feat|fix|refactor|chore|docs|test|perf)/"
    r"(?:tauri|rust|python-legacy|release|docs|shared)/[a-z0-9]+(?:-[a-z0-9]+)*-\d+$"
)
TITLE_RE = re.compile(
    r"^(?:feat|fix|refactor|chore|docs|test|perf)\((?:tauri|rust|python-legacy|release|docs|shared)\): .+\S$"
)
ISSUE_RE = re.compile(r"(?:closes|fixes|resolves|related to|related)\s+#\d+|#\d+", re.IGNORECASE)
VALIDATION_RE = re.compile(r"(?im)^(?:#{1,3}\s*)?validation\b|^validation\s*:", re.MULTILINE)
LEGACY_RE = re.compile(r"(?im)^(?:#{1,3}\s*)?legacy python compatibility\b|^legacy python compatibility\s*:", re.MULTILINE)
RELEASE_RE = re.compile(r"(?im)^(?:#{1,3}\s*)?release compatibility\b|^release compatibility\s*:", re.MULTILINE)

DOCS_ONLY_PREFIXES = ("docs/",)
DOCS_ONLY_SUFFIXES = (".md", ".txt")
LEGACY_PATH_HINTS = (
    "core.py",
    "delete_real_duplicates.py",
    "delete_real_duplicates.spec",
    "requirements.txt",
    "tests/",
    "docs/legacy_python_policy.md",
)
RELEASE_PATH_HINTS = (
    "package.json",
    "src-tauri/cargo.toml",
    "src-tauri/tauri.conf.json",
    ".github/workflows/release.yml",
    ".github/release_notes_template.md",
)


def read_text(path: str | None, fallback: str = "") -> str:
    if not path:
        return fallback
    return Path(path).read_text(encoding="utf-8")


def read_changed_files(path: str | None) -> list[str]:
    if not path:
        return []
    items: list[str] = []
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        item = raw.strip()
        if item:
            items.append(item)
    return items


def is_docs_only(changed_files: list[str]) -> bool:
    if not changed_files:
        return False

    for file_path in changed_files:
        normalized = file_path.replace("\\", "/")
        if normalized.startswith(".github/"):
            return False
        if normalized.startswith("scripts/"):
            return False
        if normalized.startswith("src/") or normalized.startswith("src-tauri/"):
            return False
        if normalized.startswith("tests/"):
            return False
        if normalized.endswith(".yml") or normalized.endswith(".yaml") or normalized.endswith(".json"):
            return False
        if not (
            normalized.startswith(DOCS_ONLY_PREFIXES)
            or normalized.endswith(DOCS_ONLY_SUFFIXES)
        ):
            return False

    return True


def touches_any(changed_files: list[str], hints: tuple[str, ...]) -> bool:
    normalized_files = [path.replace("\\", "/").lower() for path in changed_files]
    for file_path in normalized_files:
        for hint in hints:
            needle = hint.lower()
            if needle.endswith("/"):
                if file_path.startswith(needle):
                    return True
                continue
            if file_path == needle or file_path.endswith("/" + needle):
                return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--branch", default="")
    parser.add_argument("--title", default="")
    parser.add_argument("--body-file", default="")
    parser.add_argument("--changed-files-file", default="")
    args = parser.parse_args()

    branch = args.branch or ""
    title = args.title or ""
    body = read_text(args.body_file)
    changed_files = read_changed_files(args.changed_files_file)

    errors: list[str] = []

    if branch and branch != "main" and not BRANCH_RE.fullmatch(branch):
        errors.append(
            "Branch name must match <actor>/<type>/<scope>/<task>-<id>, "
            "for example codex/chore/shared/contribution-operating-system-2."
        )

    if title and not TITLE_RE.fullmatch(title):
        errors.append(
            "PR title must use Conventional Commit format with an allowed repo scope, "
            "for example chore(shared): adopt repo contribution operating system."
        )

    docs_only = is_docs_only(changed_files)
    issue_linked = bool(ISSUE_RE.search(body))
    docs_only_exception = bool(re.search(r"(?im)^\s*-\s*\[[xX]\]\s*this pr is docs-only", body))

    if not docs_only and not issue_linked:
        errors.append("Non-docs-only PRs must include a linked GitHub issue in the body.")

    if docs_only and not issue_linked and not docs_only_exception:
        errors.append(
            "Docs-only PRs without a linked issue must explicitly declare the docs-only exception in the template."
        )

    if not VALIDATION_RE.search(body):
        errors.append("PR body must include a validation section.")

    if touches_any(changed_files, LEGACY_PATH_HINTS) or "python-legacy" in title.lower():
        if not LEGACY_RE.search(body):
            errors.append("Changes touching the legacy Python surface must include a Legacy Python compatibility section.")

    if touches_any(changed_files, RELEASE_PATH_HINTS) or "release" in title.lower():
        if not RELEASE_RE.search(body):
            errors.append("Release-related changes must include a Release compatibility section.")

    if errors:
        for error in errors:
            print(f"::error::{error}")
        return 1

    print("Contribution guardrails passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
