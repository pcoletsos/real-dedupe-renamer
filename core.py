"""Core business logic for Real Dedupe Renamer.

Scanning, hashing, grouping, and deletion logic -- no UI dependencies.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import os
from collections.abc import Iterable
from pathlib import Path

__version__ = "1.7.15"

FileEntry = tuple[Path, int, float]  # (path, size_bytes, mtime_timestamp)

__all__ = [
    "FileEntry",
    "__version__",
    "_describe_key",
    "_normalize_name",
    "_safe_path_size",
    "_sha256",
    "default_downloads_folder",
    "delete_files",
    "find_duplicate_groups",
    "gather_recent_files",
    "human_size",
]


def default_downloads_folder() -> Path:
    """Resolve a sensible default downloads folder."""
    # Prefer the user's standard Downloads directory.
    home = Path.home()
    downloads = home / "Downloads"
    if downloads.exists():
        return downloads

    # Fallback to a repo-local downloads folder (useful for testing).
    repo_downloads = Path.cwd() / "downloads"
    return repo_downloads if repo_downloads.exists() else Path.cwd()


def human_size(num_bytes: int) -> str:
    """Return a human friendly size string."""
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{num_bytes} B"


def _safe_path_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except OSError:
        return 0


def gather_recent_files(
    folder: Path,
    days_back: int,
    *,
    name_prefix: str | None = None,
    include_subfolders: bool = True,
) -> tuple[list[FileEntry], int]:
    """Collect files modified within the last `days_back` days (0 = all), returning entries and a skipped-error count."""
    cutoff = None if days_back <= 0 else _dt.datetime.now().timestamp() - days_back * 24 * 3600
    prefix = name_prefix.casefold() if name_prefix else None
    iterator = folder.rglob("*") if include_subfolders else folder.glob("*")
    entries: list[FileEntry] = []
    skipped = 0
    for path in iterator:
        try:
            if not path.is_file():
                continue
            if prefix and not path.name.casefold().startswith(prefix):
                continue
            stat = path.stat()
        except OSError:
            skipped += 1
            continue
        if cutoff is None or stat.st_mtime >= cutoff:
            entries.append((path, stat.st_size, stat.st_mtime))
    return entries, skipped


def _sha256(path: Path, chunk_size: int = 1024 * 1024) -> str:
    """Return the SHA-256 hex digest for a file (streamed to handle large files)."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


def _normalize_name(name: str) -> str:
    """Normalize file name for comparison (case-insensitive on Windows)."""
    return name.casefold() if os.name == "nt" else name


def _describe_key(key: tuple[tuple[str, object], ...]) -> str:
    """Format a human-readable description of the chosen duplicate criteria."""
    parts: list[str] = []
    for name, value in key:
        if name == "hash":
            parts.append(f"sha256 {str(value)[:8]}...")
        elif name == "size":
            parts.append(f"size {human_size(int(value))}")
        elif name == "name":
            parts.append(f"name {value}")
        elif name == "mtime":
            ts = _dt.datetime.fromtimestamp(int(value)).strftime("%Y-%m-%d %H:%M:%S")
            parts.append(f"mtime {ts}")
    return " | ".join(parts)


def find_duplicate_groups(
    entries: Iterable[FileEntry],
    *,
    use_hash: bool = True,
    use_size: bool = True,
    use_name: bool = False,
    use_mtime: bool = False,
    hash_max_bytes: int | None = None,
) -> tuple[dict[tuple[tuple[str, object], ...], list[FileEntry]], int]:
    """
    Group files by selected criteria; return only groups with real duplicates.

    You can toggle content hash, size, name, and modified time checks. At least one
    criterion should be enabled. Hashing is only done when `use_hash` is True.
    """
    if not any([use_hash, use_size, use_name, use_mtime]):
        return {}, 0

    groups: dict[tuple[tuple[str, object], ...], list[FileEntry]] = {}
    hash_skipped = 0

    # Bucket by size first to reduce hashing work when hashing is enabled.
    size_buckets: dict[int, list[FileEntry]] = {}
    if use_hash:
        for path, size, mtime in entries:
            size_buckets.setdefault(size, []).append((path, size, mtime))
    else:
        size_buckets = {None: list(entries)}  # type: ignore[arg-type]

    for _, files in size_buckets.items():
        # If hashing is active and this size has only one file, no need to hash.
        do_hash_here = use_hash and len(files) > 1

        for path, size, mtime in files:
            components: list[tuple[str, object]] = []

            if do_hash_here:
                if hash_max_bytes is not None and size > hash_max_bytes:
                    hash_skipped += 1
                else:
                    try:
                        digest = _sha256(path)
                    except OSError:
                        continue
                    components.append(("hash", digest))
            if use_size:
                components.append(("size", size))
            if use_name:
                components.append(("name", _normalize_name(path.name)))
            if use_mtime:
                components.append(("mtime", mtime))

            if not components:
                continue

            key = tuple(components)
            groups.setdefault(key, []).append((path, size, mtime))

    return {k: v for k, v in groups.items() if len(v) > 1}, hash_skipped


def delete_files(paths: Iterable[Path], *, on_error=None) -> None:
    """Delete files; prefer Recycle Bin/Trash if send2trash is available."""
    try:
        from send2trash import send2trash  # type: ignore[import-untyped]
    except Exception:
        send2trash = None

    for path in paths:
        try:
            if send2trash:
                send2trash(str(path))
            else:
                path.unlink(missing_ok=True)
        except Exception as exc:
            if on_error:
                on_error("Delete failed", f"Could not delete {path}:\n{exc}")
