import {
  Check,
  ChevronDown,
  Cpu,
  Globe,
  Loader2,
  Save,
  Settings2,
  Shield,
  Sliders,
  Swords,
  TreePine,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Server } from "../hooks/servers";
import { cn } from "../utils/utils";

// ── Property schema ───────────────────────────────────────────────────────────

type FieldType = "text" | "number" | "boolean" | "select" | "password";

interface PropSchema {
  key: string;
  label: string;
  description: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  default: string;
}

interface PropGroup {
  id: string;
  label: string;
  Icon: React.ElementType;
  props: PropSchema[];
}

const PROPERTY_GROUPS: PropGroup[] = [
  {
    id: "general",
    label: "General",
    Icon: Settings2,
    props: [
      {
        key: "motd",
        label: "Message of the Day",
        description: "Shown beneath your server name in the multiplayer list",
        type: "text",
        default: "A Minecraft Server",
      },
      {
        key: "gamemode",
        label: "Default Gamemode",
        description: "Gamemode assigned to players on first join",
        type: "select",
        options: [
          { value: "survival", label: "Survival" },
          { value: "creative", label: "Creative" },
          { value: "adventure", label: "Adventure" },
          { value: "spectator", label: "Spectator" },
        ],
        default: "survival",
      },
      {
        key: "difficulty",
        label: "Difficulty",
        description: "Game difficulty level",
        type: "select",
        options: [
          { value: "peaceful", label: "Peaceful" },
          { value: "easy", label: "Easy" },
          { value: "normal", label: "Normal" },
          { value: "hard", label: "Hard" },
        ],
        default: "easy",
      },
      {
        key: "max-players",
        label: "Max Players",
        description: "Maximum concurrent players allowed",
        type: "number",
        min: 1,
        max: 2147483647,
        default: "20",
      },
      {
        key: "online-mode",
        label: "Online Mode",
        description: "Verify player identities with Mojang/Microsoft",
        type: "boolean",
        default: "true",
      },
      {
        key: "hardcore",
        label: "Hardcore Mode",
        description: "Players are banned permanently on death",
        type: "boolean",
        default: "false",
      },
      {
        key: "pvp",
        label: "Player vs Player",
        description: "Allow combat between players",
        type: "boolean",
        default: "true",
      },
      {
        key: "force-gamemode",
        label: "Force Gamemode",
        description: "Put players back to default gamemode on join",
        type: "boolean",
        default: "false",
      },
      {
        key: "white-list",
        label: "Whitelist",
        description: "Only allow players on the whitelist to join",
        type: "boolean",
        default: "false",
      },
      {
        key: "enforce-whitelist",
        label: "Enforce Whitelist",
        description: "Kick players not on the whitelist when it is reloaded",
        type: "boolean",
        default: "false",
      },
      {
        key: "player-idle-timeout",
        label: "Idle Timeout (minutes)",
        description: "Kick idle players after this many minutes (0 = off)",
        type: "number",
        min: 0,
        max: 2147483647,
        default: "0",
      },
      {
        key: "op-permission-level",
        label: "Operator Permission Level",
        description: "Default permissions granted to operators (1–4)",
        type: "select",
        options: [
          { value: "1", label: "1 — Bypass spawn protection" },
          { value: "2", label: "2 — Commands & command blocks" },
          { value: "3", label: "3 — Ban / kick / op" },
          { value: "4", label: "4 — All commands including stop" },
        ],
        default: "4",
      },
    ],
  },
  {
    id: "world",
    label: "World",
    Icon: TreePine,
    props: [
      {
        key: "level-name",
        label: "World Folder Name",
        description: "Name of the folder that stores the world data",
        type: "text",
        default: "world",
      },
      {
        key: "level-seed",
        label: "World Seed",
        description: "Seed used for world generation (empty = random)",
        type: "text",
        default: "",
      },
      {
        key: "level-type",
        label: "World Type",
        description: "Terrain generation preset",
        type: "select",
        options: [
          { value: "minecraft:normal", label: "Normal" },
          { value: "minecraft:flat", label: "Flat" },
          { value: "minecraft:large_biomes", label: "Large Biomes" },
          { value: "minecraft:amplified", label: "Amplified" },
          { value: "DEFAULT", label: "Default (legacy)" },
          { value: "FLAT", label: "Flat (legacy)" },
        ],
        default: "minecraft:normal",
      },
      {
        key: "view-distance",
        label: "View Distance (chunks)",
        description: "Server-side render distance sent to clients (3–32)",
        type: "number",
        min: 3,
        max: 32,
        default: "10",
      },
      {
        key: "simulation-distance",
        label: "Simulation Distance (chunks)",
        description: "Area of chunks that are actively ticked (3–32)",
        type: "number",
        min: 3,
        max: 32,
        default: "10",
      },
      {
        key: "generate-structures",
        label: "Generate Structures",
        description: "Spawn villages, strongholds, temples, etc.",
        type: "boolean",
        default: "true",
      },
      {
        key: "allow-nether",
        label: "Allow Nether",
        description: "Let players travel to the Nether dimension",
        type: "boolean",
        default: "true",
      },
      {
        key: "spawn-monsters",
        label: "Spawn Monsters",
        description: "Enable hostile mob spawning",
        type: "boolean",
        default: "true",
      },
      {
        key: "spawn-animals",
        label: "Spawn Animals",
        description: "Enable passive mob spawning",
        type: "boolean",
        default: "true",
      },
      {
        key: "spawn-npcs",
        label: "Spawn Villagers",
        description: "Enable villager spawning",
        type: "boolean",
        default: "true",
      },
      {
        key: "max-world-size",
        label: "Max World Size",
        description: "Maximum world border radius in blocks",
        type: "number",
        min: 1,
        max: 29999984,
        default: "29999984",
      },
    ],
  },
  {
    id: "network",
    label: "Network",
    Icon: Globe,
    props: [
      {
        key: "server-port",
        label: "Server Port",
        description: "UDP/TCP port the server listens on",
        type: "number",
        min: 1,
        max: 65535,
        default: "25565",
      },
      {
        key: "server-ip",
        label: "Bind IP",
        description: "IP address to bind to (empty = all interfaces)",
        type: "text",
        default: "",
      },
      {
        key: "network-compression-threshold",
        label: "Compression Threshold (bytes)",
        description: "Compress packets larger than this (-1 = off, 0 = all)",
        type: "number",
        min: -1,
        max: 65535,
        default: "256",
      },
      {
        key: "online-mode",
        label: "Online Mode",
        description: "Authenticate with Mojang/Microsoft servers",
        type: "boolean",
        default: "true",
      },
      {
        key: "prevent-proxy-connections",
        label: "Block Proxy Connections",
        description: "Reject connections through proxies or VPNs",
        type: "boolean",
        default: "false",
      },
      {
        key: "enable-rcon",
        label: "Enable RCON",
        description: "Allow remote console access over the network",
        type: "boolean",
        default: "false",
      },
      {
        key: "rcon.port",
        label: "RCON Port",
        description: "Port for RCON connections",
        type: "number",
        min: 1,
        max: 65535,
        default: "25575",
      },
      {
        key: "rcon.password",
        label: "RCON Password",
        description: "Password required for RCON connections",
        type: "password",
        default: "",
      },
      {
        key: "enable-query",
        label: "Enable Query",
        description: "Enable GameSpy4 query protocol for server pings",
        type: "boolean",
        default: "false",
      },
    ],
  },
  {
    id: "combat",
    label: "Combat",
    Icon: Swords,
    props: [
      {
        key: "pvp",
        label: "Player vs Player",
        description: "Allow damage between players",
        type: "boolean",
        default: "true",
      },
      {
        key: "allow-flight",
        label: "Allow Flight",
        description: "Don't kick players using flight mods or Elytra",
        type: "boolean",
        default: "false",
      },
      {
        key: "spawn-protection",
        label: "Spawn Protection Radius",
        description: "Radius (blocks) around spawn point that non-ops can't modify (0 = off)",
        type: "number",
        min: 0,
        max: 2147483647,
        default: "16",
      },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    Icon: Cpu,
    props: [
      {
        key: "max-tick-time",
        label: "Max Tick Time (ms)",
        description: "Crash if a tick takes longer than this (-1 = disable watchdog)",
        type: "number",
        min: -1,
        max: 2147483647,
        default: "60000",
      },
      {
        key: "entity-broadcast-range-percentage",
        label: "Entity Broadcast Range (%)",
        description: "Range at which entities are sent to clients (10–1000)",
        type: "number",
        min: 10,
        max: 1000,
        default: "100",
      },
      {
        key: "sync-chunk-writes",
        label: "Sync Chunk Writes",
        description: "Write chunk data synchronously (safer but slower on HDDs)",
        type: "boolean",
        default: "true",
      },
      {
        key: "use-native-transport",
        label: "Native Transport",
        description: "Use Netty's native epoll/kqueue (Linux/macOS only)",
        type: "boolean",
        default: "true",
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    Icon: Shield,
    props: [
      {
        key: "enforce-secure-profile",
        label: "Enforce Secure Profile",
        description: "Require players to have a Mojang-signed chat key",
        type: "boolean",
        default: "true",
      },
      {
        key: "hide-online-players",
        label: "Hide Player Count",
        description: "Hide the player list from server pings",
        type: "boolean",
        default: "false",
      },
    ],
  },
];

// Build a flat lookup map and the set of all known keys
const SCHEMA_MAP: Record<string, PropSchema> = {};
const KNOWN_KEYS = new Set<string>();
for (const group of PROPERTY_GROUPS) {
  for (const prop of group.props) {
    SCHEMA_MAP[prop.key] = prop;
    KNOWN_KEYS.add(prop.key);
  }
}

// ── Small UI primitives ───────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150",
        checked ? "bg-emerald-500" : "bg-slate-600",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-150",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function PropField({
  schema,
  value,
  onChange,
}: {
  schema: PropSchema;
  value: string;
  onChange: (v: string) => void;
}) {
  if (schema.type === "boolean") {
    return (
      <Toggle checked={value === "true"} onChange={(v) => onChange(v ? "true" : "false")} />
    );
  }

  if (schema.type === "select") {
    return (
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-slate-800/70 border border-slate-700/50 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500/50 appearance-none cursor-pointer pr-6"
        >
          {schema.options!.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={11}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
      </div>
    );
  }

  if (schema.type === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={schema.min}
        max={schema.max}
        className="w-24 bg-slate-800/70 border border-slate-700/50 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500/50 text-right"
      />
    );
  }

  // text or password
  return (
    <input
      type={schema.type === "password" ? "password" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-48 bg-slate-800/70 border border-slate-700/50 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500/50"
    />
  );
}

function PropRow({
  schema,
  value,
  changed,
  onChange,
}: {
  schema: PropSchema;
  value: string;
  changed: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/50 last:border-0 transition-colors",
        changed && "bg-emerald-500/5",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-200">{schema.label}</p>
          {changed && (
            <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium uppercase tracking-wide">
              modified
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{schema.description}</p>
        <code className="text-[10px] text-slate-600 font-mono">{schema.key}</code>
      </div>
      <div className="shrink-0">
        <PropField schema={schema} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PropertiesEditor({
  server,
  isServerRunning,
  onClose,
}: {
  server: Server & { storage: string };
  isServerRunning: boolean;
  onClose: () => void;
}) {
  const [activeGroup, setActiveGroup] = useState("general");

  // values = current edits, originals = what was on disk when loaded
  const [values, setValues] = useState<Record<string, string>>({});
  const [originals, setOriginals] = useState<Record<string, string>>({});
  const [otherKeys, setOtherKeys] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load properties on mount
  useEffect(() => {
    setLoading(true);
    invoke<{ key: string; value: string }[]>("read_server_properties", {
      location: server.location,
    })
      .then((pairs) => {
        const disk: Record<string, string> = {};
        for (const { key, value } of pairs) disk[key] = value;

        // Seed with schema defaults, then overlay disk values
        const init: Record<string, string> = {};
        for (const key of KNOWN_KEYS) {
          init[key] = disk[key] ?? SCHEMA_MAP[key].default;
        }

        // Collect keys present in file but not in our schema
        const other: string[] = [];
        for (const key of Object.keys(disk)) {
          if (!KNOWN_KEYS.has(key)) {
            init[key] = disk[key];
            other.push(key);
          }
        }

        setValues(init);
        setOriginals({ ...init });
        setOtherKeys(other);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Reset scroll when switching tabs
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeGroup]);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const set = (key: string, val: string) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const isDirty = Object.keys(values).some((k) => values[k] !== originals[k]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const pairs = Object.entries(values).map(([key, value]) => ({ key, value }));
      await invoke("write_server_properties", {
        location: server.location,
        properties: pairs,
      });
      setOriginals({ ...values });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Which groups to show ──────────────────────────────────────────────────

  const allGroups = [
    ...PROPERTY_GROUPS,
    ...(otherKeys.length > 0
      ? [{ id: "other", label: "Other", Icon: Sliders, props: [] as PropSchema[] }]
      : []),
  ];

  const activeGroupData = PROPERTY_GROUPS.find((g) => g.id === activeGroup);

  // Count changed props per group for badges
  const changedCount = (groupId: string) => {
    const group = PROPERTY_GROUPS.find((g) => g.id === groupId);
    if (!group) {
      // "other" group
      return otherKeys.filter((k) => values[k] !== originals[k]).length;
    }
    return group.props.filter((p) => values[p.key] !== originals[p.key]).length;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="w-[560px] flex flex-col bg-slate-900 border-l border-slate-700/50 h-full shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-white">server.properties</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {server.name} · changes take effect after restart
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
            >
              <X size={17} />
            </button>
          </div>

          {isServerRunning && (
            <div className="mt-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/25 rounded-xl">
              <p className="text-xs text-yellow-400">
                Server is running — saved changes will apply after the next restart.
              </p>
            </div>
          )}
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-0.5 px-4 pt-3 pb-0 border-b border-slate-800 shrink-0 overflow-x-auto hide-scrollbar">
          {allGroups.map((group) => {
            const n = changedCount(group.id);
            const active = activeGroup === group.id;
            const GIcon = group.Icon;
            return (
              <button
                key={group.id}
                onClick={() => setActiveGroup(group.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap",
                  active
                    ? "text-emerald-400 border-emerald-500 bg-emerald-500/5"
                    : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/40",
                )}
              >
                <GIcon size={12} />
                {group.label}
                {n > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto console-scroll">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={22} className="animate-spin text-emerald-400" />
            </div>
          ) : activeGroup === "other" ? (
            /* Other / unknown props */
            <div>
              {otherKeys.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
                  No additional properties
                </div>
              ) : (
                otherKeys.map((key) => (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/50 last:border-0",
                      values[key] !== originals[key] && "bg-emerald-500/5",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-slate-200">{key}</code>
                        {values[key] !== originals[key] && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium uppercase tracking-wide">
                            modified
                          </span>
                        )}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={values[key] ?? ""}
                      onChange={(e) => set(key, e.target.value)}
                      className="w-48 bg-slate-800/70 border border-slate-700/50 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500/50"
                    />
                  </div>
                ))
              )}
            </div>
          ) : activeGroupData ? (
            <div>
              {activeGroupData.props.map((schema) => (
                <PropRow
                  key={schema.key}
                  schema={schema}
                  value={values[schema.key] ?? schema.default}
                  changed={values[schema.key] !== originals[schema.key]}
                  onChange={(v) => set(schema.key, v)}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs">
            {saveError ? (
              <span className="text-red-400">{saveError}</span>
            ) : savedAt ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Check size={12} />
                Saved
              </span>
            ) : isDirty ? (
              <span className="text-slate-500">Unsaved changes</span>
            ) : (
              <span className="text-slate-600">No changes</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <button
                onClick={() => {
                  setValues({ ...originals });
                  setSaveError("");
                }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-white transition-colors"
              >
                Revert
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Save size={13} />
              )}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
