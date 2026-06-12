import {
  Loader2,
  Search,
  Shield,
  ShieldOff,
  Star,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../utils/utils";

interface Player {
  uuid: string;
  name: string;
}

interface OpEntry extends Player {
  level: number;
  bypasses_player_limit: boolean;
}

interface BannedEntry extends Player {
  created: string;
  source: string;
  expires: string;
  reason: string;
}

type Tab = "whitelist" | "ops" | "banned";

function PlayerRow({
  name,
  uuid,
  badge,
  onRemove,
  removing,
}: {
  name: string;
  uuid: string;
  badge?: React.ReactNode;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl hover:border-slate-600/50 transition-all">
      <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center shrink-0 font-bold text-sm text-slate-300">
        {name[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-200 font-medium truncate">{name}</p>
          {badge}
        </div>
        <p className="text-[10px] text-slate-600 font-mono truncate">{uuid}</p>
      </div>
      <button
        onClick={onRemove}
        disabled={removing}
        className="shrink-0 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
      >
        {removing ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
      </button>
    </div>
  );
}

export default function PlayersManager({
  location,
  isRunning,
  onClose,
}: {
  location: string;
  isRunning: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("whitelist");
  const [whitelist, setWhitelist] = useState<Player[]>([]);
  const [ops, setOps] = useState<OpEntry[]>([]);
  const [banned, setBanned] = useState<BannedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingUuid, setRemovingUuid] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [wl, op, bn] = await Promise.all([
        invoke<Player[]>("get_whitelist", { location }),
        invoke<OpEntry[]>("get_ops", { location }),
        invoke<BannedEntry[]>("get_banned_players", { location }),
      ]);
      setWhitelist(wl);
      setOps(op);
      setBanned(bn);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [location]);

  const handleAdd = async () => {
    const name = addInput.trim();
    if (!name) return;
    setAdding(true);
    setAddError(null);
    try {
      const player = await invoke<Player>("lookup_player", { name });

      if (tab === "whitelist") {
        const next = [...whitelist.filter((p) => p.uuid !== player.uuid), player];
        await invoke("set_whitelist", { location, entries: next });
        setWhitelist(next);
      } else if (tab === "ops") {
        const existing = ops.find((p) => p.uuid === player.uuid);
        if (!existing) {
          const entry: OpEntry = { ...player, level: 4, bypasses_player_limit: false };
          const next = [...ops, entry];
          await invoke("set_ops", { location, entries: next });
          setOps(next);
        }
      }
      setAddInput("");
    } catch (e) {
      setAddError(String(e));
    } finally {
      setAdding(false);
    }
  };

  const removeWhitelist = async (uuid: string) => {
    setRemovingUuid(uuid);
    try {
      const next = whitelist.filter((p) => p.uuid !== uuid);
      await invoke("set_whitelist", { location, entries: next });
      setWhitelist(next);
    } finally {
      setRemovingUuid(null);
    }
  };

  const removeOp = async (uuid: string) => {
    setRemovingUuid(uuid);
    try {
      const next = ops.filter((p) => p.uuid !== uuid);
      await invoke("set_ops", { location, entries: next });
      setOps(next);
    } finally {
      setRemovingUuid(null);
    }
  };

  const unban = async (uuid: string) => {
    setRemovingUuid(uuid);
    try {
      await invoke("unban_player", { location, uuid });
      setBanned((prev) => prev.filter((p) => p.uuid !== uuid));
    } finally {
      setRemovingUuid(null);
    }
  };

  const tabs: { id: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { id: "whitelist", label: "Whitelist", count: whitelist.length, icon: <UserCheck size={13} /> },
    { id: "ops", label: "Operators", count: ops.length, icon: <Star size={13} /> },
    { id: "banned", label: "Banned", count: banned.length, icon: <Shield size={13} /> },
  ];

  const showAddBar = tab !== "banned";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[520px] flex flex-col bg-slate-900 border-l border-slate-700/50 h-full shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users size={16} className="text-emerald-400" />
                Player Management
              </h2>
              {isRunning && (
                <p className="text-xs text-yellow-400/80 mt-0.5">
                  File changes take effect on next restart while server is running.
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <X size={17} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setAddError(null); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  tab === t.id
                    ? "bg-slate-700 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {t.icon}
                {t.label}
                {t.count > 0 && (
                  <span className="px-1.5 py-0.5 bg-slate-600/60 rounded-full text-[10px]">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Add bar */}
        {showAddBar && (
          <div className="px-5 py-3 border-b border-slate-800/60 space-y-1.5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  value={addInput}
                  onChange={(e) => { setAddInput(e.target.value); setAddError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="Player username…"
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 outline-none transition-all"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={adding || !addInput.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shrink-0"
              >
                {adding ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Add
              </button>
            </div>
            {addError && (
              <p className="text-xs text-red-400">{addError}</p>
            )}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto console-scroll px-5 py-4 space-y-2">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 size={22} className="animate-spin text-emerald-400" />
            </div>
          ) : tab === "whitelist" ? (
            whitelist.length === 0 ? (
              <EmptyState icon={<UserCheck size={32} />} text="Whitelist is empty" />
            ) : (
              whitelist.map((p) => (
                <PlayerRow
                  key={p.uuid}
                  {...p}
                  onRemove={() => removeWhitelist(p.uuid)}
                  removing={removingUuid === p.uuid}
                />
              ))
            )
          ) : tab === "ops" ? (
            ops.length === 0 ? (
              <EmptyState icon={<Star size={32} />} text="No operators added" />
            ) : (
              ops.map((p) => (
                <PlayerRow
                  key={p.uuid}
                  {...p}
                  badge={
                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-medium">
                      Level {p.level}
                    </span>
                  }
                  onRemove={() => removeOp(p.uuid)}
                  removing={removingUuid === p.uuid}
                />
              ))
            )
          ) : banned.length === 0 ? (
            <EmptyState icon={<ShieldOff size={32} />} text="No banned players" />
          ) : (
            banned.map((p) => (
              <div
                key={p.uuid}
                className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl hover:border-slate-600/50 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 font-bold text-sm text-red-400">
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    Reason: {p.reason} · Expires: {p.expires}
                  </p>
                </div>
                <button
                  onClick={() => unban(p.uuid)}
                  disabled={removingUuid === p.uuid}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-slate-300 hover:text-white rounded-lg transition-all disabled:opacity-50"
                >
                  {removingUuid === p.uuid ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Trash2 size={11} />
                  )}
                  Unban
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <div className="text-slate-700 mb-3">{icon}</div>
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
}
