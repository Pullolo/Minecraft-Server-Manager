use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct InstalledFile {
    pub name: String,
    pub size: u64,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ContentMeta {
    pub project_id: String,
    pub version_id: String,
    pub version_number: String,
    pub name: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct UpdateInfo {
    pub filename: String,
    pub project_id: String,
    pub current_version_id: String,
    pub current_version_number: String,
    pub latest_version_id: String,
    pub latest_version_number: String,
    pub has_update: bool,
}

fn meta_path(server_location: &str, sub_folder: &str) -> std::path::PathBuf {
    Path::new(server_location)
        .join(sub_folder)
        .join(".mc-manager-meta.json")
}

fn read_meta(server_location: &str, sub_folder: &str) -> HashMap<String, ContentMeta> {
    let path = meta_path(server_location, sub_folder);
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_meta(server_location: &str, sub_folder: &str, map: &HashMap<String, ContentMeta>) -> Result<(), String> {
    let path = meta_path(server_location, sub_folder);
    let json = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

/// Downloads a file from `url` and saves it to `<server_location>/<sub_folder>/<filename>`.
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

/// Saves Modrinth metadata for a downloaded file so update checks work later.
#[tauri::command]
pub fn save_content_metadata(
    server_location: String,
    sub_folder: String,
    filename: String,
    project_id: String,
    version_id: String,
    version_number: String,
    name: String,
) -> Result<(), String> {
    let mut map = read_meta(&server_location, &sub_folder);
    map.insert(
        filename,
        ContentMeta { project_id, version_id, version_number, name },
    );
    write_meta(&server_location, &sub_folder, &map)
}

/// Returns stored metadata for all files in a sub-folder.
#[tauri::command]
pub fn get_content_metadata(
    server_location: String,
    sub_folder: String,
) -> HashMap<String, ContentMeta> {
    read_meta(&server_location, &sub_folder)
}

/// Checks Modrinth for updates for all tracked files in a sub-folder.
#[tauri::command]
pub async fn check_content_updates(
    server_location: String,
    sub_folder: String,
    loader: String,
    game_version: String,
) -> Result<Vec<UpdateInfo>, String> {
    let meta_map = read_meta(&server_location, &sub_folder);
    if meta_map.is_empty() {
        return Ok(vec![]);
    }

    let client = reqwest::Client::builder()
        .user_agent("mc-server-manager/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for (filename, meta) in &meta_map {
        let url = format!(
            "https://api.modrinth.com/v2/project/{}/version?loaders={}&game_versions={}",
            meta.project_id,
            serde_json::json!([loader]),
            serde_json::json!([game_version]),
        );

        let resp = client.get(&url).send().await;
        let Ok(resp) = resp else { continue };
        if !resp.status().is_success() { continue; }

        let Ok(versions) = resp.json::<serde_json::Value>().await else { continue };
        let Some(arr) = versions.as_array() else { continue };
        let Some(latest) = arr.first() else { continue };

        let latest_id = latest["id"].as_str().unwrap_or("").to_string();
        let latest_num = latest["version_number"].as_str().unwrap_or("").to_string();
        let has_update = !latest_id.is_empty() && latest_id != meta.version_id;

        results.push(UpdateInfo {
            filename: filename.clone(),
            project_id: meta.project_id.clone(),
            current_version_id: meta.version_id.clone(),
            current_version_number: meta.version_number.clone(),
            latest_version_id: latest_id,
            latest_version_number: latest_num,
            has_update,
        });
    }

    Ok(results)
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
            let name = path.file_name()?.to_string_lossy().to_string();
            // Skip hidden metadata file
            if name.starts_with('.') {
                return None;
            }
            let meta = path.metadata().ok()?;
            Some(InstalledFile {
                name,
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
