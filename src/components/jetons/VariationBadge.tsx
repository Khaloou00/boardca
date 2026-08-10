import { ArrowUp, ArrowDown, Minus } from "lucide-react";

// Badge de variation façon ticker financier : ▲ vert / ▼ rouge / — gris (null).
export function VariationBadge({
  pct,
  label = "vs session précédente",
}: {
  pct: number | null;
  label?: string;
}) {
  if (pct === null || pct === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-mono text-slate-400 tabular-nums">
        <Minus className="h-3.5 w-3.5" /> — <span className="text-slate-500">{label}</span>
      </span>
    );
  }
  const up = pct > 0;
  const flat = pct === 0;
  const color = flat ? "text-slate-300" : up ? "text-[#16C784]" : "text-[#EA3943]";
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-mono tabular-nums ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : ""}
      {pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%
      <span className="text-slate-500">{label}</span>
    </span>
  );
}
