use std::time::Duration;

use tauri::State;

use crate::{files::mem::AppState, tcp::minecraft::{ServerPingResult, try_ping_async}};

#[tauri::command]
pub async fn ping_minecraft_server(state: State<'_, AppState>) -> Result<ServerPingResult, String> {
    let (address, port) = {
        let data = state.data.lock().unwrap();
        let app_data = data.as_ref().ok_or("No app data available")?;
        (app_data.ping_address.clone(), app_data.ping_port)
    };

    match tokio::time::timeout(Duration::from_secs(5), try_ping_async(&address, port)).await {
        Ok(Ok(latency)) => Ok(ServerPingResult {
            online: true,
            latency,
        }),
        Ok(Err(_)) | Err(_) => Ok(ServerPingResult {
            online: false,
            latency: 0,
        }),
    }
}