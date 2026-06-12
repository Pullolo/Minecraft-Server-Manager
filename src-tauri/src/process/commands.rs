use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::files::mem::AppState;

/// Returns (program, args) for the right launch method based on what's in the directory.
fn get_launch_command(dir: &Path) -> Result<(String, Vec<String>), String> {
    // ── Fabric ──────────────────────────────────────────────────────────────
    let fabric_jar = dir.join("fabric-server-launch.jar");
    if fabric_jar.exists() {
        return Ok((
            "java".into(),
            vec!["-jar".into(), fabric_jar.to_string_lossy().into_owned(), "nogui".into()],
        ));
    }

    // ── Forge modern (1.17+): prefer the run script ──────────────────────────
    #[cfg(target_os = "windows")]
    {
        if dir.join("run.bat").exists() {
            return Ok(("cmd".into(), vec!["/C".into(), "run.bat".into(), "nogui".into()]));
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if dir.join("run.sh").exists() {
            return Ok(("bash".into(), vec!["run.sh".into(), "nogui".into()]));
        }
    }

    // ── Well-known jar names ──────────────────────────────────────────────────
    for name in &["paper.jar", "purpur.jar", "spigot.jar", "server.jar"] {
        let p = dir.join(name);
        if p.exists() {
            return Ok(("java".into(), vec!["-jar".into(), p.to_string_lossy().into_owned(), "nogui".into()]));
        }
    }

    // ── Forge legacy: forge-*.jar at root ────────────────────────────────────
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let name = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                if name.starts_with("forge-") && name.ends_with(".jar") && !name.contains("installer") {
                    return Ok(("java".into(), vec!["-jar".into(), p.to_string_lossy().into_owned(), "nogui".into()]));
                }
            }
        }
    }

    // ── Fallback: any non-installer jar ──────────────────────────────────────
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() && p.extension().map(|e| e == "jar").unwrap_or(false) {
                let name = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                if !name.contains("installer") {
                    return Ok(("java".into(), vec!["-jar".into(), p.to_string_lossy().into_owned(), "nogui".into()]));
                }
            }
        }
    }

    Err(
        "No server jar or launch script found. \
         Expected: fabric-server-launch.jar (Fabric), run.bat/run.sh (Forge modern), \
         paper.jar / purpur.jar / server.jar (Paper/Vanilla), or forge-*.jar (Forge legacy)."
            .to_string(),
    )
}

fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' && chars.peek() == Some(&'[') {
            chars.next(); // consume '['
            for c2 in chars.by_ref() {
                if c2.is_ascii_alphabetic() {
                    break;
                }
            }
        } else {
            out.push(c);
        }
    }
    out
}

#[tauri::command]
pub fn start_server(
    location: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    {
        let running = state.server_running.lock().unwrap();
        if *running {
            return Err("Server is already running".to_string());
        }
    }

    let (program, base_args) = get_launch_command(Path::new(&location))?;

    // Inject JVM memory + extra flags when launching via java directly
    let args: Vec<String> = if program == "java" {
        let cfg = crate::server_config::read_config(&location);
        let mem = cfg.memory_mb.unwrap_or(1024);
        let mut java_args: Vec<String> = vec![
            format!("-Xms{}M", mem / 2),
            format!("-Xmx{}M", mem),
        ];
        if let Some(flags) = cfg.extra_jvm_flags.filter(|s| !s.trim().is_empty()) {
            java_args.extend(flags.split_whitespace().map(|s| s.to_string()));
        }
        java_args.extend(base_args);
        java_args
    } else {
        base_args
    };

    let mut child = Command::new(&program)
        .args(&args)
        .current_dir(&location)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                if program == "java" {
                    "Java not found. Make sure Java is installed and in your PATH.".to_string()
                } else {
                    format!("Launch program not found: {program}")
                }
            } else {
                format!("Failed to start: {e}")
            }
        })?;

    let pid = child.id();
    let stdin = child.stdin.take().ok_or("Failed to get stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;

    *state.server_stdin.lock().unwrap() = Some(stdin);
    *state.server_running.lock().unwrap() = true;
    *state.server_location.lock().unwrap() = Some(location.clone());
    *state.server_pid.lock().unwrap() = Some(pid);
    let _ = app.emit("server-started", location.clone());

    // Stream stdout
    let app_out = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let _ = app_out.emit("server-output", strip_ansi(&line));
        }
    });

    // Stream stderr
    let app_err = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            let _ = app_err.emit("server-output", strip_ansi(&line));
        }
    });

    // Wait for process exit then clean up
    std::thread::spawn(move || {
        let _ = child.wait();
        let s = app.state::<AppState>();
        *s.server_running.lock().unwrap() = false;
        *s.server_stdin.lock().unwrap() = None;
        *s.server_location.lock().unwrap() = None;
        *s.server_pid.lock().unwrap() = None;
        let _ = app.emit("server-stopped", ());
    });

    Ok(())
}

#[tauri::command]
pub fn stop_server(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.server_stdin.lock().unwrap();
    match guard.as_mut() {
        Some(stdin) => stdin.write_all(b"stop\n").map_err(|e| e.to_string()),
        None => Err("Server is not running".to_string()),
    }
}

#[tauri::command]
pub fn send_server_command(command: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.server_stdin.lock().unwrap();
    match guard.as_mut() {
        Some(stdin) => {
            let line = format!("{}\n", command.trim());
            stdin.write_all(line.as_bytes()).map_err(|e| e.to_string())
        }
        None => Err("Server is not running".to_string()),
    }
}

#[tauri::command]
pub fn get_server_status(state: State<'_, AppState>) -> bool {
    *state.server_running.lock().unwrap()
}

#[tauri::command]
pub fn get_running_server_location(state: State<'_, AppState>) -> Option<String> {
    state.server_location.lock().unwrap().clone()
}
