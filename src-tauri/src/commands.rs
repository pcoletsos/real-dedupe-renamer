use std::path::PathBuf;
use std::time::Instant;

use crate::autorenamer;
use crate::deleter;
use crate::grouper;
use crate::scanner;
use crate::settings::{self, AppSettings};
use crate::types::{
    self, AutoRenameCandidateDto, AutoRenameResult, AutoRenameScanResult, DuplicateGroup,
    FileEntryDto, RenameSchema, ScanProgress, ScanResult,
};
use tauri::Emitter;

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
    app: tauri::AppHandle,
    folder: String,
    days: u32,
    use_hash: bool,
    use_size: bool,
    use_name: bool,
    use_mtime: bool,
    use_mime: bool,
    hash_limit_enabled: bool,
    hash_max_mb: u32,
    include_subfolders: bool,
    name_prefix: String,
) -> Result<ScanResult, String> {
    // Move CPU-heavy work to a blocking thread so we don't starve the async
    // runtime.  `spawn_blocking` returns a JoinHandle whose error we convert.
    tokio::task::spawn_blocking(move || {
        scan_blocking(
            &app,
            folder,
            days,
            use_hash,
            use_size,
            use_name,
            use_mtime,
            use_mime,
            hash_limit_enabled,
            hash_max_mb,
            include_subfolders,
            name_prefix,
        )
    })
    .await
    .map_err(|e| format!("Scan task panicked: {}", e))?
}

/// Scan a folder for auto-renamer candidate files.
#[tauri::command(rename_all = "snake_case")]
pub async fn cmd_scan_auto_rename(
    folder: String,
    days: u32,
    include_subfolders: bool,
    name_prefix: String,
    file_type_preset: String,
) -> Result<AutoRenameScanResult, String> {
    tokio::task::spawn_blocking(move || {
        scan_auto_rename_blocking(
            folder,
            days,
            include_subfolders,
            name_prefix,
            file_type_preset,
        )
    })
    .await
    .map_err(|e| format!("Auto-rename scan task panicked: {}", e))?
}

/// The actual scan logic, called inside `spawn_blocking`.
fn scan_blocking(
    app: &tauri::AppHandle,
    folder: String,
    days: u32,
    use_hash: bool,
    use_size: bool,
    use_name: bool,
    use_mtime: bool,
    use_mime: bool,
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

    // Progress callback for the scanning phase.
    let scan_progress = |count: usize| {
        let _ = app.emit(
            "scan-progress",
            ScanProgress {
                phase: "scanning".into(),
                current: count,
                total: 0,
                message: format!("Found {} files...", count),
            },
        );
    };

    // Gather files.
    let prefix = if name_prefix.is_empty() {
        None
    } else {
        Some(name_prefix.as_str())
    };
    let (entries, scan_skipped) =
        scanner::gather_recent_files(&folder_path, days, prefix, include_subfolders, Some(&scan_progress));

    let total_files_scanned = entries.len();

    // Compute hash_max_bytes.
    let hash_max_bytes: Option<u64> = if hash_limit_enabled {
        Some(u64::from(hash_max_mb) * 1024 * 1024)
    } else {
        None
    };

    // Progress callback for the hashing phase.
    let hash_progress = |current: usize, total: usize| {
        let _ = app.emit(
            "scan-progress",
            ScanProgress {
                phase: "hashing".into(),
                current,
                total,
                message: format!("Hashing file {} / {}...", current, total),
            },
        );
    };

    // Find duplicate groups.
    let (raw_groups, hash_skipped) =
        grouper::find_duplicate_groups(&entries, use_hash, use_size, use_name, use_mtime, use_mime, hash_max_bytes, Some(&hash_progress));

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

                    FileEntryDto {
                        path: f.path.to_string_lossy().to_string(),
                        name,
                        folder: folder_str,
                        size: f.size,
                        size_human: types::human_size(f.size),
                        mtime: f.mtime,
                        mtime_formatted: format_mtime(f.mtime),
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

/// The actual auto-renamer scan logic, called inside `spawn_blocking`.
fn scan_auto_rename_blocking(
    folder: String,
    days: u32,
    include_subfolders: bool,
    name_prefix: String,
    file_type_preset: String,
) -> Result<AutoRenameScanResult, String> {
    let start = Instant::now();
    let folder_path = PathBuf::from(&folder);

    if !folder_path.exists() {
        return Err(format!("Folder does not exist: {}", folder));
    }

    // Gather files using shared scan controls (days/prefix/subfolders).
    let prefix = if name_prefix.is_empty() {
        None
    } else {
        Some(name_prefix.as_str())
    };
    let (entries, scan_skipped) =
        scanner::gather_recent_files(&folder_path, days, prefix, include_subfolders, None);

    let total_files_scanned = entries.len();
    let preset = autorenamer::normalize_file_type_preset(&file_type_preset);

    let candidates: Vec<AutoRenameCandidateDto> = entries
        .into_iter()
        .filter(|entry| autorenamer::matches_file_type_preset(&entry.path, &preset))
        .map(|entry| {
            let name = entry
                .path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let folder = entry
                .path
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let extension = entry
                .path
                .extension()
                .map(|e| format!(".{}", e.to_string_lossy().to_ascii_lowercase()))
                .unwrap_or_default();

            let size = entry.size;
            let created = std::fs::metadata(&entry.path)
                .and_then(|m| m.created())
                .map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs_f64()
                })
                .unwrap_or(0.0);

            AutoRenameCandidateDto {
                path: entry.path.to_string_lossy().to_string(),
                name,
                folder,
                extension,
                size,
                mtime: entry.mtime,
                mtime_formatted: format_mtime(entry.mtime),
                created,
            }
        })
        .collect();

    let elapsed = start.elapsed().as_secs_f64();
    Ok(AutoRenameScanResult {
        candidates,
        total_files_scanned,
        scan_skipped,
        elapsed_seconds: elapsed,
    })
}

/// Rename files with the auto-renamer schema.
#[tauri::command(rename_all = "snake_case")]
pub async fn cmd_auto_rename(
    paths: Vec<String>,
    rename_schema: RenameSchema,
) -> Result<AutoRenameResult, String> {
    tokio::task::spawn_blocking(move || {
        let path_bufs: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
        Ok(autorenamer::auto_rename_paths(&path_bufs, &rename_schema))
    })
    .await
    .map_err(|e| format!("Auto-rename task panicked: {}", e))?
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

fn format_mtime(mtime: f64) -> String {
    chrono::DateTime::from_timestamp(mtime as i64, 0)
        .map(|dt| {
            dt.with_timezone(&chrono::Local)
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        })
        .unwrap_or_default()
}
