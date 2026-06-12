use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ServerConfig {
    pub memory_mb: Option<u32>,
    pub extra_jvm_flags: Option<String>,
}

pub fn read_config(location: &str) -> ServerConfig {
    let path = Path::new(location).join("server-manager.json");
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_server_config(location: String) -> ServerConfig {
    read_config(&location)
}

#[tauri::command]
pub fn save_server_config(location: String, config: ServerConfig) -> Result<(), String> {
    let path = Path::new(&location).join("server-manager.json");
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_server(location: String) -> Result<(), String> {
    std::fs::remove_dir_all(&location)
        .map_err(|e| format!("Failed to delete server: {e}"))
}

#[tauri::command]
pub fn rename_server(location: String, new_name: String) -> Result<String, String> {
    let path = Path::new(&location);
    let parent = path.parent().ok_or("Invalid server path")?;

    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Name cannot contain slashes".to_string());
    }

    let new_path = parent.join(trimmed);
    if new_path.exists() {
        return Err(format!("A folder named '{trimmed}' already exists"));
    }

    std::fs::rename(path, &new_path).map_err(|e| format!("Rename failed: {e}"))?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_server_log(location: String) -> Result<String, String> {
    let log_path = Path::new(&location).join("logs").join("latest.log");
    if !log_path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&log_path).map_err(|e| e.to_string())
}
