use std::collections::HashMap;
use std::io::Read;

use crate::hasher;
use crate::media_meta;
use crate::types::{CriterionValue, DuplicateKey, FileEntry, GroupingConfig};

/// Normalize a file name for comparison (case-insensitive on Windows).
pub fn normalize_name(name: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        name.to_lowercase()
    }
    #[cfg(not(target_os = "windows"))]
    {
        name.to_string()
    }
}

/// Group files by selected criteria; return only groups with 2+ members.
///
/// Mirrors the Python `find_duplicate_groups` function from core.py:
/// - Size bucketing to reduce hashing work.
/// - Only hashes within buckets of 2+ files.
/// - Skips files exceeding `hash_max_bytes`.
///
/// Returns `(groups, hash_skipped_count)`.
pub fn find_duplicate_groups(
    entries: &[FileEntry],
    config: &GroupingConfig,
    progress_cb: Option<&dyn Fn(usize, usize)>,
) -> (HashMap<DuplicateKey, Vec<FileEntry>>, usize) {
    if !config.use_hash
        && !config.use_size
        && !config.use_name
        && !config.use_mtime
        && !config.use_mime
        && !config.use_media_meta
    {
        return (HashMap::new(), 0);
    }

    let mut groups: HashMap<DuplicateKey, Vec<FileEntry>> = HashMap::new();
    let mut hash_skipped: usize = 0;

    // Bucket by size first to reduce hashing work when hashing is enabled.
    let size_buckets: Vec<Vec<&FileEntry>> = if config.use_hash {
        let mut buckets: HashMap<u64, Vec<&FileEntry>> = HashMap::new();
        for entry in entries {
            buckets.entry(entry.size).or_default().push(entry);
        }
        buckets.into_values().collect()
    } else {
        // Single bucket containing all entries.
        vec![entries.iter().collect()]
    };

    // Pre-calculate total files to hash for progress reporting.
    let total_to_hash: usize = if config.use_hash {
        size_buckets
            .iter()
            .filter(|b| b.len() > 1)
            .map(|b| b.len())
            .sum()
    } else {
        0
    };
    let mut hashed_count: usize = 0;

    for files in &size_buckets {
        let do_hash_here = config.use_hash && files.len() > 1;

        for entry in files {
            let mut components: Vec<CriterionValue> = Vec::new();

            if do_hash_here {
                if let Some(max_bytes) = config.hash_max_bytes {
                    if entry.size > max_bytes {
                        if config.fast_hash_oversized {
                            // Use head+tail sampling instead of skipping.
                            match hasher::sha256_fast(&entry.path) {
                                Ok(digest) => components.push(CriterionValue::FastHash(digest)),
                                Err(_) => {
                                    hash_skipped += 1;
                                    hashed_count += 1;
                                    if let Some(cb) = &progress_cb {
                                        cb(hashed_count, total_to_hash);
                                    }
                                    continue;
                                }
                            }
                        } else {
                            hash_skipped += 1;
                        }
                        hashed_count += 1;
                        if let Some(cb) = &progress_cb {
                            cb(hashed_count, total_to_hash);
                        }
                        if !config.fast_hash_oversized {
                            continue;
                        }
                    } else {
                        match hasher::sha256_file(&entry.path) {
                            Ok(digest) => components.push(CriterionValue::Hash(digest)),
                            Err(_) => {
                                hashed_count += 1;
                                if let Some(cb) = &progress_cb {
                                    cb(hashed_count, total_to_hash);
                                }
                                continue;
                            }
                        }
                        hashed_count += 1;
                        if let Some(cb) = &progress_cb {
                            cb(hashed_count, total_to_hash);
                        }
                    }
                } else {
                    match hasher::sha256_file(&entry.path) {
                        Ok(digest) => components.push(CriterionValue::Hash(digest)),
                        Err(_) => {
                            hashed_count += 1;
                            if let Some(cb) = &progress_cb {
                                cb(hashed_count, total_to_hash);
                            }
                            continue;
                        }
                    }
                    hashed_count += 1;
                    if let Some(cb) = &progress_cb {
                        cb(hashed_count, total_to_hash);
                    }
                }
            }

            if config.use_size {
                components.push(CriterionValue::Size(entry.size));
            }

            if config.use_name {
                let name = entry
                    .path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");
                components.push(CriterionValue::Name(normalize_name(name)));
            }

            if config.use_mtime {
                components.push(CriterionValue::Mtime(entry.mtime as i64));
            }

            if config.use_mime {
                let mime = detect_mime_type(&entry.path);
                components.push(CriterionValue::MimeType(mime));
            }

            if config.use_media_meta {
                if let Some(fp) = media_meta::extract_media_fingerprint(&entry.path) {
                    components.push(CriterionValue::MediaMeta(fp));
                }
            }

            if components.is_empty() {
                continue;
            }

            let key: DuplicateKey = components;
            groups.entry(key).or_default().push((*entry).clone());
        }
    }

    // Filter to groups with 2+ members.
    let filtered: HashMap<DuplicateKey, Vec<FileEntry>> =
        groups.into_iter().filter(|(_, v)| v.len() > 1).collect();

    (filtered, hash_skipped)
}

/// Detect MIME type by reading the first 8 KB of a file and using magic bytes.
fn detect_mime_type(path: &std::path::Path) -> String {
    let mut buf = [0u8; 8192];
    let n = match std::fs::File::open(path).and_then(|mut f| f.read(&mut buf)) {
        Ok(n) => n,
        Err(_) => return "unknown".into(),
    };
    match infer::get(&buf[..n]) {
        Some(kind) => kind.mime_type().to_string(),
        None => "unknown".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    /// Helper: create files and return FileEntry values.
    fn make_entries(dir: &std::path::Path, files: &[(&str, &[u8])]) -> Vec<FileEntry> {
        files
            .iter()
            .map(|(name, content)| {
                let path = dir.join(name);
                fs::write(&path, content).unwrap();
                let meta = fs::metadata(&path).unwrap();
                let mtime = meta
                    .modified()
                    .unwrap()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs_f64();
                FileEntry {
                    path,
                    size: meta.len(),
                    mtime,
                }
            })
            .collect()
    }

    /// Helper: build a config with only the specified criteria enabled.
    fn config(
        hash: bool,
        size: bool,
        name: bool,
        mtime: bool,
        mime: bool,
        max_bytes: Option<u64>,
    ) -> GroupingConfig {
        GroupingConfig {
            use_hash: hash,
            use_size: size,
            use_name: name,
            use_mtime: mtime,
            use_mime: mime,
            use_media_meta: false,
            hash_max_bytes: max_bytes,
            fast_hash_oversized: false,
        }
    }

    #[test]
    fn test_hash_duplicates() {
        let dir = tempdir().unwrap();
        let entries = make_entries(
            dir.path(),
            &[
                ("a.txt", b"same content"),
                ("b.txt", b"same content"),
                ("c.txt", b"different"),
            ],
        );
        let cfg = config(true, false, false, false, false, None);
        let (groups, _) = find_duplicate_groups(&entries, &cfg, None);
        assert_eq!(groups.len(), 1);
        let group = groups.values().next().unwrap();
        let names: std::collections::HashSet<String> = group
            .iter()
            .map(|e| e.path.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert!(names.contains("a.txt"));
        assert!(names.contains("b.txt"));
    }

    #[test]
    fn test_size_only_duplicates() {
        let dir = tempdir().unwrap();
        let entries = make_entries(
            dir.path(),
            &[
                ("a.txt", b"aaaa"),
                ("b.txt", b"bbbb"), // same size, different content
                ("c.txt", b"cc"),   // different size
            ],
        );
        let cfg = config(false, true, false, false, false, None);
        let (groups, _) = find_duplicate_groups(&entries, &cfg, None);
        assert_eq!(groups.len(), 1);
        let group = groups.values().next().unwrap();
        let names: std::collections::HashSet<String> = group
            .iter()
            .map(|e| e.path.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert!(names.contains("a.txt"));
        assert!(names.contains("b.txt"));
    }

    #[test]
    fn test_name_duplicates_across_dirs() {
        let dir = tempdir().unwrap();
        let sub1 = dir.path().join("dir1");
        let sub2 = dir.path().join("dir2");
        fs::create_dir(&sub1).unwrap();
        fs::create_dir(&sub2).unwrap();
        fs::write(sub1.join("report.txt"), b"content1").unwrap();
        fs::write(sub2.join("report.txt"), b"content2").unwrap();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();
        let entries = vec![
            FileEntry {
                path: sub1.join("report.txt"),
                size: 8,
                mtime: now,
            },
            FileEntry {
                path: sub2.join("report.txt"),
                size: 8,
                mtime: now,
            },
        ];
        let cfg = config(false, false, true, false, false, None);
        let (groups, _) = find_duplicate_groups(&entries, &cfg, None);
        assert_eq!(groups.len(), 1);
    }

    #[test]
    fn test_no_criteria_returns_empty() {
        let dir = tempdir().unwrap();
        let entries = make_entries(dir.path(), &[("a.txt", b"x")]);
        let cfg = config(false, false, false, false, false, None);
        let (groups, _) = find_duplicate_groups(&entries, &cfg, None);
        assert!(groups.is_empty());
    }

    #[test]
    fn test_hash_max_bytes_skips_large_files() {
        let dir = tempdir().unwrap();
        let entries = make_entries(
            dir.path(),
            &[
                ("big1.bin", &vec![b'x'; 1000]),
                ("big2.bin", &vec![b'y'; 1000]),
            ],
        );
        let cfg = config(true, false, false, false, false, Some(500));
        let (_, skipped) = find_duplicate_groups(&entries, &cfg, None);
        assert_eq!(skipped, 2);
    }

    #[test]
    fn test_single_file_produces_no_groups() {
        let dir = tempdir().unwrap();
        let entries = make_entries(dir.path(), &[("only.txt", b"alone")]);
        let cfg = config(true, true, false, false, false, None);
        let (groups, _) = find_duplicate_groups(&entries, &cfg, None);
        assert!(groups.is_empty());
    }

    #[test]
    fn test_all_unique_produces_no_groups() {
        let dir = tempdir().unwrap();
        let entries = make_entries(
            dir.path(),
            &[
                ("a.txt", b"alpha"),
                ("b.txt", b"bravo"),
                ("c.txt", b"charlie"),
            ],
        );
        let cfg = config(true, false, false, false, false, None);
        let (groups, _) = find_duplicate_groups(&entries, &cfg, None);
        assert!(groups.is_empty());
    }

    #[test]
    fn test_fast_hash_oversized_groups_large_files() {
        let dir = tempdir().unwrap();
        // Create two identical "large" files that exceed our small cap.
        let content = vec![0xAB; 2000];
        let entries = make_entries(
            dir.path(),
            &[("big1.bin", &content), ("big2.bin", &content)],
        );
        let cfg = GroupingConfig {
            use_hash: true,
            use_size: false,
            use_name: false,
            use_mtime: false,
            use_mime: false,
            use_media_meta: false,
            hash_max_bytes: Some(500), // cap below file size
            fast_hash_oversized: true,
        };
        let (groups, skipped) = find_duplicate_groups(&entries, &cfg, None);
        // Files should be grouped via fast-hash, NOT skipped.
        assert_eq!(groups.len(), 1);
        assert_eq!(skipped, 0);
        // Verify the key uses FastHash variant.
        let key = groups.keys().next().unwrap();
        assert!(matches!(&key[0], CriterionValue::FastHash(_)));
    }

    #[test]
    fn test_full_hash_still_skips_without_fast_flag() {
        let dir = tempdir().unwrap();
        let content = vec![0xAB; 2000];
        let entries = make_entries(
            dir.path(),
            &[("big1.bin", &content), ("big2.bin", &content)],
        );
        let cfg = GroupingConfig {
            use_hash: true,
            use_size: false,
            use_name: false,
            use_mtime: false,
            use_mime: false,
            use_media_meta: false,
            hash_max_bytes: Some(500),
            fast_hash_oversized: false, // disabled
        };
        let (groups, skipped) = find_duplicate_groups(&entries, &cfg, None);
        // Files should be skipped, not grouped.
        assert!(groups.is_empty());
        assert_eq!(skipped, 2);
    }
}
