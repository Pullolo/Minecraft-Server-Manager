use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System};
use tauri::State;

use crate::files::mem::AppState;

#[derive(Serialize)]
pub struct ResourceStats {
    pub cpu_pct: f32,
    pub ram_mb: u64,
    pub total_ram_mb: u64,
}

#[tauri::command]
pub fn get_server_resource_usage(state: State<'_, AppState>) -> ResourceStats {
    let pid_opt = *state.server_pid.lock().unwrap();

    let mut sys = System::new();
    sys.refresh_memory();
    let total_ram_mb = sys.total_memory() / 1024 / 1024;

    if let Some(raw_pid) = pid_opt {
        let pid = Pid::from_u32(raw_pid);
        sys.refresh_processes(ProcessesToUpdate::Some(&[pid]));
        if let Some(proc) = sys.process(pid) {
            return ResourceStats {
                cpu_pct: proc.cpu_usage(),
                ram_mb: proc.memory() / 1024 / 1024,
                total_ram_mb,
            };
        }
    }

    ResourceStats { cpu_pct: 0.0, ram_mb: 0, total_ram_mb }
}
