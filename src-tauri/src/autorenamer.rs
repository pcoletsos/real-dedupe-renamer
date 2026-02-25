use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::types::{AutoRenameErrorDto, AutoRenameItemDto, AutoRenameResult};

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

pub fn auto_rename_paths(paths: &[PathBuf]) -> AutoRenameResult {
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    auto_rename_paths_with_timestamp(paths, &timestamp)
}

fn auto_rename_paths_with_timestamp(paths: &[PathBuf], timestamp: &str) -> AutoRenameResult {
    let mut items: Vec<AutoRenameItemDto> = Vec::new();
    let mut errors: Vec<AutoRenameErrorDto> = Vec::new();
    let mut skipped_count = 0usize;
    let mut reserved_targets: HashSet<PathBuf> = HashSet::new();

    for source in paths {
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
        let sanitized_folder = sanitize_filename_component(folder_name);
        let extension = source
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e))
            .unwrap_or_default();

        let mut seq = 1u32;
        let target = loop {
            let candidate_name =
                format!("{}_{}_{:03}{}", sanitized_folder, timestamp, seq, extension);
            seq += 1;
            let candidate = parent.join(candidate_name);
            if candidate == *source {
                continue;
            }
            if candidate.exists() || reserved_targets.contains(&candidate) {
                continue;
            }
            break candidate;
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

    #[test]
    fn test_rename_preserves_extension_and_uses_parent_folder() {
        let dir = tempdir().unwrap();
        let parent = dir.path().join("Invoices");
        fs::create_dir(&parent).unwrap();
        let source = parent.join("old_name.TXT");
        fs::write(&source, b"hello").unwrap();

        let result = auto_rename_paths_with_timestamp(&[source.clone()], "20260101_010101");
        assert_eq!(result.renamed_count, 1);
        assert_eq!(result.error_count, 0);
        assert_eq!(result.skipped_count, 0);
        assert_eq!(result.items.len(), 1);

        let target = PathBuf::from(&result.items[0].to_path);
        assert!(target.exists());
        assert!(!source.exists());
        assert_eq!(target.extension().and_then(|e| e.to_str()), Some("TXT"));
        let name = target.file_name().unwrap().to_string_lossy().to_string();
        assert!(name.starts_with("Invoices_20260101_010101_"));
    }

    #[test]
    fn test_rename_increments_sequence_on_collision() {
        let dir = tempdir().unwrap();
        let parent = dir.path().join("photos");
        fs::create_dir(&parent).unwrap();
        let source = parent.join("a.jpg");
        fs::write(&source, b"img").unwrap();

        let conflict = parent.join("photos_20260101_010101_001.jpg");
        fs::write(&conflict, b"taken").unwrap();

        let result = auto_rename_paths_with_timestamp(&[source], "20260101_010101");
        assert_eq!(result.renamed_count, 1);
        let target = PathBuf::from(&result.items[0].to_path);
        assert_eq!(
            target.file_name().unwrap().to_string_lossy().to_string(),
            "photos_20260101_010101_002.jpg"
        );
    }

    #[test]
    fn test_missing_file_is_counted_as_skipped() {
        let dir = tempdir().unwrap();
        let missing = dir.path().join("missing.txt");
        let result = auto_rename_paths_with_timestamp(&[missing], "20260101_010101");
        assert_eq!(result.renamed_count, 0);
        assert_eq!(result.skipped_count, 1);
        assert_eq!(result.error_count, 0);
    }

    #[test]
    fn test_sanitize_filename_component() {
        let value = sanitize_filename_component("bad:name<>");
        assert_eq!(value, "bad_name__");
    }
}
