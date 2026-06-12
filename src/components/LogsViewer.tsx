import { FileText, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../utils/utils";

function lineColor(line: string): string {
  if (/\[WARN\]|\/WARN/.test(line)) return "text-yellow-400";
  if (/\[ERROR\]|\/ERROR|\[SEVERE\]/.test(line)) return "text-red-400";
  if (/\[INFO\]|\/INFO/.test(line)) return "text-slate-300";
  if (/\[DEBUG\]|\/DEBUG/.test(line)) return "text-slate-600";
  return "text-slate-400";
}

export default function LogsViewer({
  location,
  onClose,
}: {
  location: string;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const text = await invoke<string>("read_server_log", { location });
      setLines(text.split("\n").filter(Boolean));
    } catch (e) {
      setLines([`[Error reading log] ${e}`]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLog(); }, [location]);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, autoScroll]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[620px] flex flex-col bg-slate-900 border-l border-slate-700/50 h-full shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText size={16} className="text-emerald-400" />
              Server Log
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              logs/latest.log · {lines.length} lines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="accent-emerald-500"
              />
              Auto-scroll
            </label>
            <button
              onClick={fetchLog}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            >
              <RefreshCw size={12} className={cn(loading && "animate-spin")} />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Log content */}
        <div className="flex-1 overflow-y-auto console-scroll bg-black/30 px-5 py-4 font-mono text-xs leading-5">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 size={22} className="animate-spin text-emerald-400" />
            </div>
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <FileText size={32} className="text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">No log file found</p>
              <p className="text-xs text-slate-600 mt-1">
                The server must be started at least once
              </p>
            </div>
          ) : (
            <>
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={cn("whitespace-pre-wrap break-all leading-5", lineColor(line))}
                >
                  {line}
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
