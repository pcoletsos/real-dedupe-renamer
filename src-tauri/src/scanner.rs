use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use walkdir::WalkDir;

use crate::types::FileEntry;

/// Return the file size in bytes, or 0 on any error.
pub fn safe_path_size(path: &Path) -> u64 {
    std::fs::metadata(path).map(|m| m.len()).unwrap_or(0)
}

/// Collect files from `folder`, optionally filtering by recency and name prefix.
///
/// - `days_back == 0` means collect all files regardless of age.
/// - `name_prefix` filters by case-insensitive file name prefix.
/// - `include_subfolders` controls recursive traversal.
///
/// Returns `(entries, skipped_count)`.
pub fn gather_recent_files(
    folder: &Path,
    days_back: u32,
    name_prefix: Option<&str>,
    include_subfolders: bool,
    progress_cb: Option<&dyn Fn(usize)>,
) -> (Vec<FileEntry>, usize) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64())
        .unwrap_or(0.0);

    let cutoff: Option<f64> = if days_back == 0 {
        None
    } else {
        Some(now - f64::from(days_back) * 86400.0)
    };

    let prefix_lower = name_prefix.map(|p| p.to_lowercase());

    let max_depth = if include_subfolders { usize::MAX } else { 1 };
    let walker = WalkDir::new(folder).max_depth(max_depth);

    let mut entries = Vec::new();
    let mut skipped: usize = 0;

    for result in walker {
        let dir_entry = match result {
            Ok(e) => e,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };

        if !dir_entry.file_type().is_file() {
            continue;
        }

        let path = dir_entry.path();

        // Name prefix filter (case-insensitive).
        if let Some(ref pfx) = prefix_lower {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_lowercase();
            if !file_name.starts_with(pfx.as_str()) {
                continue;
            }
        }

        // Read metadata.
        let meta = match std::fs::metadata(path) {
            Ok(m) => m,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };

        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs_f64())
            .unwrap_or(0.0);

        // Recency filter.
        if let Some(cutoff_ts) = cutoff {
            if mtime < cutoff_ts {
                continue;
            }
        }

        entries.push(FileEntry {
            path: path.to_path_buf(),
            size: meta.len(),
            mtime,
        });

        if let Some(cb) = &progress_cb {
            if entries.len() % 100 == 0 {
                cb(entries.len());
            }
        }
    }

    // Emit final count so the UI sees the exact total.
    if let Some(cb) = &progress_cb {
        cb(entries.len());
    }

    (entries, skipped)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_safe_path_size_existing_file() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("file.txt");
        fs::write(&f, b"12345").unwrap();
        assert_eq!(safe_path_size(&f), 5);
    }

    #[test]
    fn test_safe_path_size_missing_file() {
        let dir = tempdir().unwrap();
        let f = dir.path().join("gone.txt");
        assert_eq!(safe_path_size(&f), 0);
    }

    #[test]
    fn test_collects_all_files_when_days_zero() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "a").unwrap();
        fs::write(dir.path().join("b.txt"), "b").unwrap();

        let (entries, skipped) = gather_recent_files(dir.path(), 0, None, true, None);
        assert_eq!(entries.len(), 2);
        assert_eq!(skipped, 0);
    }

    #[test]
    fn test_filters_by_days() {
        let dir = tempdir().unwrap();

        let old = dir.path().join("old.txt");
        fs::write(&old, "old").unwrap();
        let old_time = filetime::FileTime::from_unix_time(
            (SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64)
                - 30 * 86400,
            0,
        );
        filetime::set_file_mtime(&old, old_time).unwrap();

        let recent = dir.path().join("recent.txt");
        fs::write(&recent, "new").unwrap();

        let (entries, _) = gather_recent_files(dir.path(), 7, None, true, None);
        let names: Vec<String> = entries.iter().map(|e| e.path.file_name().unwrap().to_string_lossy().to_string()).collect();
        assert!(names.contains(&"recent.txt".to_string()));
        assert!(!names.contains(&"old.txt".to_string()));
    }

    #[test]
    fn test_prefix_filter() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("report_jan.txt"), "a").unwrap();
        fs::write(dir.path().join("notes.txt"), "b").unwrap();

        let (entries, _) = gather_recent_files(dir.path(), 0, Some("report"), true, None);
        assert_eq!(entries.len(), 1);
        assert!(entries[0].path.file_name().unwrap().to_str().unwrap() == "report_jan.txt");
    }

    #[test]
    fn test_subfolders_included() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("deep.txt"), "deep").unwrap();
        fs::write(dir.path().join("top.txt"), "top").unwrap();

        let (entries, _) = gather_recent_files(dir.path(), 0, None, true, None);
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn test_subfolders_excluded() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir(&sub).unwrap();
        fs::write(sub.join("deep.txt"), "deep").unwrap();
        fs::write(dir.path().join("top.txt"), "top").unwrap();

        let (entries, _) = gather_recent_files(dir.path(), 0, None, false, None);
        assert_eq!(entries.len(), 1);
        assert!(entries[0].path.file_name().unwrap().to_str().unwrap() == "top.txt");
    }

    #[test]
    fn test_skips_directories() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join("subdir")).unwrap();
        fs::write(dir.path().join("file.txt"), "x").unwrap();

        let (entries, _) = gather_recent_files(dir.path(), 0, None, true, None);
        assert_eq!(entries.len(), 1);
        assert!(entries[0].path.file_name().unwrap().to_str().unwrap() == "file.txt");
    }

    #[test]
    fn test_empty_folder() {
        let dir = tempdir().unwrap();
        let (entries, skipped) = gather_recent_files(dir.path(), 0, None, true, None);
        assert!(entries.is_empty());
        assert_eq!(skipped, 0);
    }
}
