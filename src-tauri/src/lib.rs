pub mod files;
pub mod tcp;
pub mod process;
pub mod downloads;
pub mod create;
pub mod properties;
pub mod icon;
pub mod server_config;
pub mod stats;
pub mod backup;
pub mod players;

use files::commands::{folder_exists, get_app_data, save_app_data, fetch_servers, fetch_server_storage_sizes, open_directory, open_terminal};
use tcp::commands::ping_minecraft_server;
use process::commands::{start_server, stop_server, send_server_command, get_server_status, get_running_server_location};
use downloads::{download_content, list_installed_content, delete_installed_file, save_content_metadata, get_content_metadata, check_content_updates};
use properties::{read_server_properties, write_server_properties};
use icon::{get_server_icon, set_server_icon};
use create::{
    fetch_vanilla_versions, fetch_paper_versions, fetch_paper_builds,
    fetch_fabric_game_versions, fetch_forge_mc_versions, fetch_forge_versions,
    create_server,
};
use server_config::{get_server_config, save_server_config, delete_server, rename_server, read_server_log};
use stats::get_server_resource_usage;
use backup::{backup_world, list_backups, delete_backup};
use players::{get_whitelist, set_whitelist, get_ops, set_ops, get_banned_players, unban_player, lookup_player};

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
            save_content_metadata,
            get_content_metadata,
            check_content_updates,
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
            get_server_config,
            save_server_config,
            delete_server,
            rename_server,
            read_server_log,
            get_server_resource_usage,
            backup_world,
            list_backups,
            delete_backup,
            get_whitelist,
            set_whitelist,
            get_ops,
            set_ops,
            get_banned_players,
            unban_player,
            lookup_player,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
