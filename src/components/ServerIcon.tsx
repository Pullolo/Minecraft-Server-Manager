import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Box,
  Camera,
  Hammer,
  Layers,
  ScrollText,
  Server,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "../utils/utils";

// ── Engine → visual style ─────────────────────────────────────────────────────

interface EngineStyle {
  Icon: React.ElementType;
  bg: string;
  border: string;
  iconCls: string;
}

const ENGINE_STYLES: Record<string, EngineStyle> = {
  fabric:   { Icon: Layers,     bg: "bg-blue-500/10",    border: "border-blue-500/25",    iconCls: "text-blue-400" },
  forge:    { Icon: Hammer,     bg: "bg-orange-500/10",  border: "border-orange-500/25",  iconCls: "text-orange-400" },
  neoforge: { Icon: Hammer,     bg: "bg-orange-500/10",  border: "border-orange-500/25",  iconCls: "text-orange-400" },
  paper:    { Icon: ScrollText, bg: "bg-emerald-500/10", border: "border-emerald-500/25", iconCls: "text-emerald-400" },
  purpur:   { Icon: Sparkles,   bg: "bg-purple-500/10",  border: "border-purple-500/25",  iconCls: "text-purple-400" },
  spigot:   { Icon: Zap,        bg: "bg-yellow-500/10",  border: "border-yellow-500/25",  iconCls: "text-yellow-400" },
  vanilla:  { Icon: Box,        bg: "bg-slate-700/50",   border: "border-slate-600/30",   iconCls: "text-slate-400" },
};

const FALLBACK: EngineStyle = {
  Icon: Server,
  bg: "bg-slate-700/50",
  border: "border-slate-600/30",
  iconCls: "text-slate-400",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ServerIcon({
  location,
  engine,
  size = 64,
  editable = false,
  className,
}: {
  location: string;
  engine: string;
  size?: number;
  editable?: boolean;
  className?: string;
}) {
  const queryClient = useQueryClient();

  const { data: iconSrc } = useQuery({
    queryKey: ["server-icon", location],
    queryFn: () => invoke<string | null>("get_server_icon", { location }),
    staleTime: Infinity,
  });

  const { Icon, bg, border, iconCls } =
    ENGINE_STYLES[engine.toLowerCase()] ?? FALLBACK;

  const handleClick = async () => {
    if (!editable) return;
    const selected = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (!selected || typeof selected !== "string") return;
    try {
      await invoke("set_server_icon", { location, sourcePath: selected });
      queryClient.invalidateQueries({ queryKey: ["server-icon", location] });
    } catch (e) {
      console.error("Failed to set server icon:", e);
    }
  };

  const iconSize = Math.round(size * 0.44);

  return (
    <div
      style={{ width: size, height: size }}
      title={editable ? "Click to change icon" : undefined}
      onClick={handleClick}
      className={cn(
        "rounded-2xl overflow-hidden flex items-center justify-center shrink-0 relative border transition-all",
        !iconSrc && bg,
        !iconSrc && border,
        editable && "cursor-pointer group",
        className,
      )}
    >
      {iconSrc ? (
        <img
          src={iconSrc}
          alt="Server icon"
          className="w-full h-full object-cover"
          style={{ imageRendering: "pixelated" }}
          draggable={false}
        />
      ) : (
        <Icon size={iconSize} className={iconCls} />
      )}

      {/* Editable hover overlay */}
      {editable && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
          <Camera size={Math.round(iconSize * 0.8)} className="text-white" />
          <span className="text-white text-[9px] font-semibold tracking-wide uppercase">
            Change
          </span>
        </div>
      )}
    </div>
  );
}
