import {
  Check,
  ChevronDown,
  Loader2,
  Server,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../utils/utils";

// ── Engine definitions ────────────────────────────────────────────────────────

type Engine = "vanilla" | "paper" | "fabric" | "forge";

interface EngineOption {
  id: Engine;
  label: string;
  description: string;
  activeCls: string;
  inactiveCls: string;
}

const ENGINES: EngineOption[] = [
  {
    id: "paper",
    label: "Paper",
    description: "Optimised Bukkit fork",
    activeCls: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
    inactiveCls: "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600/50 hover:text-slate-300",
  },
  {
    id: "fabric",
    label: "Fabric",
    description: "Lightweight mod loader",
    activeCls: "bg-blue-500/15 border-blue-500/40 text-blue-300",
    inactiveCls: "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600/50 hover:text-slate-300",
  },
  {
    id: "forge",
    label: "Forge",
    description: "Classic mod loader",
    activeCls: "bg-orange-500/15 border-orange-500/40 text-orange-300",
    inactiveCls: "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600/50 hover:text-slate-300",
  },
  {
    id: "vanilla",
    label: "Vanilla",
    description: "Official Mojang jar",
    activeCls: "bg-slate-700/60 border-slate-500/50 text-slate-200",
    inactiveCls: "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:border-slate-600/50 hover:text-slate-300",
  },
];

// ── Types from Rust ───────────────────────────────────────────────────────────

interface VersionEntry {
  id: string;
  stable: boolean;
}

interface PaperBuildEntry {
  build: number;
  filename: string;
}

interface ForgeVersionEntry {
  forge_version: string;
  label: string;
}

type Step = "configure" | "installing" | "done" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

function SelectBox({
  value,
  onChange,
  children,
  disabled,
}: {
  value: string | number;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500/50 appearance-none cursor-pointer pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
      />
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 h-10 text-xs text-slate-500">
      <Loader2 size={13} className="animate-spin" />
      {label}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateServer({
  workingDir,
  onClose,
  onCreated,
}: {
  workingDir: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("configure");
  const [engine, setEngine] = useState<Engine>("paper");

  // MC versions
  const [mcVersions, setMcVersions] = useState<VersionEntry[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedMcVersion, setSelectedMcVersion] = useState("");
  const [showSnapshots, setShowSnapshots] = useState(false);

  // Paper
  const [paperBuilds, setPaperBuilds] = useState<PaperBuildEntry[]>([]);
  const [loadingBuilds, setLoadingBuilds] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState<PaperBuildEntry | null>(null);

  // Forge
  const [forgeVersions, setForgeVersions] = useState<ForgeVersionEntry[]>([]);
  const [loadingForge, setLoadingForge] = useState(false);
  const [selectedForge, setSelectedForge] = useState("");

  // Server details
  const [serverName, setServerName] = useState("");

  // Install log
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [installError, setInstallError] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Fetch MC versions when engine changes
  useEffect(() => {
    setMcVersions([]);
    setSelectedMcVersion("");
    setPaperBuilds([]);
    setSelectedBuild(null);
    setForgeVersions([]);
    setSelectedForge("");
    setLoadingVersions(true);

    const run = async () => {
      try {
        let versions: VersionEntry[] = [];
        if (engine === "vanilla") {
          versions = await invoke<VersionEntry[]>("fetch_vanilla_versions");
        } else if (engine === "paper") {
          const ids = await invoke<string[]>("fetch_paper_versions");
          versions = ids.map((id) => ({ id, stable: true }));
        } else if (engine === "fabric") {
          versions = await invoke<VersionEntry[]>("fetch_fabric_game_versions");
        } else if (engine === "forge") {
          const ids = await invoke<string[]>("fetch_forge_mc_versions");
          versions = ids.map((id) => ({ id, stable: true }));
        }
        setMcVersions(versions);
        const first = versions.find((v) => v.stable) ?? versions[0];
        if (first) setSelectedMcVersion(first.id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingVersions(false);
      }
    };

    run();
  }, [engine]);

  // Fetch sub-versions when MC version changes
  useEffect(() => {
    if (!selectedMcVersion) return;

    if (engine === "paper") {
      setLoadingBuilds(true);
      setPaperBuilds([]);
      setSelectedBuild(null);
      invoke<PaperBuildEntry[]>("fetch_paper_builds", { version: selectedMcVersion })
        .then((builds) => {
          setPaperBuilds(builds);
          if (builds.length > 0) setSelectedBuild(builds[0]);
        })
        .catch(console.error)
        .finally(() => setLoadingBuilds(false));
    }

    if (engine === "forge") {
      setLoadingForge(true);
      setForgeVersions([]);
      setSelectedForge("");
      invoke<ForgeVersionEntry[]>("fetch_forge_versions", { mcVersion: selectedMcVersion })
        .then((versions) => {
          setForgeVersions(versions);
          if (versions.length > 0) setSelectedForge(versions[0].forge_version);
        })
        .catch(console.error)
        .finally(() => setLoadingForge(false));
    }
  }, [selectedMcVersion, engine]);

  // Listen for install log events
  useEffect(() => {
    const unlisten = listen<string>("server-create-log", (e) => {
      setInstallLog((prev) => [...prev, e.payload]);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [installLog]);

  // Escape closes when in configure step
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step === "configure") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, step]);

  // Focus name field on mount
  useEffect(() => { nameRef.current?.focus(); }, []);

  const visibleMcVersions = mcVersions.filter(
    (v) => showSnapshots || v.stable,
  );

  const canCreate =
    serverName.trim().length > 0 &&
    selectedMcVersion !== "" &&
    (engine !== "paper" || selectedBuild !== null) &&
    (engine !== "forge" || selectedForge !== "");

  const handleCreate = async () => {
    setStep("installing");
    setInstallLog([]);
    setInstallError("");

    let buildVersion = "";
    if (engine === "paper" && selectedBuild) {
      buildVersion = `${selectedBuild.build}:${selectedBuild.filename}`;
    } else if (engine === "forge") {
      buildVersion = selectedForge;
    }

    try {
      await invoke("create_server", {
        engine,
        mcVersion: selectedMcVersion,
        buildVersion,
        serverName: serverName.trim(),
        workingDir,
      });
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["servers-storage"] });
    } catch (e) {
      setInstallError(String(e));
      setStep("error");
    }
  };

  const handleDone = () => {
    onCreated();
    onClose();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={step === "configure" ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/70 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">
              {step === "configure"
                ? "Create Server"
                : step === "installing"
                ? `Setting up "${serverName}"…`
                : step === "done"
                ? "Server Ready!"
                : "Setup Failed"}
            </h2>
            {step === "configure" && (
              <p className="text-xs text-slate-500 mt-0.5">
                Downloads from official sources · EULA accepted automatically
              </p>
            )}
          </div>
          <button
            onClick={step === "done" ? handleDone : step === "configure" ? onClose : undefined}
            disabled={step === "installing"}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto console-scroll">
          {step === "configure" ? (
            <div className="px-6 py-5 space-y-5">
              {/* Engine picker */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2.5 uppercase tracking-wide">
                  Server Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ENGINES.map((eng) => (
                    <button
                      key={eng.id}
                      onClick={() => setEngine(eng.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-center transition-all",
                        engine === eng.id ? eng.activeCls : eng.inactiveCls,
                      )}
                    >
                      <span className="text-sm font-bold">{eng.label}</span>
                      <span className="text-[10px] opacity-70 leading-tight">
                        {eng.description}
                      </span>
                      {engine === eng.id && (
                        <Check size={10} className="mt-0.5 opacity-80" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Forge Java requirement notice */}
              {engine === "forge" && (
                <div className="px-3 py-2.5 bg-orange-500/10 border border-orange-500/25 rounded-xl">
                  <p className="text-xs text-orange-300">
                    ⚠ Forge requires Java to be on your PATH — the installer
                    runs <code className="font-mono">java -jar</code> locally.
                  </p>
                </div>
              )}

              {/* Fabric info */}
              {engine === "fabric" && (
                <div className="px-3 py-2.5 bg-blue-500/10 border border-blue-500/25 rounded-xl">
                  <p className="text-xs text-blue-300">
                    The latest stable Fabric loader is selected automatically.
                    The server jar will download Minecraft on first launch.
                  </p>
                </div>
              )}

              {/* MC Version */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Minecraft Version
                  </label>
                  {(engine === "vanilla" || engine === "fabric") && (
                    <button
                      onClick={() => setShowSnapshots((v) => !v)}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] transition-all",
                        showSnapshots
                          ? "text-yellow-400"
                          : "text-slate-600 hover:text-slate-400",
                      )}
                    >
                      <div
                        className={cn(
                          "w-3 h-3 rounded border flex items-center justify-center",
                          showSnapshots
                            ? "bg-yellow-500/20 border-yellow-500/50"
                            : "border-slate-600",
                        )}
                      >
                        {showSnapshots && (
                          <Check size={8} className="text-yellow-400" />
                        )}
                      </div>
                      Snapshots
                    </button>
                  )}
                </div>
                {loadingVersions ? (
                  <LoadingRow label="Loading versions…" />
                ) : (
                  <SelectBox
                    value={selectedMcVersion}
                    onChange={setSelectedMcVersion}
                  >
                    {visibleMcVersions.length === 0 && (
                      <option value="">No versions available</option>
                    )}
                    {visibleMcVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id}
                        {!v.stable ? " (snapshot)" : ""}
                      </option>
                    ))}
                  </SelectBox>
                )}
              </div>

              {/* Paper build */}
              {engine === "paper" && selectedMcVersion && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                    Paper Build
                  </label>
                  {loadingBuilds ? (
                    <LoadingRow label="Loading builds…" />
                  ) : (
                    <SelectBox
                      value={selectedBuild?.build ?? ""}
                      onChange={(v) => {
                        const b = paperBuilds.find((b) => String(b.build) === v);
                        setSelectedBuild(b ?? null);
                      }}
                    >
                      {paperBuilds.map((b, i) => (
                        <option key={b.build} value={b.build}>
                          Build {b.build}
                          {i === 0 ? " — latest" : ""}
                        </option>
                      ))}
                    </SelectBox>
                  )}
                </div>
              )}

              {/* Forge version */}
              {engine === "forge" && selectedMcVersion && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                    Forge Version
                  </label>
                  {loadingForge ? (
                    <LoadingRow label="Loading Forge versions…" />
                  ) : forgeVersions.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">
                      No Forge versions found for {selectedMcVersion}
                    </p>
                  ) : (
                    <SelectBox
                      value={selectedForge}
                      onChange={setSelectedForge}
                    >
                      {forgeVersions.map((v) => (
                        <option key={v.forge_version} value={v.forge_version}>
                          {v.forge_version} ({v.label})
                        </option>
                      ))}
                    </SelectBox>
                  )}
                </div>
              )}

              {/* Server name */}
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                  Server Name
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canCreate) handleCreate();
                  }}
                  placeholder="My Minecraft Server"
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/50 transition-all"
                />
                {serverName.trim() && (
                  <p className="text-[11px] text-slate-600 mt-1.5 font-mono truncate">
                    {workingDir}\{serverName.trim()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Install log */
            <div className="px-6 py-4 font-mono text-[11px] leading-5 space-y-0.5 min-h-[240px]">
              {installLog.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "whitespace-pre-wrap break-all",
                    line.startsWith("✓")
                      ? "text-emerald-400 font-bold"
                      : /error|failed|exception/i.test(line)
                      ? "text-red-400"
                      : /warn/i.test(line)
                      ? "text-yellow-400"
                      : "text-slate-300",
                  )}
                >
                  {line}
                </div>
              ))}
              {step === "installing" && installLog.length > 0 && (
                <div className="flex items-center gap-1.5 text-slate-500 mt-1">
                  <Loader2 size={10} className="animate-spin" />
                  <span>Working…</span>
                </div>
              )}
              {step === "error" && installError && (
                <div className="mt-3 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                  {installError}
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800/70 flex items-center justify-between gap-3 shrink-0">
          {step === "configure" && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!canCreate}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
              >
                <Server size={14} />
                Create Server
              </button>
            </>
          )}

          {step === "installing" && (
            <div className="flex items-center gap-2 text-sm text-slate-400 mx-auto">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              Installing — please don't close this window
            </div>
          )}

          {step === "done" && (
            <button
              onClick={handleDone}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
            >
              <Check size={14} />
              Done
            </button>
          )}

          {step === "error" && (
            <>
              <button
                onClick={() => setStep("configure")}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <span className="text-xs text-red-400/80">
                Setup failed — see log above
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
