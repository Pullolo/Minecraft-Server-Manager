use serde::{Deserialize, Serialize};
use std::path::Path;

/// Looks up a player's UUID from Mojang's API by username.
/// Returns a WhitelistEntry with the correct UUID and canonical name.
#[tauri::command]
pub async fn lookup_player(name: String) -> Result<WhitelistEntry, String> {
    let client = reqwest::Client::builder()
        .user_agent("mc-server-manager/1.0.0")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://api.mojang.com/users/profiles/minecraft/{name}");
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if resp.status().as_u16() == 204 || resp.status().as_u16() == 404 {
        return Err(format!("Player '{name}' not found"));
    }
    if !resp.status().is_success() {
        return Err(format!("Mojang API error: {}", resp.status()));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let raw = json["id"].as_str().unwrap_or("").to_string();
    let canonical = json["name"].as_str().unwrap_or(&name).to_string();

    let uuid = if raw.len() == 32 {
        format!(
            "{}-{}-{}-{}-{}",
            &raw[0..8], &raw[8..12], &raw[12..16], &raw[16..20], &raw[20..32]
        )
    } else {
        raw
    };

    Ok(WhitelistEntry { uuid, name: canonical })
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct WhitelistEntry {
    pub uuid: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OpEntry {
    pub uuid: String,
    pub name: String,
    pub level: u8,
    #[serde(rename = "bypassesPlayerLimit", default)]
    pub bypasses_player_limit: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BannedPlayerEntry {
    pub uuid: String,
    pub name: String,
    pub created: String,
    pub source: String,
    pub expires: String,
    pub reason: String,
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Vec<T> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_json<T: Serialize>(path: &Path, data: &[T]) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_whitelist(location: String) -> Vec<WhitelistEntry> {
    read_json(&Path::new(&location).join("whitelist.json"))
}

#[tauri::command]
pub fn set_whitelist(location: String, entries: Vec<WhitelistEntry>) -> Result<(), String> {
    write_json(&Path::new(&location).join("whitelist.json"), &entries)
}

#[tauri::command]
pub fn get_ops(location: String) -> Vec<OpEntry> {
    read_json(&Path::new(&location).join("ops.json"))
}

#[tauri::command]
pub fn set_ops(location: String, entries: Vec<OpEntry>) -> Result<(), String> {
    write_json(&Path::new(&location).join("ops.json"), &entries)
}

#[tauri::command]
pub fn get_banned_players(location: String) -> Vec<BannedPlayerEntry> {
    read_json(&Path::new(&location).join("banned-players.json"))
}

#[tauri::command]
pub fn unban_player(location: String, uuid: String) -> Result<(), String> {
    let path = Path::new(&location).join("banned-players.json");
    let mut entries: Vec<BannedPlayerEntry> = read_json(&path);
    entries.retain(|e| e.uuid != uuid);
    write_json(&path, &entries)
}
