use chrono::Local;
use serde::Serialize;
use std::io::Write;
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;

#[derive(Serialize)]
pub struct BackupInfo {
    pub path: String,
    pub filename: String,
    pub size_mb: f64,
    pub created_ms: u64,
}

#[tauri::command]
pub fn backup_world(location: String, backup_dir: String) -> Result<BackupInfo, String> {
    let server_path = Path::new(&location);
    let server_name = server_path
        .file_name()
        .ok_or("Invalid server path")?
        .to_string_lossy();

    let timestamp = Local::now().format("%Y-%m-%d_%H-%M-%S");
    let filename = format!("{server_name}_{timestamp}.zip");

    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let zip_path = Path::new(&backup_dir).join(&filename);

    let file = std::fs::File::create(&zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    // Zip all world* directories
    for entry in std::fs::read_dir(server_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();

        if !p.is_dir() || !(name == "world" || name.starts_with("world_")) {
            continue;
        }

        for inner in walkdir::WalkDir::new(&p).into_iter().filter_map(|e| e.ok()) {
            let ipath = inner.path();
            let rel = ipath
                .strip_prefix(server_path)
                .map_err(|e| e.to_string())?;
            let rel_str = rel.to_string_lossy().replace('\\', "/");

            if ipath.is_dir() {
                zip.add_directory(&rel_str, options).map_err(|e| e.to_string())?;
            } else {
                zip.start_file(&rel_str, options).map_err(|e| e.to_string())?;
                let data = std::fs::read(ipath).map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;

    let meta = std::fs::metadata(&zip_path).map_err(|e| e.to_string())?;
    let size_mb = meta.len() as f64 / 1024.0 / 1024.0;
    let created_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Ok(BackupInfo {
        path: zip_path.to_string_lossy().to_string(),
        filename,
        size_mb,
        created_ms,
    })
}

#[tauri::command]
pub fn list_backups(backup_dir: String, server_name: String) -> Vec<BackupInfo> {
    let dir = Path::new(&backup_dir);
    if !dir.exists() {
        return vec![];
    }

    let prefix = format!("{server_name}_");
    let mut backups: Vec<BackupInfo> = std::fs::read_dir(dir)
        .ok()
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let p = e.path();
            if !p.is_file() {
                return None;
            }
            let name = p.file_name()?.to_string_lossy().to_string();
            if !name.starts_with(&prefix) || !name.ends_with(".zip") {
                return None;
            }

            let meta = p.metadata().ok()?;
            let size_mb = meta.len() as f64 / 1024.0 / 1024.0;
            let created_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);

            Some(BackupInfo {
                path: p.to_string_lossy().to_string(),
                filename: name,
                size_mb,
                created_ms,
            })
        })
        .collect();

    backups.sort_by(|a, b| b.created_ms.cmp(&a.created_ms));
    backups
}

#[tauri::command]
pub fn delete_backup(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}
