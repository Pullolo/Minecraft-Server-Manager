import { Activity } from "lucide-react";

export interface ResourcePoint {
  cpu_pct: number;
  ram_mb: number;
  total_ram_mb: number;
}

const MAX_POINTS = 60;
const W = 400;
const H = 64;
const PAD = 2;

function buildPath(values: number[]): string {
  if (values.length < 2) return "";
  return values
    .map((v, i) => {
      const x = PAD + (i / (MAX_POINTS - 1)) * (W - 2 * PAD);
      const y = PAD + (1 - Math.min(v, 100) / 100) * (H - 2 * PAD);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function fmtMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}G` : `${mb}M`;
}

export default function ResourceGraph({ data }: { data: ResourcePoint[] }) {
  const padded = [
    ...Array(Math.max(0, MAX_POINTS - data.length)).fill({ cpu_pct: 0, ram_mb: 0, total_ram_mb: 1 }),
    ...data,
  ];

  const cpuVals = padded.map((d) => d.cpu_pct);
  const ramVals = padded.map((d) =>
    d.total_ram_mb > 0 ? (d.ram_mb / d.total_ram_mb) * 100 : 0,
  );

  const latest = data[data.length - 1];
  const cpuNow = latest?.cpu_pct.toFixed(1) ?? "0.0";
  const ramNow = latest ? fmtMb(latest.ram_mb) : "0M";
  const ramTotal = latest ? fmtMb(latest.total_ram_mb) : "?";

  const cpuPath = buildPath(cpuVals);
  const ramPath = buildPath(ramVals);

  return (
    <div className="bg-slate-900/60 rounded-xl px-4 py-3 border border-slate-700/40">
      {/* Labels */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Activity size={12} />
          <span className="font-medium">Resources</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span>
            <span className="text-emerald-400 font-semibold">{cpuNow}%</span>
            <span className="text-slate-600 ml-1">CPU</span>
          </span>
          <span>
            <span className="text-blue-400 font-semibold">{ramNow}</span>
            <span className="text-slate-600 ml-1">/ {ramTotal} RAM</span>
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 64 }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[25, 50, 75].map((pct) => {
          const y = PAD + (1 - pct / 100) * (H - 2 * PAD);
          return (
            <line
              key={pct}
              x1={PAD}
              y1={y}
              x2={W - PAD}
              y2={y}
              stroke="rgb(51 65 85 / 0.4)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* RAM area fill */}
        {ramPath && (
          <path
            d={`${ramPath} L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`}
            fill="rgb(59 130 246 / 0.08)"
          />
        )}

        {/* CPU area fill */}
        {cpuPath && (
          <path
            d={`${cpuPath} L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`}
            fill="rgb(16 185 129 / 0.08)"
          />
        )}

        {/* RAM line */}
        {ramPath && (
          <path
            d={ramPath}
            fill="none"
            stroke="rgb(59 130 246 / 0.7)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* CPU line */}
        {cpuPath && (
          <path
            d={cpuPath}
            fill="none"
            stroke="rgb(16 185 129 / 0.85)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-emerald-400 rounded" />
          <span className="text-[10px] text-slate-500">CPU</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-400 rounded" />
          <span className="text-[10px] text-slate-500">RAM</span>
        </div>
        <span className="text-[10px] text-slate-600 ml-auto">last 3 min</span>
      </div>
    </div>
  );
}
