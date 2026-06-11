import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  FileBox,
  Loader2,
  Package,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Server } from "../hooks/servers";
import { cn } from "../utils/utils";

// ─── Modrinth types ──────────────────────────────────────────────────────────

interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  icon_url: string | null;
  downloads: number;
  follows: number;
  versions: string[];
  server_side: "required" | "optional" | "unsupported" | "unknown";
  categories: string[];
}

interface ModrinthSearchResponse {
  hits: ModrinthHit[];
  total_hits: number;
  offset: number;
  limit: number;
}

interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  version_type: "release" | "beta" | "alpha";
  loaders: string[];
  date_published: string;
  files: {
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }[];
}

interface InstalledFile {
  name: string;
  size: number;
  path: string;
}

// ─── Content config by engine ────────────────────────────────────────────────

interface ContentConfig {
  label: string;
  subFolder: string;
  loader: string | null;
  facets: string[][];
}

const DATAPACKS: ContentConfig = {
  label: "Datapacks",
  subFolder: "world/datapacks",
  loader: null,
  facets: [["project_type:datapack"]],
};

function getAvailableTabs(engine: string): ContentConfig[] {
  switch (engine.toLowerCase()) {
    case "fabric":
      return [{ label: "Mods", subFolder: "mods", loader: "fabric", facets: [["project_type:mod"], ["categories:fabric"]] }, DATAPACKS];
    case "forge":
      return [{ label: "Mods", subFolder: "mods", loader: "forge", facets: [["project_type:mod"], ["categories:forge"]] }, DATAPACKS];
    case "neoforge":
      return [{ label: "Mods", subFolder: "mods", loader: "neoforge", facets: [["project_type:mod"], ["categories:neoforge"]] }, DATAPACKS];
    case "paper":
      return [{ label: "Plugins", subFolder: "plugins", loader: "paper", facets: [["categories:paper"]] }, DATAPACKS];
    case "purpur":
      return [{ label: "Plugins", subFolder: "plugins", loader: "purpur", facets: [["categories:purpur"]] }, DATAPACKS];
    case "spigot":
      return [{ label: "Plugins", subFolder: "plugins", loader: "spigot", facets: [["categories:spigot"]] }, DATAPACKS];
    default:
      return [DATAPACKS];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODRINTH = "https://api.modrinth.com/v2";
const UA = "mc-server-manager/1.0.0";
const PAGE = 20;

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(0)} KB`;
  return `${b} B`;
}

type SortIndex = "relevance" | "downloads" | "follows" | "newest" | "updated";
type DLState = "idle" | "loading-versions" | "downloading" | "done" | "error";

// ─── API calls ───────────────────────────────────────────────────────────────

async function modrinthSearch(
  facets: string[][],
  query: string,
  index: SortIndex,
  offset: number,
  gameVersion: string | null,
): Promise<ModrinthSearchResponse> {
  const allFacets = [...facets];
  if (gameVersion) allFacets.push([`versions:${gameVersion}`]);

  const p = new URLSearchParams({
    limit: String(PAGE),
    offset: String(offset),
    index,
    facets: JSON.stringify(allFacets),
  });
  if (query.trim()) p.set("query", query.trim());

  const r = await fetch(`${MODRINTH}/search?${p}`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Modrinth search returned ${r.status}`);
  return r.json();
}

async function fetchVersions(
  projectId: string,
  loader: string | null,
  gameVersion: string | null,
): Promise<ModrinthVersion[]> {
  const p = new URLSearchParams({ include_changelog: "false" });
  if (loader) p.set("loaders", JSON.stringify([loader]));
  if (gameVersion) p.set("game_versions", JSON.stringify([gameVersion]));

  const r = await fetch(`${MODRINTH}/project/${projectId}/version?${p}`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Modrinth versions returned ${r.status}`);
  const versions: ModrinthVersion[] = await r.json();

  // If no results for this specific game version, fall back to just loader
  if (versions.length === 0 && gameVersion && loader) {
    const p2 = new URLSearchParams({ include_changelog: "false", loaders: JSON.stringify([loader]) });
    const r2 = await fetch(`${MODRINTH}/project/${projectId}/version?${p2}`, { headers: { "User-Agent": UA } });
    if (r2.ok) return r2.json();
  }

  return versions;
}

// ─── ContentBrowser ──────────────────────────────────────────────────────────

export default function ContentBrowser({
  server,
  onClose,
}: {
  server: Server & { storage: string };
  onClose: () => void;
}) {
  const tabs = getAvailableTabs(server.engine);
  const [activeIdx, setActiveIdx] = useState(0);
  const config = tabs[activeIdx];
  const mcVersion = server.version !== "Unknown" ? server.version : null;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortIndex, setSortIndex] = useState<SortIndex>("downloads");
  const [results, setResults] = useState<ModrinthHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Per-project state
  const [dlState, setDlState] = useState<Record<string, DLState>>({});
  const [dlError, setDlError] = useState<Record<string, string>>({});
  const [openVersions, setOpenVersions] = useState<Record<string, ModrinthVersion[] | null>>({});

  // Installed content
  const [showInstalled, setShowInstalled] = useState(false);
  const [installedFiles, setInstalledFiles] = useState<InstalledFile[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [installRevision, setInstallRevision] = useState(0);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Focus search on open
  useEffect(() => { searchRef.current?.focus(); }, []);

  // Reset installed view when tab changes
  useEffect(() => { setShowInstalled(false); }, [activeIdx]);

  // Fetch installed files whenever the installed view is open or content changes
  useEffect(() => {
    if (!showInstalled) return;
    let cancelled = false;
    setLoadingInstalled(true);
    invoke<InstalledFile[]>("list_installed_content", {
      serverLocation: server.location,
      subFolder: config.subFolder,
    })
      .then((files) => { if (!cancelled) setInstalledFiles(files); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoadingInstalled(false); });
    return () => { cancelled = true; };
  }, [showInstalled, config.subFolder, installRevision]);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 380);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch whenever query, sort, or active tab changes
  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    setResults([]);
    setOffset(0);
    setTotalHits(0);
    setOpenVersions({});
    setDlState({});
    setDlError({});

    modrinthSearch(config.facets, debouncedQuery, sortIndex, 0, mcVersion)
      .then((data) => {
        if (cancelled) return;
        setResults(data.hits);
        setTotalHits(data.total_hits);
        setOffset(data.hits.length);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setSearching(false); });

    return () => { cancelled = true; };
  }, [debouncedQuery, sortIndex, activeIdx]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await modrinthSearch(config.facets, debouncedQuery, sortIndex, offset, mcVersion);
      setResults((prev) => [...prev, ...data.hits]);
      setOffset((prev) => prev + data.hits.length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleVersions(hit: ModrinthHit) {
    if (openVersions[hit.project_id] !== undefined) {
      setOpenVersions((prev) => { const n = { ...prev }; delete n[hit.project_id]; return n; });
      return;
    }

    setOpenVersions((prev) => ({ ...prev, [hit.project_id]: null }));
    try {
      const versions = await fetchVersions(hit.project_id, config.loader, mcVersion);
      setOpenVersions((prev) => ({ ...prev, [hit.project_id]: versions.slice(0, 10) }));
    } catch {
      setOpenVersions((prev) => ({ ...prev, [hit.project_id]: [] }));
    }
  }

  async function handleDownload(hit: ModrinthHit, version: ModrinthVersion) {
    const file = version.files.find((f) => f.primary) ?? version.files[0];
    if (!file) return;

    setDlState((p) => ({ ...p, [hit.project_id]: "downloading" }));
    setOpenVersions((prev) => { const n = { ...prev }; delete n[hit.project_id]; return n; });

    try {
      await invoke("download_content", {
        url: file.url,
        serverLocation: server.location,
        subFolder: config.subFolder,
        filename: file.filename,
      });
      setDlState((p) => ({ ...p, [hit.project_id]: "done" }));
      setInstallRevision((v) => v + 1);
      setTimeout(() => setDlState((p) => { const n = { ...p }; delete n[hit.project_id]; return n; }), 3000);
    } catch (e) {
      setDlState((p) => ({ ...p, [hit.project_id]: "error" }));
      setDlError((p) => ({ ...p, [hit.project_id]: String(e) }));
      setTimeout(() => {
        setDlState((p) => { const n = { ...p }; delete n[hit.project_id]; return n; });
        setDlError((p) => { const n = { ...p }; delete n[hit.project_id]; return n; });
      }, 4000);
    }
  }

  async function handleDeleteInstalled(path: string) {
    setDeletingPath(path);
    try {
      await invoke("delete_installed_file", { path });
      setInstallRevision((v) => v + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingPath(null);
    }
  }

  const hasMore = results.length < totalHits;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-[560px] flex flex-col bg-slate-900 border-l border-slate-700/50 h-full shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Add Content</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {server.name} · {server.engine}
                {mcVersion ? ` ${mcVersion}` : ""} · via Modrinth
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <X size={17} />
            </button>
          </div>

          {/* Tab switcher — only shown when there are multiple options */}
          {tabs.length > 1 && (
            <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl w-fit">
              {tabs.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setActiveIdx(i)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                    activeIdx === i
                      ? "bg-slate-700 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search + sort */}
        <div className="px-5 pt-4 pb-3 space-y-2.5 border-b border-slate-800/60">
          <div className="relative">
            {searching ? (
              <Loader2
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin pointer-events-none"
              />
            ) : (
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
            )}
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${config.label.toLowerCase()} on Modrinth…`}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowInstalled((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-all",
                  showInstalled ? "text-emerald-400" : "text-slate-500 hover:text-slate-300",
                )}
              >
                <div
                  className={cn(
                    "w-3.5 h-3.5 rounded border flex items-center justify-center transition-all",
                    showInstalled
                      ? "bg-emerald-500/20 border-emerald-500/50"
                      : "border-slate-600 bg-slate-800/60",
                  )}
                >
                  {showInstalled && <Check size={9} className="text-emerald-400" />}
                </div>
                <FileBox size={12} />
                Installed
              </button>
              {!showInstalled && (
                <span className="text-xs text-slate-500">
                  {!searching && totalHits > 0 && `${totalHits.toLocaleString()} results`}
                </span>
              )}
            </div>
            {!showInstalled && (
              <select
                value={sortIndex}
                onChange={(e) => setSortIndex(e.target.value as SortIndex)}
                className="text-xs bg-slate-800 border border-slate-700/50 text-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500/40 transition-all cursor-pointer"
              >
                <option value="relevance">Relevance</option>
                <option value="downloads">Most Downloaded</option>
                <option value="follows">Most Followed</option>
                <option value="newest">Newest</option>
                <option value="updated">Recently Updated</option>
              </select>
            )}
          </div>
        </div>

        {/* Results / Installed */}
        <div className="flex-1 overflow-y-auto console-scroll">
          {showInstalled ? (
            loadingInstalled ? (
              <div className="flex justify-center items-center h-48">
                <Loader2 size={22} className="animate-spin text-emerald-400" />
              </div>
            ) : installedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-8">
                <FileBox size={32} className="text-slate-700 mb-3" />
                <p className="text-slate-400 text-sm">No {config.label.toLowerCase()} installed yet</p>
                <p className="text-xs text-slate-600 mt-1">Downloaded files will appear here</p>
              </div>
            ) : (
              <div className="px-4 py-3 space-y-1.5">
                {installedFiles.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl hover:border-slate-600/50 transition-all group"
                  >
                    <FileBox size={15} className="text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate font-medium">{file.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{fmtBytes(file.size)}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteInstalled(file.path)}
                      disabled={deletingPath === file.path}
                      className="shrink-0 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                    >
                      {deletingPath === file.path
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : searching ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 size={22} className="animate-spin text-emerald-400" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-8">
              <Package size={32} className="text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm">No {config.label.toLowerCase()} found</p>
              {debouncedQuery && (
                <p className="text-xs text-slate-600 mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            <div className="px-4 py-3 space-y-2">
              {results.map((hit) => (
                <ProjectCard
                  key={hit.project_id}
                  hit={hit}
                  config={config}
                  mcVersion={mcVersion}
                  dlState={dlState[hit.project_id] ?? "idle"}
                  dlError={dlError[hit.project_id]}
                  versions={openVersions[hit.project_id]}
                  onToggleVersions={() => toggleVersions(hit)}
                  onDownload={(v) => handleDownload(hit, v)}
                />
              ))}

              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-3 text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
                >
                  {loadingMore && <Loader2 size={13} className="animate-spin" />}
                  {loadingMore ? "Loading…" : `Show more (${(totalHits - results.length).toLocaleString()} remaining)`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ProjectCard ─────────────────────────────────────────────────────────────

function ProjectCard({
  hit,
  config,
  mcVersion,
  dlState,
  dlError,
  versions,
  onToggleVersions,
  onDownload,
}: {
  hit: ModrinthHit;
  config: ContentConfig;
  mcVersion: string | null;
  dlState: DLState;
  dlError?: string;
  versions: ModrinthVersion[] | null | undefined;
  onToggleVersions: () => void;
  onDownload: (v: ModrinthVersion) => void;
}) {
  const versionPickerOpen = versions !== undefined;
  const clientOnly = hit.server_side === "unsupported";

  const btnClass = cn(
    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0",
    dlState === "done" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    dlState === "error" && "bg-red-500/20 text-red-400 border-red-500/30 cursor-default",
    dlState === "downloading" && "bg-slate-700/60 text-slate-400 border-slate-600/40 cursor-wait",
    dlState === "idle" && !versionPickerOpen && "bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-600/40 cursor-pointer",
    dlState === "idle" && versionPickerOpen && "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 cursor-pointer",
  );

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 hover:border-slate-600/50 transition-all">
      <div className="flex gap-3">
        {/* Icon */}
        <div className="shrink-0 w-11 h-11 rounded-lg overflow-hidden bg-slate-700/50 flex items-center justify-center">
          {hit.icon_url ? (
            <img
              src={hit.icon_url}
              alt={hit.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Package size={18} className="text-slate-500" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-white truncate block">{hit.title}</span>
              <span className="text-[11px] text-slate-500">by {hit.author}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500 shrink-0 mt-0.5">
              <span>↓ {fmt(hit.downloads)}</span>
              <span>★ {fmt(hit.follows)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{hit.description}</p>

          {/* Game version tags — show newest 4 */}
          <div className="flex flex-wrap gap-1 mt-2">
            {[...hit.versions].reverse().slice(0, 4).map((v) => (
              <span key={v} className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded font-mono">
                {v}
              </span>
            ))}
            {hit.versions.length > 4 && (
              <span className="text-[10px] px-1.5 py-0.5 text-slate-600 rounded">
                +{hit.versions.length - 4} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {clientOnly && (
            <span className="flex items-center gap-1 text-[11px] text-yellow-500/80">
              <AlertTriangle size={11} />
              Client-side only
            </span>
          )}
        </div>

        <button
          onClick={dlState === "idle" ? onToggleVersions : undefined}
          disabled={dlState !== "idle"}
          className={btnClass}
        >
          {dlState === "downloading" && <><Loader2 size={11} className="animate-spin" /> Downloading…</>}
          {dlState === "done" && <><Check size={11} /> Downloaded</>}
          {dlState === "error" && <>✕ Failed</>}
          {dlState === "idle" && (
            <>
              <Download size={11} />
              Download
              <ChevronDown size={11} className={cn("transition-transform duration-150", versionPickerOpen && "rotate-180")} />
            </>
          )}
        </button>
      </div>

      {/* Error tooltip */}
      {dlState === "error" && dlError && (
        <p className="text-[11px] text-red-400/80 mt-2 break-all">{dlError}</p>
      )}

      {/* Version picker */}
      {versionPickerOpen && dlState === "idle" && (
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          {versions === null ? (
            <div className="flex justify-center py-3">
              <Loader2 size={16} className="animate-spin text-slate-500" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-3">
              No compatible versions found
              {mcVersion ? ` for ${config.loader ?? "this loader"} ${mcVersion}` : ""}
            </p>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto console-scroll pr-1">
              {versions.map((v) => {
                const file = v.files.find((f) => f.primary) ?? v.files[0];
                return (
                  <button
                    key={v.id}
                    onClick={() => onDownload(v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900/70 hover:bg-slate-900 border border-slate-700/30 hover:border-emerald-500/30 text-left transition-all group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-white font-medium">{v.version_number}</span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-medium",
                            v.version_type === "release" ? "bg-emerald-500/20 text-emerald-400" :
                            v.version_type === "beta" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-red-500/20 text-red-400",
                          )}
                        >
                          {v.version_type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {[...v.game_versions].reverse().slice(0, 3).join(" · ")}
                        </span>
                      </div>
                      {file && (
                        <span className="text-[10px] text-slate-600">{fmtBytes(file.size)}</span>
                      )}
                    </div>
                    <Download
                      size={13}
                      className="text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0 ml-2"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
