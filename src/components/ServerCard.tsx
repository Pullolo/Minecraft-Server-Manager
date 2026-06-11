import { format } from "date-fns";
import {
  FolderOpen,
  HardDrive,
  Loader2,
  Package,
  Play,
  Settings,
  Square,
  Terminal,
  Trash2,
  User2,
} from "lucide-react";
import { Server } from "../hooks/servers";
import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { cn, engineBadgeClass } from "../utils/utils";
import { ServerIcon } from "./ServerIcon";

export const ServerCard = React.memo(
  ({
    server,
    runningLocation,
  }: {
    server: Server & { storage: string };
    runningLocation: string | null;
  }) => {
    const navigate = useNavigate();

    const isThisRunning = runningLocation === server.location;
    const isAnyRunning = runningLocation !== null;

    const [starting, setStarting] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);

    const handleManage = () => {
      navigate(`/manage/${encodeURIComponent(server.name)}`, {
        state: { server },
      });
    };

    const handleStart = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setStarting(true);
      setStartError(null);
      try {
        await invoke("start_server", { location: server.location });
      } catch (err) {
        setStartError(String(err));
        setTimeout(() => setStartError(null), 4000);
      } finally {
        setStarting(false);
      }
    };

    const handleStop = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setStopping(true);
      try {
        await invoke("stop_server");
      } catch (err) {
        console.error(err);
      } finally {
        setStopping(false);
      }
    };

    const handleOpenFolder = async () => {
      await invoke("open_directory", { path: server.location });
    };

    const handleCommandLineOpen = async () => {
      await invoke("open_terminal", { path: server.location });
    };

    const handleDelete = () => {
      console.log("Deleting server:", server.name);
    };

    return (
      <div
        className={cn(
          "group relative bg-slate-800/90 backdrop-blur-xl border rounded-2xl p-5 transition-all duration-300",
          isThisRunning
            ? "border-emerald-500/40 shadow-lg shadow-emerald-500/10"
            : "border-slate-700/50 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10",
        )}
      >
        <div className="absolute inset-0 bg-primary-subtle rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <ServerIcon
              location={server.location}
              engine={server.engine}
              size={48}
              className="rounded-xl"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-lg font-bold text-white truncate">
                  {server.name}
                </h3>
                {isThisRunning && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full shrink-0">
                    <div className="relative flex">
                      <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-60" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      Running
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="px-2 py-0.5 bg-slate-700/50 rounded text-slate-300">
                  {server.version}
                </span>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded flex items-center gap-1",
                    engineBadgeClass(server.engine),
                  )}
                >
                  <Package size={11} />
                  {server.engine}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-2.5 mb-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <HardDrive size={12} />
                <span className="font-medium">Storage</span>
              </div>
              <div className="text-xs text-slate-300 font-mono truncate">
                {server.storage}
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-2.5 mb-3">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
                <User2 size={12} />
                <span className="font-medium">All time players</span>
              </div>
              <div className="text-xs text-slate-300 font-mono truncate">
                {server.players}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-2.5 mb-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
              <FolderOpen size={12} />
              <span className="font-medium">Location</span>
            </div>
            <div className="text-xs text-slate-300 font-mono truncate">
              {server.location}
            </div>
          </div>

          <div className="text-xs text-slate-500 mb-3">
            Last active: {format(server.last_played, "dd.MM.yyyy")}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {/* Start / Stop */}
            {isThisRunning ? (
              <button
                onClick={handleStop}
                disabled={stopping}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 text-sm font-medium transition-all disabled:opacity-50"
              >
                {stopping ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Square size={13} />
                )}
                {stopping ? "Stopping…" : "Stop"}
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={starting || isAnyRunning}
                title={
                  isAnyRunning && !isThisRunning
                    ? "Stop the running server first"
                    : undefined
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Play size={13} />
                )}
                {starting ? "Starting…" : "Start"}
              </button>
            )}

            <button
              onClick={handleManage}
              className="flex-1 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              <Settings size={14} />
              Manage
            </button>
            <button
              onClick={handleOpenFolder}
              className="px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white transition-all"
              title="Open Folder"
            >
              <FolderOpen size={16} />
            </button>
            <button
              onClick={handleCommandLineOpen}
              className="px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 text-slate-300 hover:text-white transition-all"
              title="Open Terminal"
            >
              <Terminal size={16} />
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-red-500/20 border border-slate-600/50 hover:border-red-500/50 hover:text-red-400 text-slate-300 transition-all"
              title="Delete Server"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Start error */}
          {startError && (
            <p className="text-xs text-red-400 mt-2 leading-relaxed">
              {startError}
            </p>
          )}
        </div>
      </div>
    );
  },
);
