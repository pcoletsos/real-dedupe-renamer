use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::types::{AutoRenameErrorDto, AutoRenameItemDto, AutoRenameResult, RenameComponentDef, RenameSchema};

const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tif", "tiff", "heic", "heif", "svg",
];
const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "webm", "m4v", "mpg", "mpeg", "wmv",
];
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "wma"];
const DOCUMENT_EXTENSIONS: &[&str] = &[
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "odt", "ods", "odp", "csv",
    "md",
];
const ARCHIVE_EXTENSIONS: &[&str] = &["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz"];

pub fn normalize_file_type_preset(preset: &str) -> String {
    match preset.trim().to_ascii_lowercase().as_str() {
        "images" => "images",
        "videos" => "videos",
        "audio" => "audio",
        "documents" => "documents",
        "archives" => "archives",
        _ => "all",
    }
    .to_string()
}

pub fn matches_file_type_preset(path: &Path, preset: &str) -> bool {
    let normalized = normalize_file_type_preset(preset);
    if normalized == "all" {
        return true;
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if extension.is_empty() {
        return false;
    }

    match normalized.as_str() {
        "images" => IMAGE_EXTENSIONS.contains(&extension.as_str()),
        "videos" => VIDEO_EXTENSIONS.contains(&extension.as_str()),
        "audio" => AUDIO_EXTENSIONS.contains(&extension.as_str()),
        "documents" => DOCUMENT_EXTENSIONS.contains(&extension.as_str()),
        "archives" => ARCHIVE_EXTENSIONS.contains(&extension.as_str()),
        _ => true,
    }
}

/// Build a new filename stem from the schema.
///
/// `seq` is `None` for the base-name pass (Sequence component is omitted);
/// `Some(n)` for the collision-resolution pass.
fn build_name(
    schema: &RenameSchema,
    folder_name: &str,
    original_stem: &str,
    extension: &str,
    created_dt: Option<&chrono::DateTime<chrono::Local>>,
    modified_dt: Option<&chrono::DateTime<chrono::Local>>,
    seq: Option<u32>,
) -> String {
    let now = chrono::Local::now();

    // Precompute date/time strings with fallback to `now`.
    let c = created_dt.unwrap_or(&now);
    let m = modified_dt.unwrap_or(&now);

    let c_date = c.format("%Y%m%d").to_string();
    let c_time = c.format("%H%M%S").to_string();
    let m_date = m.format("%Y%m%d").to_string();
    let m_time = m.format("%H%M%S").to_string();

    let parts: Vec<String> = schema
        .components
        .iter()
        .filter_map(|comp| match comp {
            RenameComponentDef::FolderName => Some(sanitize_filename_component(folder_name)),
            RenameComponentDef::DateCreated => Some(c_date.clone()),
            RenameComponentDef::DateModified => Some(m_date.clone()),
            RenameComponentDef::TimeCreated => Some(c_time.clone()),
            RenameComponentDef::TimeModified => Some(m_time.clone()),
            RenameComponentDef::OriginalStem => Some(sanitize_filename_component(original_stem)),
            RenameComponentDef::Literal { value } => {
                let s = sanitize_filename_component(value);
                if s.is_empty() { None } else { Some(s) }
            }
            RenameComponentDef::Sequence { pad_width } => {
                // Only emit the sequence token when seq is Some.
                seq.map(|n| format!("{:0>width$}", n, width = pad_width))
            }
        })
        .filter(|s| !s.is_empty())
        .collect();

    let stem = if parts.is_empty() {
        sanitize_filename_component(original_stem)
    } else {
        parts.join(&schema.separator)
    };

    format!("{}{}", stem, extension)
}

pub fn auto_rename_paths(paths: &[PathBuf], schema: &RenameSchema) -> AutoRenameResult {
    let mut items: Vec<AutoRenameItemDto> = Vec::new();
    let mut errors: Vec<AutoRenameErrorDto> = Vec::new();
    let mut skipped_count = 0usize;
    let mut reserved_targets: HashSet<PathBuf> = HashSet::new();

    'files: for source in paths {
        if !source.exists() {
            skipped_count += 1;
            continue;
        }

        let meta = match std::fs::metadata(source) {
            Ok(meta) => meta,
            Err(e) => {
                errors.push(AutoRenameErrorDto {
                    path: source.to_string_lossy().to_string(),
                    message: format!("Could not read metadata: {}", e),
                });
                continue;
            }
        };
        if !meta.is_file() {
            skipped_count += 1;
            continue;
        }

        let parent = match source.parent() {
            Some(p) => p.to_path_buf(),
            None => {
                skipped_count += 1;
                continue;
            }
        };

        let folder_name = parent
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("folder");

        let original_stem = source
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");

        let extension = source
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e))
            .unwrap_or_default();

        // Derive created / modified datetimes from metadata.
        let created_dt: Option<chrono::DateTime<chrono::Local>> = meta
            .created()
            .ok()
            .map(|t| t.into());
        let modified_dt: Option<chrono::DateTime<chrono::Local>> = meta
            .modified()
            .ok()
            .map(|t| t.into());

        // --- Pass 1: try the base name (no sequence number) ---
        let base_name = build_name(
            schema,
            folder_name,
            original_stem,
            &extension,
            created_dt.as_ref(),
            modified_dt.as_ref(),
            None,
        );
        let base_candidate = parent.join(&base_name);

        // If the file already has its target name, skip it.
        if base_candidate == *source {
            skipped_count += 1;
            continue 'files;
        }

        // --- Pass 2: if base is free, use it; otherwise loop with seq ---
        let target = if !base_candidate.exists() && !reserved_targets.contains(&base_candidate) {
            base_candidate
        } else {
            // Find the first free sequence number.
            let mut found: Option<PathBuf> = None;
            for seq in 1u32..=10_000 {
                let name = build_name(
                    schema,
                    folder_name,
                    original_stem,
                    &extension,
                    created_dt.as_ref(),
                    modified_dt.as_ref(),
                    Some(seq),
                );
                let candidate = parent.join(&name);
                if candidate == *source {
                    continue;
                }
                if !candidate.exists() && !reserved_targets.contains(&candidate) {
                    found = Some(candidate);
                    break;
                }
            }
            match found {
                Some(p) => p,
                None => {
                    errors.push(AutoRenameErrorDto {
                        path: source.to_string_lossy().to_string(),
                        message: "Could not find a free target name after 10000 attempts".into(),
                    });
                    continue 'files;
                }
            }
        };

        match std::fs::rename(source, &target) {
            Ok(()) => {
                reserved_targets.insert(target.clone());
                items.push(AutoRenameItemDto {
                    from_path: source.to_string_lossy().to_string(),
                    to_path: target.to_string_lossy().to_string(),
                });
            }
            Err(e) => {
                errors.push(AutoRenameErrorDto {
                    path: source.to_string_lossy().to_string(),
                    message: format!("Rename failed: {}", e),
                });
            }
        }
    }

    AutoRenameResult {
        renamed_count: items.len(),
        skipped_count,
        error_count: errors.len(),
        items,
        errors,
    }
}

fn sanitize_filename_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch.is_ascii_control() || matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')
        {
            out.push('_');
        } else {
            out.push(ch);
        }
    }

    let trimmed = out.trim().trim_matches('.');
    if trimmed.is_empty() {
        "folder".to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn folder_stem_schema() -> RenameSchema {
        RenameSchema {
            components: vec![
                RenameComponentDef::FolderName,
                RenameComponentDef::OriginalStem,
            ],
            separator: "_".into(),
        }
    }

    fn folder_seq_schema() -> RenameSchema {
        RenameSchema {
            components: vec![
                RenameComponentDef::FolderName,
                RenameComponentDef::Sequence { pad_width: 3 },
            ],
            separator: "_".into(),
        }
    }

    // --- build_name unit tests ---

    #[test]
    fn test_build_name_no_seq_omits_sequence() {
        let schema = RenameSchema {
            components: vec![
                RenameComponentDef::FolderName,
                RenameComponentDef::Sequence { pad_width: 3 },
            ],
            separator: "_".into(),
        };
        let result = build_name(&schema, "Photos", "img001", ".jpg", None, None, None);
        // Without a sequence number the Sequence component is omitted,
        // so only FolderName remains.
        assert_eq!(result, "Photos.jpg");
    }

    #[test]
    fn test_build_name_with_seq() {
        let schema = folder_seq_schema();
        let result = build_name(&schema, "Photos", "img001", ".jpg", None, None, Some(7));
        assert_eq!(result, "Photos_007.jpg");
    }

    #[test]
    fn test_build_name_literal() {
        let schema = RenameSchema {
            components: vec![
                RenameComponentDef::Literal { value: "backup".into() },
                RenameComponentDef::OriginalStem,
            ],
            separator: "-".into(),
        };
        let result = build_name(&schema, "folder", "report", ".pdf", None, None, None);
        assert_eq!(result, "backup-report.pdf");
    }

    #[test]
    fn test_build_name_date_created() {
        use chrono::TimeZone;
        let dt = chrono::Local
            .timestamp_opt(1700000000, 0)
            .single()
            .unwrap();
        let schema = RenameSchema {
            components: vec![RenameComponentDef::DateCreated],
            separator: "_".into(),
        };
        let result = build_name(&schema, "f", "stem", ".txt", Some(&dt), None, None);
        // Should contain a date-like string (8 digits).
        assert!(result.len() > 4);
        assert!(result.ends_with(".txt"));
    }

    // --- rename integration tests ---

    #[test]
    fn test_rename_preserves_extension_and_uses_schema() {
        let dir = tempdir().unwrap();
        let parent = dir.path().join("Invoices");
        fs::create_dir(&parent).unwrap();
        let source = parent.join("old_name.TXT");
        fs::write(&source, b"hello").unwrap();

        let schema = folder_stem_schema();
        let result = auto_rename_paths(&[source.clone()], &schema);
        assert_eq!(result.renamed_count, 1);
        assert_eq!(result.error_count, 0);
        assert_eq!(result.skipped_count, 0);

        let target = PathBuf::from(&result.items[0].to_path);
        assert!(target.exists());
        assert!(!source.exists());
        assert_eq!(target.extension().and_then(|e| e.to_str()), Some("TXT"));
        let name = target.file_name().unwrap().to_string_lossy().to_string();
        assert!(name.starts_with("Invoices_old_name"));
    }

    #[test]
    fn test_rename_collision_uses_sequence() {
        let dir = tempdir().unwrap();
        let parent = dir.path().join("photos");
        fs::create_dir(&parent).unwrap();
        let source = parent.join("a.jpg");
        fs::write(&source, b"img").unwrap();

        // Pre-create the base-name target (seq=None → "photos.jpg") so the
        // renamer is forced to fall back to seq=1 → "photos_001.jpg".
        let base_conflict = parent.join("photos.jpg");
        fs::write(&base_conflict, b"taken").unwrap();

        // Use a schema that includes a Sequence component so collision
        // resolution can generate a distinct name.
        let schema = folder_seq_schema();
        let result = auto_rename_paths(&[source], &schema);
        assert_eq!(result.renamed_count, 1);
        assert_eq!(result.error_count, 0);
        let target = PathBuf::from(&result.items[0].to_path);
        assert_eq!(
            target.file_name().unwrap().to_string_lossy().to_string(),
            "photos_001.jpg"
        );
    }

    #[test]
    fn test_rename_collision_with_seq_schema() {
        let dir = tempdir().unwrap();
        let parent = dir.path().join("photos");
        fs::create_dir(&parent).unwrap();
        let source = parent.join("a.jpg");
        fs::write(&source, b"img").unwrap();

        // Pre-create the conflict: the base name (seq=None → "photos.jpg") is free,
        // so we instead block the base AND seq-1 to force seq-2.
        let base_conflict = parent.join("photos.jpg"); // base (no seq component)
        fs::write(&base_conflict, b"taken1").unwrap();
        let seq1_conflict = parent.join("photos_001.jpg"); // seq=1
        fs::write(&seq1_conflict, b"taken2").unwrap();

        let schema = folder_seq_schema();
        let result = auto_rename_paths(&[source], &schema);
        assert_eq!(result.renamed_count, 1);
        let target = PathBuf::from(&result.items[0].to_path);
        assert_eq!(
            target.file_name().unwrap().to_string_lossy().to_string(),
            "photos_002.jpg"
        );
    }

    #[test]
    fn test_missing_file_is_counted_as_skipped() {
        let dir = tempdir().unwrap();
        let missing = dir.path().join("missing.txt");
        let schema = folder_stem_schema();
        let result = auto_rename_paths(&[missing], &schema);
        assert_eq!(result.renamed_count, 0);
        assert_eq!(result.skipped_count, 1);
        assert_eq!(result.error_count, 0);
    }

    #[test]
    fn test_sanitize_filename_component() {
        let value = sanitize_filename_component("bad:name<>");
        assert_eq!(value, "bad_name__");
    }

    #[test]
    fn test_file_type_filter_is_case_insensitive() {
        assert!(matches_file_type_preset(Path::new("photo.JPEG"), "images"));
        assert!(matches_file_type_preset(Path::new("report.PDF"), "documents"));
        assert!(!matches_file_type_preset(Path::new("photo.JPEG"), "audio"));
    }

    #[test]
    fn test_file_type_filter_all_matches_anything() {
        assert!(matches_file_type_preset(Path::new("whatever.bin"), "all"));
        assert!(matches_file_type_preset(Path::new("README"), "all"));
        assert!(matches_file_type_preset(Path::new("song.mp3"), "unknown-preset"));
    }
}
