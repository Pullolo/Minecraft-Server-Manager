import { format } from "date-fns";
import {
  FolderOpen,
  HardDrive,
  Package,
  Settings,
  Trash2,
  User2,
} from "lucide-react";
import { Server } from "../hooks/servers";
import React from "react";

export const ServerCard = React.memo(({ server }: { server: Server }) => {
  const handleManage = () => {
    console.log("Managing server:", server.name);
  };

  const handleOpenFolder = () => {
    console.log("Opening folder:", server.location);
  };

  const handleDelete = () => {
    console.log("Deleting server:", server.name);
  };

  return (
    <div className="group relative bg-linear-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10">
      <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 to-cyan-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center text-2xl shrink-0 border border-slate-600/30">
            🎮
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate mb-1.5">
              {server.name}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 bg-slate-700/50 rounded text-slate-300">
                {server.version}
              </span>
              <span className="px-2 py-0.5 bg-slate-700/50 rounded text-slate-300 flex items-center gap-1">
                <Package size={11} />
                {server.engine}
              </span>
            </div>
          </div>
        </div>

        {/* Location Info */}
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

        {/* Last Played */}
        <div className="text-xs text-slate-500 mb-3">
          Last active: {format(server.last_played, "dd.MM.yyyy")}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleManage}
            className="flex-1 px-3 py-2 rounded-lg bg-linear-to-r from-emerald-500/90 to-cyan-500/90 hover:from-emerald-500 hover:to-cyan-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
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
            onClick={handleDelete}
            className="px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-red-500/20 border border-slate-600/50 hover:border-red-500/50 hover:text-red-400 text-slate-300 transition-all"
            title="Delete Server"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});
