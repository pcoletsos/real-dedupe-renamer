use std::path::PathBuf;

use directories::UserDirs;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

/// Application settings, persisted as JSON.
///
/// Field names and defaults match the Python version for settings compatibility.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub folder: String,
    pub days: u32,
    pub use_hash: bool,
    pub use_size: bool,
    pub use_name: bool,
    pub use_mtime: bool,
    pub use_mime: bool,
    pub hash_limit_enabled: bool,
    pub hash_max_mb: u32,
    pub skip_same_folder_prompt: bool,
    pub rename_kept_enabled: bool,
    pub show_keep_full_paths: bool,
    pub include_subfolders: bool,
    pub name_prefix: String,
    pub recent_folders: Vec<String>,
    pub view_mode: String,
    pub auto_file_type_preset: String,
    pub theme: String,
    /// Rename-component schema stored as opaque JSON (avoids a circular
    /// dependency between settings and types modules).
    pub rename_components: JsonValue,
    pub rename_separator: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            folder: default_downloads_folder()
                .to_string_lossy()
                .to_string(),
            days: 7,
            use_hash: true,
            use_size: false,
            use_name: false,
            use_mtime: false,
            use_mime: false,
            hash_limit_enabled: true,
            hash_max_mb: 500,
            skip_same_folder_prompt: true,
            rename_kept_enabled: true,
            show_keep_full_paths: false,
            include_subfolders: true,
            name_prefix: String::new(),
            recent_folders: Vec::new(),
            view_mode: "simplified".into(),
            auto_file_type_preset: "all".into(),
            theme: "system".into(),
            rename_components: serde_json::json!([
                { "kind": "folder_name" },
                { "kind": "date_created" },
                { "kind": "time_created" },
                { "kind": "sequence", "pad_width": 3 }
            ]),
            rename_separator: "_".into(),
        }
    }
}

/// Resolve a sensible default downloads folder.
pub fn default_downloads_folder() -> PathBuf {
    if let Some(user_dirs) = UserDirs::new() {
        let downloads = user_dirs.home_dir().join("Downloads");
        if downloads.exists() {
            return downloads;
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Path to the settings JSON file.
pub fn settings_path() -> PathBuf {
    if let Some(proj_dirs) =
        directories::ProjectDirs::from("com", "real-dedupe-renamer", "Real Dedupe Renamer")
    {
        let config_dir = proj_dirs.config_dir();
        return config_dir.join(".duplicate_cleaner_settings.json");
    }
    // Fallback: next to the executable.
    PathBuf::from(".duplicate_cleaner_settings.json")
}

/// Load settings from disk, falling back to defaults on any error.
pub fn load_settings() -> AppSettings {
    let path = settings_path();
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

/// Save settings to disk.
pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_downloads_folder_returns_pathbuf() {
        let result = default_downloads_folder();
        // Should return some valid path.
        assert!(result.to_str().is_some());
    }

    #[test]
    fn test_default_settings() {
        let s = AppSettings::default();
        assert_eq!(s.days, 7);
        assert!(s.use_hash);
        assert!(!s.use_size);
        assert_eq!(s.view_mode, "simplified");
        assert_eq!(s.auto_file_type_preset, "all");
    }

    #[test]
    fn test_settings_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");

        let mut s = AppSettings::default();
        s.days = 30;
        s.folder = "/tmp/test".into();

        // Save
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        let json = serde_json::to_string_pretty(&s).unwrap();
        std::fs::write(&path, &json).unwrap();

        // Load
        let content = std::fs::read_to_string(&path).unwrap();
        let loaded: AppSettings = serde_json::from_str(&content).unwrap();
        assert_eq!(loaded.days, 30);
        assert_eq!(loaded.folder, "/tmp/test");
    }
}
