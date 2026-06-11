use std::{fs, path::Path};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::files::mem::AppState;

fn detect_engine(path: &Path) -> String {
    // Fabric — launcher jar or properties file
    if path.join("fabric-server-launch.jar").exists()
        || path.join("fabric-server-launcher.properties").exists()
    {
        return "Fabric".to_string();
    }

    // Forge modern (1.17+) — run script + user_jvm_args.txt, or minecraftforge libs
    let forge_libs = path.join("libraries").join("net").join("minecraftforge").exists();
    let forge_script = (path.join("run.bat").exists() || path.join("run.sh").exists())
        && path.join("user_jvm_args.txt").exists();
    if forge_libs || forge_script {
        return "Forge".to_string();
    }

    // Forge legacy — forge-*.jar at root
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            if name.starts_with("forge-") && name.ends_with(".jar") {
                return "Forge".to_string();
            }
        }
    }

    // Paper — version_history.json or paper.jar
    if path.join("version_history.json").exists() || path.join("paper.jar").exists() {
        return "Paper".to_string();
    }

    // Purpur
    if path.join("purpur.jar").exists() {
        return "Purpur".to_string();
    }

    // Spigot
    if path.join("spigot.jar").exists() {
        return "Spigot".to_string();
    }

    "Vanilla".to_string()
}

fn detect_version(path: &Path, engine: &str) -> String {
    match engine {
        "Fabric" => {
            // fabric-server-launcher.properties: game-version=1.21.1
            let props = path.join("fabric-server-launcher.properties");
            if let Ok(content) = fs::read_to_string(props) {
                for line in content.lines() {
                    if let Some(v) = line.strip_prefix("game-version=") {
                        return v.trim().to_string();
                    }
                }
            }
        }
        "Paper" | "Purpur" | "Spigot" => {
            // version_history.json: {"currentVersion":"1.21.1-123-abc..."}
            let hist = path.join("version_history.json");
            if let Ok(content) = fs::read_to_string(hist) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(ver) = json["currentVersion"].as_str() {
                        // "1.21.1-123-abc" → "1.21.1"
                        if let Some(mc) = ver.split('-').next() {
                            return mc.to_string();
                        }
                    }
                }
            }
        }
        "Forge" => {
            // Modern: libraries/net/minecraftforge/forge/{mc-ver}-{forge-ver}/
            let forge_dir = path
                .join("libraries")
                .join("net")
                .join("minecraftforge")
                .join("forge");
            if let Ok(entries) = fs::read_dir(&forge_dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if let Some(mc) = name.split('-').next() {
                        if !mc.is_empty() {
                            return mc.to_string();
                        }
                    }
                }
            }
            // Legacy: forge-{mc-ver}-{forge-ver}[-universal].jar
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if name.starts_with("forge-") && name.ends_with(".jar") {
                        let stripped = name.strip_prefix("forge-").unwrap_or(&name);
                        if let Some(mc) = stripped.split('-').next() {
                            return mc.to_string();
                        }
                    }
                }
            }
        }
        _ => {
            // Vanilla: version.json created after first server run
            let vj = path.join("version.json");
            if let Ok(content) = fs::read_to_string(vj) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    for key in &["Name", "id", "name"] {
                        if let Some(v) = json[*key].as_str() {
                            return v.to_string();
                        }
                    }
                }
            }
        }
    }
    "Unknown".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Server {
    name: String,
    engine: String,
    version: String,
    location: String,
    last_played: String,
    players: i32
}

pub fn dir_exists(path: &str) -> bool {
    let p = Path::new(path);
    return p.exists() && p.is_dir();
}

fn count_players(path: &Path) -> i32 {
    let playerdata_path = path.join("world").join("playerdata");

    // If folder missing → return 0
    let entries = match fs::read_dir(&playerdata_path) {
        Ok(e) => e,
        Err(_) => return 0,
    };

    let mut count = 0;

    for entry in entries.flatten() {
        let path = entry.path();

        // We only want files ending with .dat
        if let Some(ext) = path.extension() {
            if ext == "dat" {
                count += 1;
            }
        }
    }

    count
}

pub fn get_servers(state: tauri::State<AppState>) -> Vec<Server> {
    let p = state.data.lock().unwrap().as_ref().unwrap().clone().working_dir;
    let servers_path = Path::new(&p);

    let mut servers = vec![];

    let contents = fs::read_dir(&servers_path).unwrap();
    for dir in contents {
        let path = dir.unwrap().path();

        //todo check if path contains a .jar or forge/fabric metadata file

        let engine = detect_engine(&path);
        let version = detect_version(&path, &engine);
        let server = Server {
            name: path.file_name().unwrap().to_string_lossy().to_string(),
            engine,
            version,
            location: path.to_string_lossy().to_string(),
            last_played: chrono::DateTime::<chrono::Utc>::from(
                std::fs::metadata(&path).unwrap().modified().unwrap()
            ).to_rfc3339(),
            players: count_players(&path)
        };

        servers.push(server);
    }

    return servers;
}

pub fn get_server_storage_size(working_dir: String) -> Vec<String>{
    let servers_path = Path::new(&working_dir);
    let mut servers = vec![];

    let contents = fs::read_dir(&servers_path).unwrap();
    for dir in contents {
        let path = dir.unwrap().path();
        let size_gb: f64 = WalkDir::new(&path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter_map(|e| e.metadata().ok())
            .map(|m| m.len() as f64)
            .sum::<f64>() / 1e9;
        servers.push(format!("{:.2} GB", size_gb));
    }

    servers
}