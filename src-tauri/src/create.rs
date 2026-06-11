use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter};

fn make_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("mc-server-manager/1.0.0")
        .build()
        .map_err(|e| e.to_string())
}

// ── Shared types ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct VersionEntry {
    pub id: String,
    pub stable: bool,
}

// ── Mojang / Vanilla ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct MojangManifest {
    versions: Vec<MojangVersion>,
}

#[derive(Deserialize)]
struct MojangVersion {
    id: String,
    #[serde(rename = "type")]
    version_type: String,
    url: String,
}

#[derive(Deserialize)]
struct MojangVersionMeta {
    downloads: MojangDownloads,
}

#[derive(Deserialize)]
struct MojangDownloads {
    server: Option<MojangFileRef>,
}

#[derive(Deserialize)]
struct MojangFileRef {
    url: String,
}

#[tauri::command]
pub async fn fetch_vanilla_versions() -> Result<Vec<VersionEntry>, String> {
    let client = make_client()?;
    let manifest: MojangManifest = client
        .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(manifest
        .versions
        .into_iter()
        .filter(|v| v.version_type == "release" || v.version_type == "snapshot")
        .map(|v| VersionEntry {
            stable: v.version_type == "release",
            id: v.id,
        })
        .collect())
}

// ── Paper ─────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct PaperProject {
    versions: Vec<String>,
}

#[derive(Deserialize)]
struct PaperBuildsResponse {
    builds: Vec<PaperBuildRaw>,
}

#[derive(Deserialize)]
struct PaperBuildRaw {
    build: u32,
    downloads: PaperBuildDls,
}

#[derive(Deserialize)]
struct PaperBuildDls {
    application: PaperBuildFile,
}

#[derive(Deserialize)]
struct PaperBuildFile {
    name: String,
}

#[derive(Serialize, Clone)]
pub struct PaperBuildEntry {
    pub build: u32,
    pub filename: String,
}

#[tauri::command]
pub async fn fetch_paper_versions() -> Result<Vec<String>, String> {
    let client = make_client()?;
    let project: PaperProject = client
        .get("https://api.papermc.io/v2/projects/paper")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let mut v = project.versions;
    v.reverse(); // newest first
    Ok(v)
}

#[tauri::command]
pub async fn fetch_paper_builds(version: String) -> Result<Vec<PaperBuildEntry>, String> {
    let client = make_client()?;
    let resp: PaperBuildsResponse = client
        .get(&format!(
            "https://api.papermc.io/v2/projects/paper/versions/{}/builds",
            version
        ))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut entries: Vec<PaperBuildEntry> = resp
        .builds
        .into_iter()
        .map(|b| PaperBuildEntry {
            build: b.build,
            filename: b.downloads.application.name,
        })
        .collect();
    entries.reverse(); // newest first
    Ok(entries)
}

// ── Fabric ─────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct FabricGameVersion {
    version: String,
    stable: bool,
}

#[derive(Deserialize)]
struct FabricLoaderVersion {
    version: String,
    stable: bool,
}

#[derive(Deserialize)]
struct FabricInstallerVersion {
    version: String,
}

#[tauri::command]
pub async fn fetch_fabric_game_versions() -> Result<Vec<VersionEntry>, String> {
    let client = make_client()?;
    let versions: Vec<FabricGameVersion> = client
        .get("https://meta.fabricmc.net/v2/versions/game")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(versions
        .into_iter()
        .map(|v| VersionEntry {
            id: v.version,
            stable: v.stable,
        })
        .collect())
}

// ── Forge ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct ForgeVersionEntry {
    pub forge_version: String,
    pub label: String,
}

#[tauri::command]
pub async fn fetch_forge_mc_versions() -> Result<Vec<String>, String> {
    let client = make_client()?;
    let promos: serde_json::Value = client
        .get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut mc_versions = std::collections::BTreeSet::new();
    if let Some(obj) = promos.get("promos").and_then(|p| p.as_object()) {
        for key in obj.keys() {
            if let Some(mc) = key.split('-').next() {
                mc_versions.insert(mc.to_string());
            }
        }
    }

    let mut versions: Vec<String> = mc_versions.into_iter().collect();
    versions.sort_by(|a, b| {
        let parse = |s: &str| -> (u32, u32, u32) {
            let p: Vec<u32> = s.split('.').map(|x| x.parse().unwrap_or(0)).collect();
            (
                p.first().copied().unwrap_or(0),
                p.get(1).copied().unwrap_or(0),
                p.get(2).copied().unwrap_or(0),
            )
        };
        parse(b).cmp(&parse(a))
    });
    Ok(versions)
}

#[tauri::command]
pub async fn fetch_forge_versions(mc_version: String) -> Result<Vec<ForgeVersionEntry>, String> {
    let client = make_client()?;
    let promos: serde_json::Value = client
        .get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    if let Some(obj) = promos.get("promos").and_then(|p| p.as_object()) {
        for label in &["recommended", "latest"] {
            let key = format!("{}-{}", mc_version, label);
            if let Some(v) = obj.get(&key).and_then(|v| v.as_str()) {
                result.push(ForgeVersionEntry {
                    forge_version: v.to_string(),
                    label: label.to_string(),
                });
            }
        }
    }
    Ok(result)
}

// ── Create ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_server(
    app: AppHandle,
    engine: String,
    mc_version: String,
    // Paper: "build_num:filename" · Forge: "forge_version" · Fabric/Vanilla: ""
    build_version: String,
    server_name: String,
    working_dir: String,
) -> Result<(), String> {
    let server_dir = Path::new(&working_dir).join(&server_name);
    std::fs::create_dir_all(&server_dir)
        .map_err(|e| format!("Cannot create server directory: {e}"))?;

    macro_rules! log {
        ($msg:expr) => {
            let _ = app.emit("server-create-log", $msg.to_string());
        };
    }

    let client = make_client()?;

    match engine.to_lowercase().as_str() {
        // ── Vanilla ────────────────────────────────────────────────────────────
        "vanilla" => {
            log!("Fetching version manifest from Mojang…");
            let manifest: MojangManifest = client
                .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
                .send()
                .await
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;

            let ver = manifest
                .versions
                .iter()
                .find(|v| v.id == mc_version)
                .ok_or_else(|| format!("Version {mc_version} not found in manifest"))?;

            log!(format!("Fetching metadata for {mc_version}…"));
            let meta: MojangVersionMeta = client
                .get(&ver.url)
                .send()
                .await
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;

            let server_url = meta
                .downloads
                .server
                .ok_or("This version has no server download")?
                .url;

            log!(format!("Downloading minecraft_server.{mc_version}.jar…"));
            let bytes = client
                .get(&server_url)
                .send()
                .await
                .map_err(|e| e.to_string())?
                .bytes()
                .await
                .map_err(|e| e.to_string())?;

            tokio::fs::write(
                server_dir.join(format!("minecraft_server.{mc_version}.jar")),
                &bytes,
            )
            .await
            .map_err(|e| e.to_string())?;

            // Pre-write version.json so the app shows the version before first run
            let vj = serde_json::json!({"id": mc_version, "type": "release"});
            tokio::fs::write(
                server_dir.join("version.json"),
                serde_json::to_string(&vj).unwrap(),
            )
            .await
            .map_err(|e| e.to_string())?;

            log!("Saved server jar.");
        }

        // ── Paper ──────────────────────────────────────────────────────────────
        "paper" => {
            let (build_num, filename) = build_version
                .split_once(':')
                .ok_or("Internal error: malformed paper build_version")?;

            let url = format!(
                "https://api.papermc.io/v2/projects/paper/versions/{mc_version}/builds/{build_num}/downloads/{filename}"
            );
            log!(format!(
                "Downloading Paper {mc_version} build {build_num}…"
            ));
            let bytes = client
                .get(&url)
                .send()
                .await
                .map_err(|e| e.to_string())?
                .bytes()
                .await
                .map_err(|e| e.to_string())?;

            // Save as paper.jar — matches engine detection and launch command
            tokio::fs::write(server_dir.join("paper.jar"), &bytes)
                .await
                .map_err(|e| e.to_string())?;

            // Pre-write version_history.json so version is shown before first run
            let vh = serde_json::json!({"currentVersion": format!("{mc_version}-{build_num}")});
            tokio::fs::write(
                server_dir.join("version_history.json"),
                serde_json::to_string(&vh).unwrap(),
            )
            .await
            .map_err(|e| e.to_string())?;

            log!("Saved paper.jar.");
        }

        // ── Fabric ─────────────────────────────────────────────────────────────
        "fabric" => {
            log!("Fetching latest stable Fabric loader…");
            let loaders: Vec<FabricLoaderVersion> = client
                .get("https://meta.fabricmc.net/v2/versions/loader")
                .send()
                .await
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            let loader_ver = loaders
                .iter()
                .find(|v| v.stable)
                .map(|v| v.version.clone())
                .ok_or("No stable Fabric loader found")?;

            log!("Fetching latest Fabric installer…");
            let installers: Vec<FabricInstallerVersion> = client
                .get("https://meta.fabricmc.net/v2/versions/installer")
                .send()
                .await
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            let installer_ver = installers
                .first()
                .map(|v| v.version.clone())
                .ok_or("No Fabric installer found")?;

            log!(format!(
                "Downloading Fabric server launcher (loader {loader_ver}, installer {installer_ver})…"
            ));
            let url = format!(
                "https://meta.fabricmc.net/v2/versions/loader/{mc_version}/{loader_ver}/{installer_ver}/server/jar"
            );
            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                return Err(format!(
                    "Fabric download failed: HTTP {} — check that {mc_version} is supported by Fabric",
                    resp.status()
                ));
            }
            let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

            tokio::fs::write(server_dir.join("fabric-server-launch.jar"), &bytes)
                .await
                .map_err(|e| e.to_string())?;

            // Write properties file so version detection works before first run
            let props = format!("game-version={mc_version}\nloader-version={loader_ver}\n");
            tokio::fs::write(
                server_dir.join("fabric-server-launcher.properties"),
                props,
            )
            .await
            .map_err(|e| e.to_string())?;

            log!("Saved fabric-server-launch.jar.");
        }

        // ── Forge ──────────────────────────────────────────────────────────────
        "forge" => {
            let forge_version = &build_version;
            let installer_name =
                format!("forge-{mc_version}-{forge_version}-installer.jar");
            let url = format!(
                "https://maven.minecraftforge.net/net/minecraftforge/forge/{mc_version}-{forge_version}/forge-{mc_version}-{forge_version}-installer.jar"
            );

            log!(format!(
                "Downloading Forge {forge_version} installer for MC {mc_version}…"
            ));
            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            if !resp.status().is_success() {
                return Err(format!(
                    "Forge installer download failed: HTTP {}",
                    resp.status()
                ));
            }
            let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
            let installer_path = server_dir.join(&installer_name);
            tokio::fs::write(&installer_path, &bytes)
                .await
                .map_err(|e| e.to_string())?;

            log!("Running Forge installer — downloading Minecraft + Forge libraries. This may take several minutes…");

            let mut child = tokio::process::Command::new("java")
                .arg("-jar")
                .arg(&installer_path)
                .arg("--installServer")
                .current_dir(&server_dir)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| {
                    format!(
                        "Failed to launch Forge installer: {e}. Is Java installed and on your PATH?"
                    )
                })?;

            // Stream stdout lines to frontend
            if let Some(stdout) = child.stdout.take() {
                use tokio::io::{AsyncBufReadExt, BufReader};
                let app2 = app.clone();
                tokio::spawn(async move {
                    let mut lines = BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let _ = app2.emit("server-create-log", line);
                    }
                });
            }

            // Stream stderr lines to frontend
            if let Some(stderr) = child.stderr.take() {
                use tokio::io::{AsyncBufReadExt, BufReader};
                let app2 = app.clone();
                tokio::spawn(async move {
                    let mut lines = BufReader::new(stderr).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let _ = app2.emit("server-create-log", line);
                    }
                });
            }

            let status = child
                .wait()
                .await
                .map_err(|e| format!("Installer process error: {e}"))?;

            if !status.success() {
                return Err(format!(
                    "Forge installer exited with code {:?}",
                    status.code()
                ));
            }

            // Clean up installer jar
            let _ = tokio::fs::remove_file(&installer_path).await;
            log!("Forge installation complete.");
        }

        other => return Err(format!("Unknown engine: {other}")),
    }

    log!("Writing eula.txt (eula=true)…");
    tokio::fs::write(server_dir.join("eula.txt"), "eula=true\n")
        .await
        .map_err(|e| format!("Cannot write eula.txt: {e}"))?;

    log!(format!("✓ '{server_name}' is ready!"));
    Ok(())
}
