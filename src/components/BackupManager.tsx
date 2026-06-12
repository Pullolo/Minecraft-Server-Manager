import { Archive, FolderOpen, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { format } from "date-fns";

interface BackupInfo {
  path: string;
  filename: string;
  size_mb: number;
  created_ms: number;
}

export default function BackupManager({
  location,
  serverName,
  workingDir,
  onClose,
}: {
  location: string;
  serverName: string;
  workingDir: string;
  onClose: () => void;
}) {
  const defaultBackupDir = `${workingDir}\\backups`;
  const [backupDir, setBackupDir] = useState(defaultBackupDir);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fetchBackups = async (dir = backupDir) => {
    setLoading(true);
    try {
      const list = await invoke<BackupInfo[]>("list_backups", {
        backupDir: dir,
        serverName,
      });
      setBackups(list);
    } catch {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBackups(); }, [backupDir]);

  const handlePickDir = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setBackupDir(selected);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      await invoke("backup_world", { location, backupDir });
      await fetchBackups();
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (path: string) => {
    setDeletingPath(path);
    try {
      await invoke("delete_backup", { path });
      setBackups((prev) => prev.filter((b) => b.path !== path));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingPath(null);
    }
  };

  const totalSize = backups.reduce((s, b) => s + b.size_mb, 0);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[520px] flex flex-col bg-slate-900 border-l border-slate-700/50 h-full shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Archive size={16} className="text-emerald-400" />
              World Backups
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {backups.length} backup{backups.length !== 1 ? "s" : ""} · {totalSize.toFixed(1)} MB total
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
          >
            <X size={17} />
          </button>
        </div>

        {/* Backup dir */}
        <div className="px-6 py-4 border-b border-slate-800/60 space-y-2">
          <p className="text-xs font-medium text-slate-400">Backup folder</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-xs text-slate-300 font-mono bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2 truncate">
              {backupDir}
            </code>
            <button
              onClick={handlePickDir}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all"
            >
              <FolderOpen size={13} />
              Change
            </button>
          </div>
        </div>

        {/* Backup list */}
        <div className="flex-1 overflow-y-auto console-scroll px-5 py-4 space-y-2">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 size={22} className="animate-spin text-emerald-400" />
            </div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Archive size={32} className="text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm">No backups yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Create your first backup below
              </p>
            </div>
          ) : (
            backups.map((b) => (
              <div
                key={b.path}
                className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl hover:border-slate-600/50 transition-all"
              >
                <Archive size={15} className="text-slate-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">
                    {b.filename}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {b.size_mb.toFixed(1)} MB ·{" "}
                    {format(new Date(b.created_ms), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(b.path)}
                  disabled={deletingPath === b.path}
                  className="shrink-0 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                  title="Delete backup"
                >
                  {deletingPath === b.path ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 space-y-2">
          {createError && (
            <p className="text-xs text-red-400">{createError}</p>
          )}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            {creating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating backup…
              </>
            ) : (
              <>
                <Archive size={14} />
                Create Backup Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
