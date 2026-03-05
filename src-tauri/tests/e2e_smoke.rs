//! End-to-end smoke tests for the scan → group → delete/rename pipelines.
//!
//! These tests exercise the full backend pipeline using real temporary
//! directories with real files, without requiring the Tauri runtime or GUI.
//! Each test constructs a controlled filesystem scenario, drives the pipeline
//! functions in order, and asserts both return values and filesystem state.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use tempfile::tempdir;

use real_dedupe_renamer_lib::autorenamer;
use real_dedupe_renamer_lib::deleter;
use real_dedupe_renamer_lib::grouper;
use real_dedupe_renamer_lib::scanner;
use real_dedupe_renamer_lib::types::*;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Create a file with known content and return its path.
fn write_file(dir: &Path, name: &str, content: &[u8]) -> PathBuf {
    let path = dir.join(name);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(&path, content).unwrap();
    path
}

/// Hash-only GroupingConfig (simplest, highest-confidence duplicate detection).
fn hash_config() -> GroupingConfig {
    GroupingConfig {
        use_hash: true,
        use_size: false,
        use_name: false,
        use_mtime: false,
        use_mime: false,
        use_media_meta: false,
        hash_max_bytes: None,
        fast_hash_oversized: false,
    }
}

/// Collect file names in a directory (non-recursive).
fn file_names(dir: &Path) -> HashSet<String> {
    fs::read_dir(dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().map(|ft| ft.is_file()).unwrap_or(false))
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect()
}

// ---------------------------------------------------------------------------
// Scan → Group → Delete
// ---------------------------------------------------------------------------

#[test]
fn scan_group_delete_happy_path() {
    let dir = tempdir().unwrap();

    // a.txt and b.txt are content-identical; c.txt is unique.
    write_file(dir.path(), "a.txt", b"duplicate content here");
    write_file(dir.path(), "b.txt", b"duplicate content here");
    write_file(dir.path(), "c.txt", b"unique content");

    // Scan
    let (entries, skip_reasons) = scanner::gather_recent_files(dir.path(), 0, None, true, None);
    assert_eq!(entries.len(), 3);
    assert_eq!(skip_reasons.total(), 0);

    // Group by hash
    let (groups, hash_skipped) = grouper::find_duplicate_groups(&entries, &hash_config(), None);
    assert_eq!(hash_skipped, 0);
    assert_eq!(groups.len(), 1, "expected exactly one duplicate group");

    let group = groups.values().next().unwrap();
    assert_eq!(group.len(), 2);

    // Keep the first file, delete the second.
    let to_keep = &group[0].path;
    let to_delete = vec![group[1].path.clone()];

    let result = deleter::delete_files(&to_delete);
    assert_eq!(result.deleted, 1);
    assert!(result.errors.is_empty());

    // Verify filesystem state.
    assert!(to_keep.exists(), "kept file should still exist");
    assert!(!to_delete[0].exists(), "deleted file should be gone");
    assert!(
        dir.path().join("c.txt").exists(),
        "unique file should be untouched"
    );
}

#[test]
fn delete_preserves_kept_files_in_large_group() {
    let dir = tempdir().unwrap();

    for i in 0..4 {
        write_file(dir.path(), &format!("dup_{}.txt", i), b"same content");
    }

    let (entries, _) = scanner::gather_recent_files(dir.path(), 0, None, true, None);
    let (groups, _) = grouper::find_duplicate_groups(&entries, &hash_config(), None);
    assert_eq!(groups.len(), 1);

    let group = groups.values().next().unwrap();
    assert_eq!(group.len(), 4);

    // Keep first, delete the rest.
    let to_keep = group[0].path.clone();
    let to_delete: Vec<PathBuf> = group[1..].iter().map(|f| f.path.clone()).collect();

    let result = deleter::delete_files(&to_delete);
    assert_eq!(result.deleted, 3);
    assert!(result.errors.is_empty());

    assert!(to_keep.exists());
    for p in &to_delete {
        assert!(!p.exists());
    }

    // Re-scan: single remaining file cannot form a duplicate group.
    let (entries2, _) = scanner::gather_recent_files(dir.path(), 0, None, true, None);
    assert_eq!(entries2.len(), 1);
    let (groups2, _) = grouper::find_duplicate_groups(&entries2, &hash_config(), None);
    assert!(groups2.is_empty(), "single file cannot be a duplicate");
}

// ---------------------------------------------------------------------------
// Scan → Group → Rename
// ---------------------------------------------------------------------------

#[test]
fn scan_group_rename_happy_path() {
    let dir = tempdir().unwrap();

    let f1 = write_file(dir.path(), "photo.txt", b"content 1");
    let f2 = write_file(dir.path(), "report.txt", b"content 2");

    // Schema: "renamed_<original_stem>"
    let schema = RenameSchema {
        components: vec![
            RenameComponentDef::Literal {
                value: "renamed".to_string(),
            },
            RenameComponentDef::OriginalStem,
        ],
        separator: "_".to_string(),
    };

    let result = autorenamer::auto_rename_paths(&[f1.clone(), f2.clone()], &schema);
    assert_eq!(result.renamed_count, 2);
    assert_eq!(result.error_count, 0);
    assert_eq!(result.skipped_count, 0);

    // Originals gone, renamed files exist with preserved content.
    assert!(!f1.exists());
    assert!(!f2.exists());

    let expected1 = dir.path().join("renamed_photo.txt");
    let expected2 = dir.path().join("renamed_report.txt");
    assert!(expected1.exists());
    assert!(expected2.exists());
    assert_eq!(fs::read(&expected1).unwrap(), b"content 1");
    assert_eq!(fs::read(&expected2).unwrap(), b"content 2");
}

#[test]
fn rename_with_sequence_resolves_collisions() {
    let dir = tempdir().unwrap();

    let f1 = write_file(dir.path(), "a.txt", b"content a");
    let f2 = write_file(dir.path(), "b.txt", b"content b");
    let f3 = write_file(dir.path(), "c.txt", b"content c");

    // All three files get the same base stem "file", so the autorenamer
    // must resolve collisions via sequence numbers.
    let schema = RenameSchema {
        components: vec![
            RenameComponentDef::Literal {
                value: "file".to_string(),
            },
            RenameComponentDef::Sequence { pad_width: 3 },
        ],
        separator: "_".to_string(),
    };

    let result = autorenamer::auto_rename_paths(&[f1, f2, f3], &schema);
    assert_eq!(result.renamed_count, 3);
    assert_eq!(result.error_count, 0);

    let names = file_names(dir.path());
    assert_eq!(names.len(), 3);
    // First file gets base name "file.txt" (no collision yet), subsequent
    // collisions resolve to "file_001.txt", "file_002.txt", etc.
    for name in &names {
        assert!(name.starts_with("file"), "unexpected name: {}", name);
        assert!(name.ends_with(".txt"), "extension lost: {}", name);
    }
    assert!(names.contains("file.txt"), "base name should exist");
    assert!(
        names.contains("file_001.txt"),
        "first collision should exist"
    );
    assert!(
        names.contains("file_002.txt"),
        "second collision should exist"
    );
}

#[test]
fn full_pipeline_scan_group_rename_duplicate() {
    let dir = tempdir().unwrap();

    write_file(dir.path(), "photo1.jpg", b"image data");
    write_file(dir.path(), "photo1_copy.jpg", b"image data"); // duplicate
    write_file(dir.path(), "doc.txt", b"text data"); // unique

    // Scan + group
    let (entries, _) = scanner::gather_recent_files(dir.path(), 0, None, true, None);
    assert_eq!(entries.len(), 3);

    let (groups, _) = grouper::find_duplicate_groups(&entries, &hash_config(), None);
    assert_eq!(groups.len(), 1);

    // Rename the copy, not the original.
    let group = groups.values().next().unwrap();
    let dup_path = group
        .iter()
        .find(|f| {
            f.path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .contains("copy")
        })
        .unwrap()
        .path
        .clone();

    let schema = RenameSchema {
        components: vec![
            RenameComponentDef::Literal {
                value: "backup".to_string(),
            },
            RenameComponentDef::OriginalStem,
        ],
        separator: "_".to_string(),
    };

    let result = autorenamer::auto_rename_paths(std::slice::from_ref(&dup_path), &schema);
    assert_eq!(result.renamed_count, 1);
    assert_eq!(result.error_count, 0);

    // Original untouched, copy renamed, unique untouched.
    assert!(dir.path().join("photo1.jpg").exists());
    assert!(!dup_path.exists());
    let renamed = dir.path().join("backup_photo1_copy.jpg");
    assert!(renamed.exists());
    assert_eq!(fs::read(&renamed).unwrap(), b"image data");
    assert!(dir.path().join("doc.txt").exists());
}

// ---------------------------------------------------------------------------
// Grouping criteria variants
// ---------------------------------------------------------------------------

#[test]
fn multi_criteria_hash_plus_size() {
    let dir = tempdir().unwrap();

    // a.txt and b.txt: identical content (same hash AND same size).
    write_file(dir.path(), "a.txt", b"shared content");
    write_file(dir.path(), "b.txt", b"shared content");
    // c.txt: same byte length (14) but different content → different hash.
    write_file(dir.path(), "c.txt", b"differ content");
    // d.txt: completely different.
    write_file(dir.path(), "d.txt", b"short");

    let (entries, _) = scanner::gather_recent_files(dir.path(), 0, None, true, None);
    assert_eq!(entries.len(), 4);

    let config = GroupingConfig {
        use_hash: true,
        use_size: true,
        ..hash_config()
    };

    let (groups, _) = grouper::find_duplicate_groups(&entries, &config, None);
    assert_eq!(groups.len(), 1, "only a.txt+b.txt should group");

    let names: HashSet<String> = groups
        .values()
        .next()
        .unwrap()
        .iter()
        .map(|f| f.path.file_name().unwrap().to_string_lossy().to_string())
        .collect();
    assert!(names.contains("a.txt"));
    assert!(names.contains("b.txt"));
}

#[test]
fn no_duplicates_returns_no_groups() {
    let dir = tempdir().unwrap();

    write_file(dir.path(), "unique1.txt", b"first");
    write_file(dir.path(), "unique2.txt", b"second");
    write_file(dir.path(), "unique3.txt", b"third");

    let (entries, _) = scanner::gather_recent_files(dir.path(), 0, None, true, None);
    assert_eq!(entries.len(), 3);

    let (groups, _) = grouper::find_duplicate_groups(&entries, &hash_config(), None);
    assert!(
        groups.is_empty(),
        "all unique files should produce no groups"
    );
}

#[test]
fn fast_hash_groups_oversized_files() {
    let dir = tempdir().unwrap();

    let big_content = vec![0xABu8; 2048]; // 2 KB
    write_file(dir.path(), "big1.bin", &big_content);
    write_file(dir.path(), "big2.bin", &big_content); // duplicate
    write_file(dir.path(), "small.txt", b"tiny");

    let (entries, _) = scanner::gather_recent_files(dir.path(), 0, None, true, None);

    // hash_max_bytes = 1024 so the 2 KB files are "oversized".
    // fast_hash_oversized = true → sample head+tail instead of skipping.
    let config = GroupingConfig {
        use_hash: true,
        hash_max_bytes: Some(1024),
        fast_hash_oversized: true,
        ..hash_config()
    };

    let (groups, hash_skipped) = grouper::find_duplicate_groups(&entries, &config, None);
    assert_eq!(
        hash_skipped, 0,
        "fast hash should handle oversized files, not skip them"
    );
    assert_eq!(
        groups.len(),
        1,
        "the two big files should group via fast hash"
    );
    assert_eq!(groups.values().next().unwrap().len(), 2);
}

// ---------------------------------------------------------------------------
// Scanner filter behavior
// ---------------------------------------------------------------------------

#[test]
fn scan_respects_prefix_filter() {
    let dir = tempdir().unwrap();

    write_file(dir.path(), "IMG_001.jpg", b"photo 1");
    write_file(dir.path(), "IMG_002.jpg", b"photo 2");
    write_file(dir.path(), "DOC_report.pdf", b"document");

    let (entries, _) = scanner::gather_recent_files(dir.path(), 0, Some("IMG"), true, None);
    assert_eq!(entries.len(), 2, "only IMG_ files should be returned");
}

#[test]
fn scan_respects_subfolder_toggle() {
    let dir = tempdir().unwrap();
    let sub = dir.path().join("sub");
    fs::create_dir(&sub).unwrap();

    write_file(dir.path(), "root.txt", b"root file");
    write_file(&sub, "nested.txt", b"nested file");

    // Without subfolders.
    let (entries_flat, _) = scanner::gather_recent_files(dir.path(), 0, None, false, None);
    assert_eq!(entries_flat.len(), 1, "should only find root file");

    // With subfolders.
    let (entries_deep, _) = scanner::gather_recent_files(dir.path(), 0, None, true, None);
    assert_eq!(entries_deep.len(), 2, "should find root + nested files");
}
