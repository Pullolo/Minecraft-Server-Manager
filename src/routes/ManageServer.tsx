import { format } from "date-fns";
import {
  ArrowLeft,
  Clock,
  FolderOpen,
  HardDrive,
  Package,
  PackagePlus,
  Play,
  SlidersHorizontal,
  Send,
  Square,
  Terminal,
  Trash2,
  User2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Server } from "../hooks/servers";
import Loader from "../components/Loader";
import ContentBrowser from "../components/ContentBrowser";
import PropertiesEditor from "../components/PropertiesEditor";
import { cn, engineBadgeClass } from "../utils/utils";
import { ServerIcon } from "../components/ServerIcon";

function lineColor(line: string): string {
  if (/\/WARN|WARN\]/.test(line)) return "text-yellow-400";
  if (/\/ERROR|ERROR\]/.test(line)) return "text-red-400";
  if (line.startsWith(">")) return "text-emerald-400";
  return "text-slate-300";
}

export default function ManageServer() {
  const location = useLocation();
  const navigate = useNavigate();

  const server = location.state?.server as (Server & { storage: string }) | undefined;

  const [isRunning, setIsRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [cmdInput, setCmdInput] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Sync initial server running state
  useEffect(() => {
    invoke<boolean>("get_server_status").then(setIsRunning);
  }, []);

  // Subscribe to server events
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

  const appendLine = (msg: string) =>
    setLines((prev) => [...prev, msg]);

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
    setCmdInput("");
    try {
      await invoke("send_server_command", { command: cmd });
    } catch (err) {
      appendLine(`[Error] ${err}`);
    }
  };

  const handleOpenFolder = async () => {
    await invoke("open_directory", { path: server.location });
  };

  const handleOpenTerminal = async () => {
    await invoke("open_terminal", { path: server.location });
  };

  const handleDelete = async () => {
    setDeleting(true);
    console.log("Deleting server:", server.name);
    setDeleting(false);
    navigate("/");
  };

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
            <div className="flex items-start gap-4">
              <ServerIcon
                location={server.location}
                engine={server.engine}
                size={64}
                editable
              />
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {server.name}
                </h2>
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

            {/* Status + actions */}
            <div className="shrink-0 flex flex-col items-end gap-2">
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowProperties(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all"
                >
                  <SlidersHorizontal size={13} />
                  Properties
                </button>
                <button
                  onClick={() => setShowBrowser(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-all"
                >
                  <PackagePlus size={13} />
                  Add Content
                </button>

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
          {/* Console header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-300">Console</span>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                isRunning ? "text-emerald-400" : "text-slate-500",
              )}
            >
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isRunning ? "bg-emerald-400 animate-pulse" : "bg-slate-600",
                )}
              />
              {isRunning ? "Live" : "Offline"}
            </div>
          </div>

          {/* Output */}
          <div className="console-scroll h-72 overflow-y-auto bg-black/40 px-4 py-3 font-mono text-xs leading-5">
            {lines.length === 0 ? (
              <p className="text-slate-600 select-none">
                {isRunning
                  ? "Waiting for output…"
                  : "Start the server to see output here."}
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
              disabled={!isRunning}
              placeholder={isRunning ? "Type a command…" : "Server is not running"}
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
            These actions cannot be undone. Proceed with caution.
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
                This will remove the server from the list. Files on disk will not be affected.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  {deleting ? <Loader size={13} /> : <Trash2 size={13} />}
                  {deleting ? "Deleting…" : "Yes, Delete"}
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

    {showBrowser && server && (
      <ContentBrowser server={server} onClose={() => setShowBrowser(false)} />
    )}
    {showProperties && server && (
      <PropertiesEditor
        server={server}
        isServerRunning={isRunning}
        onClose={() => setShowProperties(false)}
      />
    )}
    </>
  );
}
