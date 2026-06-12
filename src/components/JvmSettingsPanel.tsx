import { Globe, Loader2, MemoryStick, RotateCcw, Save, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../utils/utils";

interface ServerConfig {
  memory_mb?: number | null;
  extra_jvm_flags?: string | null;
}

const MEMORY_PRESETS = [512, 1024, 2048, 4096, 6144, 8192, 12288, 16384];

function fmtMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${mb} MB`;
}

function MemoryPicker({
  value,
  onChange,
  dimmed,
}: {
  value: number;
  onChange: (v: number) => void;
  dimmed?: boolean;
}) {
  const idx = MEMORY_PRESETS.indexOf(value);
  return (
    <div className={cn(dimmed && "opacity-50 pointer-events-none")}>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        {MEMORY_PRESETS.map((mb) => (
          <button
            key={mb}
            onClick={() => onChange(mb)}
            className={cn(
              "py-1.5 rounded-lg text-xs font-semibold border transition-all",
              value === mb
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                : "bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600",
            )}
          >
            {fmtMb(mb)}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={MEMORY_PRESETS.length - 1}
        value={idx === -1 ? 1 : idx}
        onChange={(e) => onChange(MEMORY_PRESETS[Number(e.target.value)])}
        className="w-full accent-emerald-500"
      />
    </div>
  );
}

export default function JvmSettingsPanel({
  location,
  onClose,
}: {
  location: string;
  onClose: () => void;
}) {
  // Global defaults
  const [globalCfg, setGlobalCfg] = useState<ServerConfig>({});
  // Per-server overrides (null = use global)
  const [memOverride, setMemOverride] = useState<number | null>(null);
  const [flagsOverride, setFlagsOverride] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    Promise.all([
      invoke<ServerConfig>("get_global_jvm_config"),
      invoke<ServerConfig>("get_server_config", { location }),
    ]).then(([global, server]) => {
      setGlobalCfg(global);
      setMemOverride(server.memory_mb ?? null);
      setFlagsOverride(server.extra_jvm_flags ?? null);
    }).finally(() => setLoading(false));
  }, [location]);

  const effectiveMem = memOverride ?? globalCfg.memory_mb ?? 1024;
  const effectiveFlags = flagsOverride ?? globalCfg.extra_jvm_flags ?? "";

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("save_server_config", {
        location,
        config: {
          memory_mb: memOverride,
          extra_jvm_flags: flagsOverride,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const usingGlobalMem = memOverride === null;
  const usingGlobalFlags = flagsOverride === null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[500px] flex flex-col bg-slate-900 border-l border-slate-700/50 h-full shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Settings2 size={16} className="text-emerald-400" />
              JVM Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Applied on next server start · overrides global defaults
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto console-scroll px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex justify-center pt-12">
              <Loader2 size={24} className="animate-spin text-emerald-400" />
            </div>
          ) : (
            <>
              {/* Memory */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <MemoryStick size={14} className="text-slate-400" />
                    Max Memory (Xmx)
                  </label>
                  <div className="flex items-center gap-2">
                    {usingGlobalMem && (
                      <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                        <Globe size={9} /> global
                      </span>
                    )}
                    <span className="text-lg font-bold text-emerald-400">
                      {fmtMb(effectiveMem)}
                    </span>
                  </div>
                </div>

                <MemoryPicker
                  value={effectiveMem}
                  onChange={(v) => setMemOverride(v)}
                />

                {!usingGlobalMem && (
                  <button
                    onClick={() => setMemOverride(null)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <RotateCcw size={11} />
                    Reset to global default ({fmtMb(globalCfg.memory_mb ?? 1024)})
                  </button>
                )}

                <p className="text-xs text-slate-600 mt-2">
                  Xms (initial heap) is set to half of Xmx automatically.
                </p>
              </div>

              {/* Extra flags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-200">
                    Extra JVM Flags
                  </label>
                  {usingGlobalFlags && (
                    <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                      <Globe size={9} /> global
                    </span>
                  )}
                </div>
                <textarea
                  value={flagsOverride ?? (globalCfg.extra_jvm_flags ?? "")}
                  onChange={(e) => setFlagsOverride(e.target.value || null)}
                  rows={4}
                  placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled ..."
                  className={cn(
                    "w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 outline-none resize-none transition-all",
                    usingGlobalFlags && "opacity-60",
                  )}
                  onFocus={() => {
                    if (usingGlobalFlags) setFlagsOverride(globalCfg.extra_jvm_flags ?? "");
                  }}
                />
                {!usingGlobalFlags && (
                  <button
                    onClick={() => setFlagsOverride(null)}
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <RotateCcw size={11} />
                    Reset to global default
                  </button>
                )}
                <p className="text-xs text-slate-600 mt-2">
                  Space-separated flags. Leave empty to inherit global defaults.
                </p>
              </div>

              {/* Effective args preview */}
              <div className="bg-slate-950/60 border border-slate-700/30 rounded-xl p-4">
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide mb-2">
                  Effective launch flags
                </p>
                <code className="text-[11px] text-slate-400 font-mono break-all leading-relaxed">
                  java -Xms{Math.round(effectiveMem / 2)}M -Xmx{effectiveMem}M
                  {effectiveFlags ? ` ${effectiveFlags}` : ""} -jar ...
                </code>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              "Saved ✓"
            ) : (
              <>
                <Save size={14} />
                Save Per-Server Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
