use std::{collections::HashMap, path::Path};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct PropertyPair {
    pub key: String,
    pub value: String,
}

/// Reads server.properties and returns all key=value entries in file order.
/// Comment and blank lines are skipped. Returns empty vec if the file doesn't exist yet.
#[tauri::command]
pub fn read_server_properties(location: String) -> Result<Vec<PropertyPair>, String> {
    let path = Path::new(&location).join("server.properties");
    if !path.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut pairs = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            pairs.push(PropertyPair {
                key: k.trim().to_string(),
                value: v.to_string(), // preserve the full value (may contain '=')
            });
        }
    }

    Ok(pairs)
}

/// Writes key=value pairs back to server.properties.
/// Preserves existing comments and line ordering; appends new keys at the end.
#[tauri::command]
pub fn write_server_properties(
    location: String,
    properties: Vec<PropertyPair>,
) -> Result<(), String> {
    let path = Path::new(&location).join("server.properties");

    // Build lookup from new values
    let updates: HashMap<String, String> = properties
        .iter()
        .map(|p| (p.key.clone(), p.value.clone()))
        .collect();

    // Read existing file to preserve structure (comments, ordering)
    let existing = if path.exists() {
        std::fs::read_to_string(&path).unwrap_or_default()
    } else {
        String::new()
    };

    let mut output: Vec<String> = Vec::new();
    let mut written: std::collections::HashSet<String> = std::collections::HashSet::new();

    for line in existing.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            output.push(line.to_string());
        } else if let Some((k, _)) = trimmed.split_once('=') {
            let key = k.trim().to_string();
            if let Some(val) = updates.get(&key) {
                output.push(format!("{}={}", key, val));
                written.insert(key);
            } else {
                // Key removed from our set — keep original line
                output.push(line.to_string());
            }
        } else {
            output.push(line.to_string());
        }
    }

    // Append any keys that weren't already in the file
    for p in &properties {
        if !written.contains(&p.key) {
            output.push(format!("{}={}", p.key, p.value));
        }
    }

    std::fs::write(&path, output.join("\n") + "\n").map_err(|e| e.to_string())
}
