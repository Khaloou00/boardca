// Tuiles KPI en dégradé, langage visuel commun au tableau de bord Super Admin,
// aux Archives et aux panneaux de gouvernance. Une seule définition pour tous.

export interface Tuile {
  label: string;
  valeur: string | number;
  hint?: string;
  ton?: "navy" | "emerald" | "gold" | "rose" | "slate";
}

const TON: Record<NonNullable<Tuile["ton"]>, string> = {
  navy: "from-navy to-navy-light",
  emerald: "from-emerald-600 to-emerald-700",
  gold: "from-gold to-yellow-600",
  rose: "from-rose-600 to-rose-700",
  slate: "from-slate-600 to-slate-800",
};

export function KpiTiles({ tuiles }: { tuiles: Tuile[] }) {
  if (tuiles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tuiles.map((t) => (
        <div
          key={t.label}
          className={`rounded-2xl p-5 bg-gradient-to-br ${TON[t.ton ?? "navy"]} text-white shadow-lg`}
        >
          <div className="text-3xl font-bold font-mono tabular-nums">{t.valeur}</div>
          <div className="text-sm opacity-90 mt-1.5">{t.label}</div>
          {t.hint && <div className="text-[13px] opacity-60 mt-1">{t.hint}</div>}
        </div>
      ))}
    </div>
  );
}
