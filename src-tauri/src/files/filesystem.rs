use std::{fs, path::Path};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::files::mem::AppState;

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

        let server = Server {
            name: path.file_name().unwrap().to_string_lossy().to_string(),
            engine: String::from("Vanilla"), //todo
            version: String::from("1.21.10"), //todo
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