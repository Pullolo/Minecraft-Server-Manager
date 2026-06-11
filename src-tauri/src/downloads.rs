use std::path::Path;
use serde::Serialize;

#[derive(Serialize)]
pub struct InstalledFile {
    pub name: String,
    pub size: u64,
    pub path: String,
}

/// Downloads a file from `url` and saves it to `<server_location>/<sub_folder>/<filename>`.
/// Creates the destination directory if it doesn't exist.
#[tauri::command]
pub async fn download_content(
    url: String,
    server_location: String,
    sub_folder: String,
    filename: String,
) -> Result<(), String> {
    let dest_dir = Path::new(&server_location).join(&sub_folder);

    tokio::fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| format!("Cannot create {}: {e}", dest_dir.display()))?;

    let client = reqwest::Client::builder()
        .user_agent("mc-server-manager/1.0.0 (github.com/user/mc-server-manager)")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Failed to read body: {e}"))?;

    let dest_file = dest_dir.join(&filename);
    tokio::fs::write(&dest_file, &bytes)
        .await
        .map_err(|e| format!("Failed to write {filename}: {e}"))?;

    Ok(())
}

/// Lists files inside `<server_location>/<sub_folder>`, sorted alphabetically.
#[tauri::command]
pub fn list_installed_content(
    server_location: String,
    sub_folder: String,
) -> Result<Vec<InstalledFile>, String> {
    let dir = Path::new(&server_location).join(&sub_folder);

    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut files: Vec<InstalledFile> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_file() {
                return None;
            }
            let meta = path.metadata().ok()?;
            Some(InstalledFile {
                name: path.file_name()?.to_string_lossy().into_owned(),
                size: meta.len(),
                path: path.to_string_lossy().into_owned(),
            })
        })
        .collect();

    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(files)
}

/// Permanently deletes a single file by absolute path.
#[tauri::command]
pub fn delete_installed_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Cannot delete: {e}"))
}
