pub mod files;
pub mod tcp;
pub mod process;
pub mod downloads;
pub mod create;
pub mod properties;
pub mod icon;

use files::commands::{folder_exists, get_app_data, save_app_data, fetch_servers, fetch_server_storage_sizes, open_directory, open_terminal};
use tcp::commands::ping_minecraft_server;
use process::commands::{start_server, stop_server, send_server_command, get_server_status, get_running_server_location};
use downloads::{download_content, list_installed_content, delete_installed_file};
use properties::{read_server_properties, write_server_properties};
use icon::{get_server_icon, set_server_icon};
use create::{
    fetch_vanilla_versions, fetch_paper_versions, fetch_paper_builds,
    fetch_fabric_game_versions, fetch_forge_mc_versions, fetch_forge_versions,
    create_server,
};

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
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_data,
            folder_exists,
            save_app_data,
            fetch_servers,
            fetch_server_storage_sizes,
            ping_minecraft_server,
            open_directory,
            open_terminal,
            start_server,
            stop_server,
            send_server_command,
            get_server_status,
            get_running_server_location,
            download_content,
            list_installed_content,
            delete_installed_file,
            read_server_properties,
            write_server_properties,
            get_server_icon,
            set_server_icon,
            fetch_vanilla_versions,
            fetch_paper_versions,
            fetch_paper_builds,
            fetch_fabric_game_versions,
            fetch_forge_mc_versions,
            fetch_forge_versions,
            create_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
