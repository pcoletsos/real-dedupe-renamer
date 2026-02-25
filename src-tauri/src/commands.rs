use std::path::PathBuf;
use std::time::Instant;

use crate::deleter;
use crate::grouper;
use crate::scanner;
use crate::settings::{self, AppSettings};
use crate::types::{self, DuplicateGroup, FileEntryDto, ScanResult};

/// Return the default downloads folder path.
#[tauri::command]
pub fn cmd_get_default_folder() -> String {
    settings::default_downloads_folder()
        .to_string_lossy()
        .to_string()
}

/// Load settings from disk.
#[tauri::command]
pub fn cmd_get_settings() -> Result<AppSettings, String> {
    Ok(settings::load_settings())
}

/// Save settings to disk.
#[tauri::command]
pub fn cmd_save_settings(settings: AppSettings) -> Result<(), String> {
    settings::save_settings(&settings)
}

/// Open a folder in the system file manager.
#[tauri::command]
pub fn cmd_open_folder(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open folder: {}", e))
}

/// Scan a folder for duplicate files.
///
/// Runs on a background thread (async command) so the UI stays responsive
/// during disk I/O and hashing.
#[tauri::command(rename_all = "snake_case")]
pub async fn cmd_scan(
    folder: String,
    days: u32,
    use_hash: bool,
    use_size: bool,
    use_name: bool,
    use_mtime: bool,
    hash_limit_enabled: bool,
    hash_max_mb: u32,
    include_subfolders: bool,
    name_prefix: String,
) -> Result<ScanResult, String> {
    // Move CPU-heavy work to a blocking thread so we don't starve the async
    // runtime.  `spawn_blocking` returns a JoinHandle whose error we convert.
    tokio::task::spawn_blocking(move || {
        scan_blocking(
            folder,
            days,
            use_hash,
            use_size,
            use_name,
            use_mtime,
            hash_limit_enabled,
            hash_max_mb,
            include_subfolders,
            name_prefix,
        )
    })
    .await
    .map_err(|e| format!("Scan task panicked: {}", e))?
}

/// The actual scan logic, called inside `spawn_blocking`.
fn scan_blocking(
    folder: String,
    days: u32,
    use_hash: bool,
    use_size: bool,
    use_name: bool,
    use_mtime: bool,
    hash_limit_enabled: bool,
    hash_max_mb: u32,
    include_subfolders: bool,
    name_prefix: String,
) -> Result<ScanResult, String> {
    let start = Instant::now();
    let folder_path = PathBuf::from(&folder);

    if !folder_path.exists() {
        return Err(format!("Folder does not exist: {}", folder));
    }

    // Gather files.
    let prefix = if name_prefix.is_empty() {
        None
    } else {
        Some(name_prefix.as_str())
    };
    let (entries, scan_skipped) =
        scanner::gather_recent_files(&folder_path, days, prefix, include_subfolders);

    let total_files_scanned = entries.len();

    // Compute hash_max_bytes.
    let hash_max_bytes: Option<u64> = if hash_limit_enabled {
        Some(u64::from(hash_max_mb) * 1024 * 1024)
    } else {
        None
    };

    // Find duplicate groups.
    let (raw_groups, hash_skipped) =
        grouper::find_duplicate_groups(&entries, use_hash, use_size, use_name, use_mtime, hash_max_bytes);

    // Convert to DTOs for the frontend.
    let groups: Vec<DuplicateGroup> = raw_groups
        .iter()
        .map(|(key, files)| {
            let file_dtos: Vec<FileEntryDto> = files
                .iter()
                .map(|f| {
                    let name = f
                        .path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let folder_str = f
                        .path
                        .parent()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let mtime_formatted = chrono::DateTime::from_timestamp(f.mtime as i64, 0)
                        .map(|dt| {
                            dt.with_timezone(&chrono::Local)
                                .format("%Y-%m-%d %H:%M:%S")
                                .to_string()
                        })
                        .unwrap_or_default();

                    FileEntryDto {
                        path: f.path.to_string_lossy().to_string(),
                        name,
                        folder: folder_str,
                        size: f.size,
                        size_human: types::human_size(f.size),
                        mtime: f.mtime,
                        mtime_formatted,
                    }
                })
                .collect();

            DuplicateGroup {
                key_description: types::describe_key(key),
                files: file_dtos,
            }
        })
        .collect();

    let elapsed = start.elapsed().as_secs_f64();

    Ok(ScanResult {
        groups,
        total_files_scanned,
        hash_skipped,
        scan_skipped,
        elapsed_seconds: elapsed,
    })
}

/// Delete files (move to trash or permanent delete).
///
/// Runs on a background thread so the UI stays responsive during I/O.
#[tauri::command]
pub async fn cmd_delete(paths: Vec<String>) -> Result<usize, String> {
    tokio::task::spawn_blocking(move || {
        let path_bufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
        let result = deleter::delete_files(&path_bufs);

        if !result.errors.is_empty() {
            let error_msgs: Vec<String> = result
                .errors
                .iter()
                .map(|(path, msg)| format!("{}: {}", path, msg))
                .collect();
            return Err(format!(
                "Deleted {} files but {} errors:\n{}",
                result.deleted,
                result.errors.len(),
                error_msgs.join("\n")
            ));
        }

        Ok(result.deleted)
    })
    .await
    .map_err(|e| format!("Delete task panicked: {}", e))?
}
