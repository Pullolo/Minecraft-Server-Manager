use serde::{Deserialize, Serialize};
use std::{env, fs, path::PathBuf, sync::Mutex};
use tauri::{path::BaseDirectory, AppHandle, Manager};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppData {
    pub working_dir: String,
    pub ping_address: String,
    pub ping_port: u16
}

pub fn get_default_data() -> AppData {
    return AppData {
        working_dir: default_working_dir(),
        ping_address: String::from("localhost"),
        ping_port: 25565
    };
}

pub struct AppState {
    pub data: Mutex<Option<AppData>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            data: Mutex::new(None),
        }
    }
}

pub fn save_data(app: &AppHandle, data: &AppData) -> Result<(), String> {
    // Resolve path: <AppDataDir>/app_data.json
    let path = app
        .path()
        .resolve("app_data.json", BaseDirectory::AppData)
        .map_err(|e| e.to_string())?;

    // Ensure parent directory exists
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }

    // Write JSON
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(())
}

fn default_working_dir() -> String {
    let mut path = if cfg!(windows) {
        env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
    } else if cfg!(target_os = "macos") {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library/Application Support")
    } else {
        // Linux / Unix
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".minecraft")
    };

    path.push("minecraft-servers");
    
    if !path.exists() {
        fs::create_dir(&path).unwrap_or_default();
    }
    return path.to_string_lossy().into_owned();
}

pub fn load_data(app: &AppHandle) -> Result<AppData, String> {
    let path = app
        .path()
        .resolve("app_data.json", BaseDirectory::AppData)
        .map_err(|e| e.to_string())?;

    if !path.exists() {
        let default_data = get_default_data();

        save_data(app, &default_data)?;

        return Ok(default_data);
    }

    let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let data: AppData = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    Ok(data)
}
