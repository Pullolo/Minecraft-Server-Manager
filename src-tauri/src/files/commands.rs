use crate::files::{filesystem::{Server, dir_exists, get_server_storage_size, get_servers}, mem::{AppData, AppState, load_data, save_data}};
use tauri::State;
use tauri::command;

#[tauri::command]
pub fn get_app_data(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<AppData, String> {
    // Lock the mutex
    let mut data_guard = state.data.lock().unwrap();

    // If the data is not loaded yet, load it
    if data_guard.is_none() {
        let loaded_data = load_data(&app)?; // This will create default if first time
        *data_guard = Some(loaded_data);
    }

    // Clone the data to return
    Ok(data_guard.as_ref().unwrap().clone())
}

#[tauri::command]
pub fn save_app_data(app: tauri::AppHandle, state: tauri::State<AppState>, data: AppData) -> Result<(), String> {
    save_data(&app, &data).expect("Didn't Save!");
    let mut data_guard = state.data.lock().unwrap();
    *data_guard = Some(data);
    Ok(())
}

#[tauri::command]
pub fn folder_exists(path: &str) -> bool {
    return dir_exists(path);
}

#[tauri::command]
pub fn fetch_servers(state: tauri::State<AppState>) -> Vec<Server> {
    return get_servers(state);
}

#[tauri::command]
pub async fn fetch_server_storage_sizes(
    state: State<'_, AppState>
) -> Result<Vec<String>, String> {
    let dir: String = state.data.lock().unwrap().as_ref().unwrap().clone().working_dir;
    
    let result = tokio::task::spawn_blocking(move || {
        get_server_storage_size(dir)
    })
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(result)
}

#[command]
pub fn open_directory(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[command]
pub fn open_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Open Windows Terminal if available, fallback to cmd
        let terminal_result = std::process::Command::new("wt")
            .args(["-d", &path])
            .spawn();
            
        if terminal_result.is_err() {
            // Fallback to cmd.exe
            std::process::Command::new("cmd")
                .args(["/c", "start", "cmd.exe"])
                .current_dir(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // Open Terminal.app
        std::process::Command::new("open")
            .args(["-a", "Terminal", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try common terminal emulators
        let terminals = ["gnome-terminal", "konsole", "xfce4-terminal", "xterm"];
        let mut success = false;
        
        for terminal in &terminals {
            let result = std::process::Command::new(terminal)
                .arg("--working-directory")
                .arg(&path)
                .spawn();
                
            if result.is_ok() {
                success = true;
                break;
            }
        }
        
        if !success {
            return Err("No terminal emulator found".to_string());
        }
    }
    
    Ok(())
}