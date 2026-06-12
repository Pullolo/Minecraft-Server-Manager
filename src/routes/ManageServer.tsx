import { format } from "date-fns";
import {
  Archive,
  ArrowLeft,
  Check,
  Clock,
  FileText,
  FolderOpen,
  HardDrive,
  Package,
  PackagePlus,
  Pencil,
  Play,
  Settings2,
  SlidersHorizontal,
  Send,
  Square,
  Terminal,
  Trash2,
  User2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { Server } from "../hooks/servers";
import { useAppData } from "../hooks/appdata";
import Loader from "../components/Loader";
import ContentBrowser from "../components/ContentBrowser";
import PropertiesEditor from "../components/PropertiesEditor";
import JvmSettingsPanel from "../components/JvmSettingsPanel";
import LogsViewer from "../components/LogsViewer";
import BackupManager from "../components/BackupManager";
import PlayersManager from "../components/PlayersManager";
import ResourceGraph, { ResourcePoint } from "../components/ResourceGraph";
import { cn, engineBadgeClass } from "../utils/utils";
import { ServerIcon } from "../components/ServerIcon";

function lineColor(line: string): string {
  if (/\/WARN|WARN\]/.test(line)) return "text-yellow-400";
  if (/\/ERROR|ERROR\]/.test(line)) return "text-red-400";
  if (line.startsWith(">")) return "text-emerald-400";
  return "text-slate-300";
}

export default function ManageServer() {
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: appData } = useAppData();

  const server = routeLocation.state?.server as (Server & { storage: string }) | undefined;

  const [isRunning, setIsRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [cmdInput, setCmdInput] = useState("");

  // Panel visibility
  const [showBrowser, setShowBrowser] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showJvmSettings, setShowJvmSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Rename
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(server?.name ?? "");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Resource monitoring
  const [resourceData, setResourceData] = useState<ResourcePoint[]>([]);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const cmdHistoryRef = useRef<string[]>([]);
  const cmdHistoryCursorRef = useRef<number>(-1);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Server event subscriptions ───────────────────────────────────────────────

  useEffect(() => {
    invoke<boolean>("get_server_status").then(setIsRunning);
  }, []);

  useEffect(() => {
    const unlistenOutput = listen<string>("server-output", (e) => {
      setLines((prev) => {
        const next = [...prev, e.payload];
        return next.length > 2000 ? next.slice(-2000) : next;
      });
    });

    const unlistenStopped = listen("server-stopped", () => {
      setIsRunning(false);
      setStopping(false);
      setLines((prev) => [...prev, "--- Server stopped ---"]);
      setResourceData([]);
    });

    return () => {
      unlistenOutput.then((fn) => fn());
      unlistenStopped.then((fn) => fn());
    };
  }, []);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [lines]);

  // Resource polling
  useEffect(() => {
    if (!isRunning) return;
    const poll = async () => {
      try {
        const stats = await invoke<ResourcePoint>("get_server_resource_usage");
        setResourceData((prev) => [...prev.slice(-59), stats]);
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Focus rename input when editing
  useEffect(() => {
    if (editingName) setTimeout(() => renameInputRef.current?.focus(), 50);
  }, [editingName]);

  if (!server) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Server not found.</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const appendLine = (msg: string) => setLines((prev) => [...prev, msg]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    setStarting(true);
    setLines([]);
    try {
      await invoke("start_server", { location: server.location });
      setIsRunning(true);
    } catch (e) {
      appendLine(`[Error] ${e}`);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await invoke("stop_server");
    } catch (e) {
      appendLine(`[Error] ${e}`);
      setStopping(false);
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cmdInput.trim();
    if (!cmd) return;
    appendLine(`> ${cmd}`);
    cmdHistoryRef.current = [...cmdHistoryRef.current.slice(-99), cmd];
    cmdHistoryCursorRef.current = -1;
    setCmdInput("");
    try {
      await invoke("send_server_command", { command: cmd });
    } catch (err) {
      appendLine(`[Error] ${err}`);
    }
  };

  const handleCmdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const history = cmdHistoryRef.current;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next = Math.min(cmdHistoryCursorRef.current + 1, history.length - 1);
      cmdHistoryCursorRef.current = next;
      setCmdInput(history[history.length - 1 - next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cmdHistoryCursorRef.current <= 0) {
        cmdHistoryCursorRef.current = -1;
        setCmdInput("");
        return;
      }
      const next = cmdHistoryCursorRef.current - 1;
      cmdHistoryCursorRef.current = next;
      setCmdInput(history[history.length - 1 - next]);
    }
  };

  const handleRename = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === server.name) {
      setEditingName(false);
      setDraftName(server.name);
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      const newPath = await invoke<string>("rename_server", {
        location: server.location,
        newName: trimmed,
      });
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      const newServer = { ...server, name: trimmed, location: newPath };
      navigate(`/manage/${encodeURIComponent(trimmed)}`, {
        state: { server: newServer },
        replace: true,
      });
    } catch (e) {
      setRenameError(String(e));
      setDraftName(server.name);
    } finally {
      setRenaming(false);
      setEditingName(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await invoke("delete_server", { location: server.location });
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      navigate("/");
    } catch (e) {
      appendLine(`[Error deleting server] ${e}`);
      setDeleting(false);
    }
  };

  const handleOpenFolder = () => invoke("open_directory", { path: server.location });
  const handleOpenTerminal = () => invoke("open_terminal", { path: server.location });

  // ── Toolbar buttons (icon-only with tooltips) ─────────────────────────────

  const toolbarBtns = [
    { icon: <SlidersHorizontal size={15} />, label: "Properties", action: () => setShowProperties(true) },
    { icon: <Settings2 size={15} />, label: "JVM Settings", action: () => setShowJvmSettings(true) },
    { icon: <FileText size={15} />, label: "Server Log", action: () => setShowLogs(true) },
    { icon: <Archive size={15} />, label: "Backups", action: () => setShowBackup(true) },
    { icon: <Users size={15} />, label: "Players", action: () => setShowPlayers(true) },
    { icon: <PackagePlus size={15} />, label: "Add Content", action: () => setShowBrowser(true) },
  ];

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-white">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={17} />
              <span className="text-sm font-medium">Back</span>
            </button>
            <span className="text-slate-700 select-none">|</span>
            <span className="text-sm text-slate-400">Manage Server</span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
          {/* Server hero */}
          <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              {/* Left: icon + name + badges */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <ServerIcon
                  location={server.location}
                  engine={server.engine}
                  size={64}
                  editable
                />
                <div className="flex-1 min-w-0">
                  {/* Editable name */}
                  {editingName ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        ref={renameInputRef}
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename();
                          if (e.key === "Escape") {
                            setEditingName(false);
                            setDraftName(server.name);
                          }
                        }}
                        className="flex-1 min-w-0 bg-slate-700/60 border border-emerald-500/50 rounded-lg px-3 py-1.5 text-xl font-bold text-white outline-none"
                      />
                      <button
                        onClick={handleRename}
                        disabled={renaming}
                        className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 rounded-lg transition-all"
                      >
                        {renaming ? <Loader size={14} /> : <Check size={14} />}
                      </button>
                      <button
                        onClick={() => { setEditingName(false); setDraftName(server.name); setRenameError(null); }}
                        className="p-1.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-400 rounded-lg transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2 group">
                      <h2 className="text-2xl font-bold text-white truncate">
                        {server.name}
                      </h2>
                      <button
                        onClick={() => setEditingName(true)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded-lg transition-all"
                        title="Rename server"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                  {renameError && (
                    <p className="text-xs text-red-400 -mt-1 mb-2">{renameError}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-700/50 rounded-lg text-slate-300 text-sm">
                      {server.version}
                    </span>
                    <span className={cn("px-2.5 py-1 rounded-lg text-sm flex items-center gap-1.5", engineBadgeClass(server.engine))}>
                      <Package size={13} />
                      {server.engine}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: status + controls */}
              <div className="shrink-0 flex flex-col items-end gap-3">
                {isRunning ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400 font-medium">Running</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-xs text-slate-400">Stopped</span>
                  </div>
                )}

                {/* Toolbar icons */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {toolbarBtns.map((btn) => (
                    <button
                      key={btn.label}
                      onClick={btn.action}
                      title={btn.label}
                      className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/40 hover:border-slate-500 text-slate-400 hover:text-white transition-all"
                    >
                      {btn.icon}
                    </button>
                  ))}
                </div>

                {/* Start / Stop */}
                {isRunning ? (
                  <button
                    onClick={handleStop}
                    disabled={stopping}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {stopping ? <Loader size={13} /> : <Square size={13} />}
                    {stopping ? "Stopping…" : "Stop Server"}
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    disabled={starting}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {starting ? <Loader size={13} /> : <Play size={13} />}
                    {starting ? "Starting…" : "Start Server"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800/90 border border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
                <HardDrive size={13} />
                Storage
              </div>
              <p className="text-2xl font-bold text-white">{server.storage}</p>
            </div>
            <div className="bg-slate-800/90 border border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
                <User2 size={13} />
                Total Players
              </div>
              <p className="text-2xl font-bold text-white">{server.players}</p>
            </div>
            <div className="bg-slate-800/90 border border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
                <Clock size={13} />
                Last Active
              </div>
              <p className="text-xl font-bold text-white">
                {format(server.last_played, "dd MMM yyyy")}
              </p>
            </div>
          </div>

          {/* Console */}
          <div className="bg-slate-800/90 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-300">Console</span>
              </div>
              <div className={cn("flex items-center gap-1.5 text-xs font-medium", isRunning ? "text-emerald-400" : "text-slate-500")}>
                <div className={cn("w-1.5 h-1.5 rounded-full", isRunning ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
                {isRunning ? "Live" : "Offline"}
              </div>
            </div>

            {/* Resource graph — only when running */}
            {isRunning && resourceData.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <ResourceGraph data={resourceData} />
              </div>
            )}

            {/* Output */}
            <div className="console-scroll h-72 overflow-y-auto bg-black/40 px-4 py-3 font-mono text-xs leading-5">
              {lines.length === 0 ? (
                <p className="text-slate-600 select-none">
                  {isRunning ? "Waiting for output…" : "Start the server to see output here."}
                </p>
              ) : (
                lines.map((line, i) => (
                  <div key={i} className={cn("whitespace-pre-wrap break-all", lineColor(line))}>
                    {line}
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>

            {/* Command input */}
            <form
              onSubmit={handleSendCommand}
              className="flex items-center gap-2 px-4 py-3 border-t border-slate-700/50 bg-slate-900/40"
            >
              <span className="text-emerald-500 font-mono text-sm select-none">{">"}</span>
              <input
                type="text"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                onKeyDown={handleCmdKeyDown}
                disabled={!isRunning}
                placeholder={isRunning ? "Type a command… (↑↓ for history)" : "Server is not running"}
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none font-mono disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!isRunning || !cmdInput.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send size={12} />
                Send
              </button>
            </form>
          </div>

          {/* Location */}
          <div className="bg-slate-800/90 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-3">
              <FolderOpen size={13} />
              Location
            </div>
            <div className="flex items-center gap-3">
              <code className="flex-1 min-w-0 text-sm text-slate-300 font-mono bg-slate-900/60 border border-slate-700/30 rounded-lg px-3 py-2 truncate">
                {server.location}
              </code>
              <button
                onClick={handleOpenFolder}
                title="Open Folder"
                className="shrink-0 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg transition-all"
              >
                <FolderOpen size={15} />
              </button>
              <button
                onClick={handleOpenTerminal}
                title="Open Terminal"
                className="shrink-0 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg transition-all"
              >
                <Terminal size={15} />
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-slate-800/90 border border-red-500/20 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
            <p className="text-xs text-slate-500 mb-4">
              Permanently deletes all server files. This cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-all"
              >
                <Trash2 size={14} />
                Delete Server
              </button>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-sm text-red-300 font-medium mb-1">
                  Delete &ldquo;{server.name}&rdquo;?
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  All files in <code className="text-slate-300">{server.location}</code> will be permanently deleted.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {deleting ? <Loader size={13} /> : <Trash2 size={13} />}
                    {deleting ? "Deleting…" : "Yes, Delete Everything"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-300 hover:text-white rounded-lg text-sm transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showBrowser && (
        <ContentBrowser server={server} onClose={() => setShowBrowser(false)} />
      )}
      {showProperties && (
        <PropertiesEditor
          server={server}
          isServerRunning={isRunning}
          onClose={() => setShowProperties(false)}
        />
      )}
      {showJvmSettings && (
        <JvmSettingsPanel location={server.location} onClose={() => setShowJvmSettings(false)} />
      )}
      {showLogs && (
        <LogsViewer location={server.location} onClose={() => setShowLogs(false)} />
      )}
      {showBackup && (
        <BackupManager
          location={server.location}
          serverName={server.name}
          workingDir={appData?.working_dir ?? ""}
          onClose={() => setShowBackup(false)}
        />
      )}
      {showPlayers && (
        <PlayersManager
          location={server.location}
          isRunning={isRunning}
          onClose={() => setShowPlayers(false)}
        />
      )}
    </>
  );
}
