use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::imageops::FilterType;
use std::path::Path;

/// Reads server-icon.png from the server directory and returns it as a
/// base64-encoded PNG data URL, or None if the file doesn't exist.
#[tauri::command]
pub fn get_server_icon(location: String) -> Option<String> {
    let path = Path::new(&location).join("server-icon.png");
    if !path.exists() {
        return None;
    }
    let bytes = std::fs::read(&path).ok()?;
    Some(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)))
}

/// Opens any image at `source_path`, resizes it to 64×64 (the Minecraft
/// server-icon standard), and saves it as server-icon.png in `location`.
#[tauri::command]
pub fn set_server_icon(location: String, source_path: String) -> Result<(), String> {
    let img = image::open(&source_path)
        .map_err(|e| format!("Cannot open image: {e}"))?;

    let resized = img.resize_exact(64, 64, FilterType::Lanczos3);

    let dest = Path::new(&location).join("server-icon.png");
    resized
        .save(&dest)
        .map_err(|e| format!("Cannot save icon: {e}"))?;

    Ok(())
}
