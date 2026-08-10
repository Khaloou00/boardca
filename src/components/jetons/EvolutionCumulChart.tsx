import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PointSerieJeton } from "@/types/jetons";
import { formatFCFA, formatFCFACompact, formatDateCourt } from "@/lib/utils";

// Courbe cumulative (thème sombre « trading »). Les points 'absent' (montant 0)
// sont exclus en amont — ils aplatiraient la courbe sans intérêt.
export function EvolutionCumulChart({ serie }: { serie: PointSerieJeton[] }) {
  const data = serie
    .filter((p) => p.mode !== "absent")
    .map((p) => ({ date: formatDateCourt(p.date), cumule: p.cumule, montant: p.montant, titre: p.titre }));

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[13px] text-slate-500">
        Pas encore de session rémunérée.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="cumul-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16C784" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#16C784" stopOpacity="0" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={54}
          tickFormatter={(v) => formatFCFACompact(v).replace(" FCFA", "")}
        />
        <Tooltip
          contentStyle={{
            background: "#0A1533",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelStyle={{ color: "#fff", fontWeight: 600 }}
          formatter={(_v, _n, item: any) => {
            const p = item?.payload;
            return [
              `${p?.titre} · +${formatFCFA(p?.montant)} · cumul ${formatFCFA(p?.cumule)}`,
              "",
            ];
          }}
        />
        <Area
          type="monotone"
          dataKey="cumule"
          stroke="#16C784"
          strokeWidth={2}
          fill="url(#cumul-fill)"
          dot={{ r: 2.5, fill: "#16C784" }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
