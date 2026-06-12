import { Loader2, MemoryStick, Save, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ServerConfig {
  memory_mb?: number;
  extra_jvm_flags?: string;
}

const MEMORY_PRESETS = [512, 1024, 2048, 4096, 6144, 8192, 12288, 16384];

function fmtMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${mb} MB`;
}

export default function JvmSettingsPanel({
  location,
  onClose,
}: {
  location: string;
  onClose: () => void;
}) {
  const [memoryMb, setMemoryMb] = useState(1024);
  const [extraFlags, setExtraFlags] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    invoke<ServerConfig>("get_server_config", { location })
      .then((cfg) => {
        setMemoryMb(cfg.memory_mb ?? 1024);
        setExtraFlags(cfg.extra_jvm_flags ?? "");
      })
      .finally(() => setLoading(false));
  }, [location]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("save_server_config", {
        location,
        config: { memory_mb: memoryMb, extra_jvm_flags: extraFlags || null },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const sliderIndex = MEMORY_PRESETS.indexOf(memoryMb);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[480px] flex flex-col bg-slate-900 border-l border-slate-700/50 h-full shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Settings2 size={16} className="text-emerald-400" />
              JVM Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Applied on next server start
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
                  <span className="text-lg font-bold text-emerald-400">
                    {fmtMb(memoryMb)}
                  </span>
                </div>

                {/* Preset buttons */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {MEMORY_PRESETS.map((mb) => (
                    <button
                      key={mb}
                      onClick={() => setMemoryMb(mb)}
                      className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        memoryMb === mb
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : "bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                      }`}
                    >
                      {fmtMb(mb)}
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={0}
                  max={MEMORY_PRESETS.length - 1}
                  value={sliderIndex === -1 ? 1 : sliderIndex}
                  onChange={(e) => setMemoryMb(MEMORY_PRESETS[Number(e.target.value)])}
                  className="w-full accent-emerald-500"
                />

                <p className="text-xs text-slate-500 mt-2">
                  Xms (initial heap) is set to half of Xmx automatically.
                </p>
              </div>

              {/* Extra JVM flags */}
              <div>
                <label className="block text-sm font-semibold text-slate-200 mb-2">
                  Extra JVM Flags
                </label>
                <textarea
                  value={extraFlags}
                  onChange={(e) => setExtraFlags(e.target.value)}
                  rows={5}
                  placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled ..."
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 outline-none resize-none transition-all"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Space-separated flags added between Xmx and -jar.
                  <br />
                  Recommended:{" "}
                  <code className="text-slate-400 bg-slate-800 px-1 rounded">
                    -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200
                  </code>
                </p>
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
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
