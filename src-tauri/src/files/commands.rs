use crate::files::{filesystem::{Server, dir_exists, get_server_storage_size, get_servers}, mem::{AppData, AppState, load_data, save_data}};
use tauri::State;

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