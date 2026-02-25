"""Tests for core.py -- the behavioral specification for the duplicate finder."""
from __future__ import annotations

import os
import time
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

from core import (
    _describe_key,
    _normalize_name,
    _safe_path_size,
    _sha256,
    default_downloads_folder,
    delete_files,
    find_duplicate_groups,
    gather_recent_files,
    human_size,
)

# ---------------------------------------------------------------------------
# human_size
# ---------------------------------------------------------------------------

class TestHumanSize:
    def test_zero_bytes(self):
        assert human_size(0) == "0.00 B"

    def test_bytes(self):
        assert human_size(512) == "512.00 B"

    def test_kilobytes(self):
        assert human_size(1024) == "1.00 KB"

    def test_megabytes(self):
        assert human_size(1024 * 1024) == "1.00 MB"

    def test_gigabytes(self):
        assert human_size(1024**3) == "1.00 GB"

    def test_terabytes(self):
        assert human_size(1024**4) == "1.00 TB"

    def test_large_terabytes_stays_in_tb(self):
        result = human_size(5 * 1024**4)
        assert "TB" in result


# ---------------------------------------------------------------------------
# _sha256
# ---------------------------------------------------------------------------

class TestSha256:
    def test_known_hash(self, tmp_path):
        f = tmp_path / "test.txt"
        f.write_bytes(b"hello world")
        assert _sha256(f) == "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"

    def test_empty_file(self, tmp_path):
        f = tmp_path / "empty.txt"
        f.write_bytes(b"")
        assert _sha256(f) == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    def test_large_file_exercises_chunking(self, tmp_path):
        f = tmp_path / "large.bin"
        # Larger than default 1 MB chunk to exercise the loop
        f.write_bytes(b"\x00" * (1024 * 1024 + 1))
        result = _sha256(f)
        assert len(result) == 64  # valid hex digest


# ---------------------------------------------------------------------------
# _normalize_name
# ---------------------------------------------------------------------------

class TestNormalizeName:
    def test_casefolding_on_windows(self):
        with patch.object(os, "name", "nt"):
            assert _normalize_name("MyFile.TXT") == "myfile.txt"

    def test_preserves_case_on_posix(self):
        with patch.object(os, "name", "posix"):
            assert _normalize_name("MyFile.TXT") == "MyFile.TXT"


# ---------------------------------------------------------------------------
# _safe_path_size
# ---------------------------------------------------------------------------

class TestSafePathSize:
    def test_existing_file(self, tmp_path):
        f = tmp_path / "file.txt"
        f.write_bytes(b"12345")
        assert _safe_path_size(f) == 5

    def test_missing_file_returns_zero(self, tmp_path):
        f = tmp_path / "gone.txt"
        assert _safe_path_size(f) == 0


# ---------------------------------------------------------------------------
# default_downloads_folder
# ---------------------------------------------------------------------------

class TestDefaultDownloadsFolder:
    def test_returns_path_instance(self):
        result = default_downloads_folder()
        assert isinstance(result, Path)

    def test_prefers_downloads_dir(self, tmp_path):
        downloads = tmp_path / "Downloads"
        downloads.mkdir()
        with patch.object(Path, "home", return_value=tmp_path):
            result = default_downloads_folder()
        assert result == downloads

    def test_fallback_when_no_downloads(self, tmp_path):
        # home exists but has no Downloads subfolder
        with patch.object(Path, "home", return_value=tmp_path):
            result = default_downloads_folder()
        # Should fall back to cwd-based logic
        assert isinstance(result, Path)


# ---------------------------------------------------------------------------
# gather_recent_files
# ---------------------------------------------------------------------------

class TestGatherRecentFiles:
    def test_collects_all_files_when_days_zero(self, tmp_path):
        (tmp_path / "a.txt").write_text("a")
        (tmp_path / "b.txt").write_text("b")
        entries, skipped = gather_recent_files(tmp_path, 0)
        assert len(entries) == 2
        assert skipped == 0

    def test_filters_by_days(self, tmp_path):
        old = tmp_path / "old.txt"
        old.write_text("old")
        old_time = time.time() - 30 * 86400
        os.utime(old, (old_time, old_time))

        recent = tmp_path / "recent.txt"
        recent.write_text("new")

        entries, _ = gather_recent_files(tmp_path, 7)
        names = [e[0].name for e in entries]
        assert "recent.txt" in names
        assert "old.txt" not in names

    def test_prefix_filter(self, tmp_path):
        (tmp_path / "report_jan.txt").write_text("a")
        (tmp_path / "notes.txt").write_text("b")
        entries, _ = gather_recent_files(tmp_path, 0, name_prefix="report")
        assert len(entries) == 1
        assert entries[0][0].name == "report_jan.txt"

    def test_subfolders_included(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "deep.txt").write_text("deep")
        (tmp_path / "top.txt").write_text("top")
        entries, _ = gather_recent_files(tmp_path, 0, include_subfolders=True)
        assert len(entries) == 2

    def test_subfolders_excluded(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "deep.txt").write_text("deep")
        (tmp_path / "top.txt").write_text("top")
        entries, _ = gather_recent_files(tmp_path, 0, include_subfolders=False)
        assert len(entries) == 1
        assert entries[0][0].name == "top.txt"

    def test_skips_directories(self, tmp_path):
        (tmp_path / "subdir").mkdir()
        (tmp_path / "file.txt").write_text("x")
        entries, _ = gather_recent_files(tmp_path, 0)
        assert len(entries) == 1
        assert entries[0][0].name == "file.txt"

    def test_empty_folder(self, tmp_path):
        entries, skipped = gather_recent_files(tmp_path, 0)
        assert entries == []
        assert skipped == 0


# ---------------------------------------------------------------------------
# find_duplicate_groups
# ---------------------------------------------------------------------------

def _make_entries(tmp_path: Path, files: dict[str, bytes]) -> list:
    """Helper: create files and return FileEntry tuples."""
    entries = []
    for name, content in files.items():
        f = tmp_path / name
        f.write_bytes(content)
        stat = f.stat()
        entries.append((f, stat.st_size, stat.st_mtime))
    return entries


class TestFindDuplicateGroups:
    def test_hash_duplicates(self, tmp_path):
        entries = _make_entries(tmp_path, {
            "a.txt": b"same content",
            "b.txt": b"same content",
            "c.txt": b"different",
        })
        groups, _ = find_duplicate_groups(entries, use_hash=True, use_size=False)
        assert len(groups) == 1
        names = {e[0].name for e in next(iter(groups.values()))}
        assert names == {"a.txt", "b.txt"}

    def test_size_only_duplicates(self, tmp_path):
        entries = _make_entries(tmp_path, {
            "a.txt": b"aaaa",
            "b.txt": b"bbbb",  # same size, different content
            "c.txt": b"cc",    # different size
        })
        groups, _ = find_duplicate_groups(entries, use_hash=False, use_size=True)
        assert len(groups) == 1
        names = {e[0].name for e in next(iter(groups.values()))}
        assert names == {"a.txt", "b.txt"}

    def test_name_duplicates_across_dirs(self, tmp_path):
        sub1 = tmp_path / "dir1"
        sub2 = tmp_path / "dir2"
        sub1.mkdir()
        sub2.mkdir()
        (sub1 / "report.txt").write_bytes(b"content1")
        (sub2 / "report.txt").write_bytes(b"content2")
        entries = [
            (sub1 / "report.txt", 8, time.time()),
            (sub2 / "report.txt", 8, time.time()),
        ]
        groups, _ = find_duplicate_groups(entries, use_hash=False, use_name=True)
        assert len(groups) == 1

    def test_no_criteria_returns_empty(self, tmp_path):
        entries = _make_entries(tmp_path, {"a.txt": b"x"})
        groups, _ = find_duplicate_groups(
            entries, use_hash=False, use_size=False, use_name=False, use_mtime=False
        )
        assert groups == {}

    def test_hash_max_bytes_skips_large_files(self, tmp_path):
        # Need two large files of the same size so they land in the same
        # size bucket and actually trigger the hash_max_bytes check.
        entries = _make_entries(tmp_path, {
            "big1.bin": b"x" * 1000,
            "big2.bin": b"y" * 1000,
        })
        _groups, skipped = find_duplicate_groups(
            entries, use_hash=True, use_size=False, hash_max_bytes=500
        )
        assert skipped == 2

    def test_single_file_produces_no_groups(self, tmp_path):
        entries = _make_entries(tmp_path, {"only.txt": b"alone"})
        groups, _ = find_duplicate_groups(entries, use_hash=True)
        assert len(groups) == 0

    def test_all_unique_produces_no_groups(self, tmp_path):
        entries = _make_entries(tmp_path, {
            "a.txt": b"alpha",
            "b.txt": b"bravo",
            "c.txt": b"charlie",
        })
        groups, _ = find_duplicate_groups(entries, use_hash=True, use_size=False)
        assert len(groups) == 0


# ---------------------------------------------------------------------------
# delete_files
# ---------------------------------------------------------------------------

class TestDeleteFiles:
    def test_send2trash_preferred_when_available(self, tmp_path):
        f = tmp_path / "file.txt"
        f.write_text("data")
        calls = []

        fake_s2t = ModuleType("send2trash")
        fake_s2t.send2trash = lambda p: calls.append(p)  # type: ignore[attr-defined]

        with patch.dict("sys.modules", {"send2trash": fake_s2t}):
            delete_files([f])
        assert len(calls) == 1
        assert calls[0] == str(f)

    def test_fallback_to_unlink(self, tmp_path):
        f = tmp_path / "file.txt"
        f.write_text("data")
        assert f.exists()

        # Make send2trash import fail
        with patch.dict("sys.modules", {"send2trash": None}):
            delete_files([f])
        assert not f.exists()

    def test_on_error_callback_called(self, tmp_path):
        f = tmp_path / "file.txt"
        f.write_text("data")
        errors = []

        # Make send2trash raise an exception
        fake_s2t = ModuleType("send2trash")
        fake_s2t.send2trash = lambda p: (_ for _ in ()).throw(OSError("boom"))  # type: ignore[attr-defined]

        with patch.dict("sys.modules", {"send2trash": fake_s2t}):
            delete_files([f], on_error=lambda title, msg: errors.append(msg))
        assert len(errors) == 1
        assert "boom" in errors[0]

    def test_empty_list_does_nothing(self):
        # Should not raise
        delete_files([])


# ---------------------------------------------------------------------------
# _describe_key
# ---------------------------------------------------------------------------

class TestDescribeKey:
    def test_hash_key(self):
        key = (("hash", "abcdef1234567890"),)
        result = _describe_key(key)
        assert "sha256" in result
        assert "abcdef12" in result

    def test_size_key(self):
        key = (("size", 1024),)
        result = _describe_key(key)
        assert "1.00 KB" in result

    def test_name_key(self):
        key = (("name", "report.txt"),)
        result = _describe_key(key)
        assert "report.txt" in result

    def test_combined_key_uses_pipe_separator(self):
        key = (("hash", "abc12345"), ("size", 2048))
        result = _describe_key(key)
        assert " | " in result
        assert "sha256" in result
        assert "KB" in result

    def test_mtime_key(self):
        ts = 1700000000  # 2023-11-14 approx
        key = (("mtime", ts),)
        result = _describe_key(key)
        assert "mtime" in result
        assert "2023" in result
