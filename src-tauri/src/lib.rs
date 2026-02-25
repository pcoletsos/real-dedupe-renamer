mod autorenamer;
mod commands;
mod deleter;
mod grouper;
mod hasher;
mod scanner;
mod settings;
mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::cmd_get_default_folder,
            commands::cmd_get_settings,
            commands::cmd_save_settings,
            commands::cmd_open_folder,
            commands::cmd_scan,
            commands::cmd_scan_auto_rename,
            commands::cmd_auto_rename,
            commands::cmd_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
