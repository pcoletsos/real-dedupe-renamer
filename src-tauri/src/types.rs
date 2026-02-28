use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// Internal file entry used during scanning and grouping.
#[derive(Debug, Clone)]
pub struct FileEntry {
    pub path: PathBuf,
    pub size: u64,
    pub mtime: f64,
}

/// A single criterion value used to build grouping keys.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CriterionValue {
    Hash(String),
    Size(u64),
    Name(String),
    Mtime(i64),
    MimeType(String),
}

/// A grouping key: ordered list of criterion values.
pub type DuplicateKey = Vec<CriterionValue>;

/// File entry DTO sent to the frontend via Tauri commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntryDto {
    pub path: String,
    pub name: String,
    pub folder: String,
    pub size: u64,
    pub size_human: String,
    pub mtime: f64,
    pub mtime_formatted: String,
}

/// A group of duplicate files sent to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub key_description: String,
    pub files: Vec<FileEntryDto>,
}

/// Full scan result sent to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub groups: Vec<DuplicateGroup>,
    pub total_files_scanned: usize,
    pub hash_skipped: usize,
    pub scan_skipped: usize,
    pub elapsed_seconds: f64,
}

/// Candidate file sent to the frontend for auto-renamer mode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRenameCandidateDto {
    pub path: String,
    pub name: String,
    pub folder: String,
    pub extension: String,
    pub size: u64,
    pub mtime: f64,
    pub mtime_formatted: String,
    pub created: f64, // Unix seconds from file creation time (0 if unavailable)
}

/// Scan result for auto-renamer mode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRenameScanResult {
    pub candidates: Vec<AutoRenameCandidateDto>,
    pub total_files_scanned: usize,
    pub scan_skipped: usize,
    pub elapsed_seconds: f64,
}

/// A successfully renamed file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRenameItemDto {
    pub from_path: String,
    pub to_path: String,
}

/// A failed rename operation entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRenameErrorDto {
    pub path: String,
    pub message: String,
}

/// Full auto-rename operation result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRenameResult {
    pub renamed_count: usize,
    pub skipped_count: usize,
    pub error_count: usize,
    pub items: Vec<AutoRenameItemDto>,
    pub errors: Vec<AutoRenameErrorDto>,
}

/// Progress event emitted during scanning / hashing phases.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub phase: String,
    pub current: usize,
    pub total: usize,
    pub message: String,
}

/// Schema defining how files should be renamed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameSchema {
    pub components: Vec<RenameComponentDef>,
    pub separator: String,
}

/// A single component in a rename schema.
///
/// Serialised with an internal `kind` tag so the JSON looks like
/// `{"kind":"folder_name"}` or `{"kind":"sequence","pad_width":3}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RenameComponentDef {
    FolderName,
    DateCreated,
    DateModified,
    TimeCreated,
    TimeModified,
    Sequence { pad_width: usize },
    OriginalStem,
    Literal { value: String },
}

/// Return a human-friendly size string (e.g. "1.00 KB").
pub fn human_size(num_bytes: u64) -> String {
    let units = ["B", "KB", "MB", "GB", "TB"];
    let mut size = num_bytes as f64;
    for unit in &units {
        if size < 1024.0 || *unit == "TB" {
            return format!("{:.2} {}", size, unit);
        }
        size /= 1024.0;
    }
    format!("{} B", num_bytes)
}

/// Format a human-readable description of a duplicate grouping key.
pub fn describe_key(key: &DuplicateKey) -> String {
    let parts: Vec<String> = key
        .iter()
        .map(|c| match c {
            CriterionValue::Hash(digest) => {
                let short: String = digest.chars().take(8).collect();
                format!("sha256 {}...", short)
            }
            CriterionValue::Size(size) => {
                format!("size {}", human_size(*size))
            }
            CriterionValue::Name(name) => {
                format!("name {}", name)
            }
            CriterionValue::Mtime(ts) => {
                let dt = chrono::DateTime::from_timestamp(*ts, 0)
                    .unwrap_or_default()
                    .with_timezone(&chrono::Local);
                format!("mtime {}", dt.format("%Y-%m-%d %H:%M:%S"))
            }
            CriterionValue::MimeType(mime) => {
                format!("mime {}", mime)
            }
        })
        .collect();
    parts.join(" | ")
}

#[cfg(test)]
mod tests {
    use super::*;

    // -- human_size tests (ported from Python test_core.py) --

    #[test]
    fn test_zero_bytes() {
        assert_eq!(human_size(0), "0.00 B");
    }

    #[test]
    fn test_bytes() {
        assert_eq!(human_size(512), "512.00 B");
    }

    #[test]
    fn test_kilobytes() {
        assert_eq!(human_size(1024), "1.00 KB");
    }

    #[test]
    fn test_megabytes() {
        assert_eq!(human_size(1024 * 1024), "1.00 MB");
    }

    #[test]
    fn test_gigabytes() {
        assert_eq!(human_size(1024_u64.pow(3)), "1.00 GB");
    }

    #[test]
    fn test_terabytes() {
        assert_eq!(human_size(1024_u64.pow(4)), "1.00 TB");
    }

    #[test]
    fn test_large_terabytes_stays_in_tb() {
        let result = human_size(5 * 1024_u64.pow(4));
        assert!(result.contains("TB"));
    }

    // -- describe_key tests --

    #[test]
    fn test_describe_key_hash() {
        let key = vec![CriterionValue::Hash("abcdef1234567890".into())];
        let result = describe_key(&key);
        assert!(result.contains("sha256"));
        assert!(result.contains("abcdef12"));
    }

    #[test]
    fn test_describe_key_size() {
        let key = vec![CriterionValue::Size(1024)];
        let result = describe_key(&key);
        assert!(result.contains("1.00 KB"));
    }

    #[test]
    fn test_describe_key_name() {
        let key = vec![CriterionValue::Name("report.txt".into())];
        let result = describe_key(&key);
        assert!(result.contains("report.txt"));
    }

    #[test]
    fn test_describe_key_combined_uses_pipe() {
        let key = vec![
            CriterionValue::Hash("abc12345".into()),
            CriterionValue::Size(2048),
        ];
        let result = describe_key(&key);
        assert!(result.contains(" | "));
        assert!(result.contains("sha256"));
        assert!(result.contains("KB"));
    }

    #[test]
    fn test_describe_key_mtime() {
        let key = vec![CriterionValue::Mtime(1700000000)];
        let result = describe_key(&key);
        assert!(result.contains("mtime"));
        assert!(result.contains("2023"));
    }
}
