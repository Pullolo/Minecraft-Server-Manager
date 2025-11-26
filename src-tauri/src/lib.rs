pub mod files;
pub mod tcp;
use files::commands::{folder_exists, get_app_data, save_app_data, fetch_servers, fetch_server_storage_sizes};
use tcp::commands::ping_minecraft_server;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(crate::files::mem::AppState::new())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_app_data, folder_exists, save_app_data, fetch_servers, fetch_server_storage_sizes, ping_minecraft_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
