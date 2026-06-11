import { twMerge } from "tailwind-merge";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function engineBadgeClass(engine: string): string {
  switch (engine.toLowerCase()) {
    case "fabric":  return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
    case "forge":   return "bg-orange-500/20 text-orange-300 border border-orange-500/30";
    case "paper":   return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    case "purpur":  return "bg-purple-500/20 text-purple-300 border border-purple-500/30";
    case "spigot":  return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
    default:        return "bg-slate-700/50 text-slate-300 border border-slate-600/30";
  }
}
