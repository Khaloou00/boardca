import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Coins } from "lucide-react";
import { useMesJetons } from "@/hooks/useMesJetons";
import { formatFCFA } from "@/lib/utils";
import type { PointSerieJeton } from "@/types/jetons";
import { VariationBadge } from "./VariationBadge";
import { SparklineChart } from "./SparklineChart";
import { EvolutionCumulChart } from "./EvolutionCumulChart";
import { SessionHistoryRow } from "./SessionHistoryRow";

const PERIODES = [
  { k: "3M", label: "3M", mois: 3 },
  { k: "6M", label: "6M", mois: 6 },
  { k: "1AN", label: "1AN", mois: 12 },
  { k: "TOUT", label: "TOUT", mois: null },
] as const;

// Écran « terminal de trading » — fond sombre volontaire (signal donnée financière
// personnelle), distinct de la palette or/navy du reste de l'app.
export function MesJetonsScreen({ onBack }: { onBack: () => void }) {
  const { data, loading } = useMesJetons();
  const [periode, setPeriode] = useState<(typeof PERIODES)[number]["k"]>("TOUT");

  const serieFiltree = useMemo<PointSerieJeton[]>(() => {
    if (!data) return [];
    const p = PERIODES.find((x) => x.k === periode);
    if (!p?.mois) return data.serie;
    const seuil = new Date();
    seuil.setMonth(seuil.getMonth() - p.mois);
    return data.serie.filter((s) => new Date(s.date) >= seuil);
  }, [data, periode]);

  const annee = new Date().getFullYear();

  return (
    <div className="min-h-full text-white" style={{ background: "#0D1B3E" }}>
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-white/10 backdrop-blur"
        style={{ background: "rgba(13,27,62,0.9)" }}>
        <button onClick={onBack} aria-label="Retour" className="text-white/80 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 font-semibold">Mes jetons de présence</div>
        <Coins className="h-5 w-5 text-[#16C784]" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
          <div className="text-xs">Chargement…</div>
        </div>
      ) : !data || data.serie.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="px-4 py-4 space-y-4">
          {/* Carte total cumulé */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              Total cumulé {annee}
            </div>
            <div className="mt-1.5 font-mono tabular-nums text-[32px] font-bold leading-none">
              {formatFCFA(data.totaux.totalDu)}
            </div>
            <div className="mt-2">
              <VariationBadge pct={data.variationDernierePct} />
            </div>
            <div className="mt-3">
              <SparklineChart values={data.serie.filter((s) => s.mode !== "absent").map((s) => s.cumule)} />
            </div>
          </div>

          {/* 3 stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Sessions" value={String(data.totaux.nbSessions)} />
            <StatCard label="Moyenne" value={formatFCFA(data.totaux.moyenneParSession)} sub />
            <StatCard label="En attente" value={formatFCFA(data.totaux.totalEnAttente)} sub />
          </div>

          {/* Courbe cumulative + toggle période */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">
                Évolution — cumul
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
                {PERIODES.map((p) => (
                  <button
                    key={p.k}
                    onClick={() => setPeriode(p.k)}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold transition ${
                      periode === p.k ? "bg-[#16C784] text-[#062017]" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <EvolutionCumulChart serie={serieFiltree} />
          </div>

          {/* Historique (tous statuts, plus récent en premier) */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-4 py-2.5 text-[11px] uppercase tracking-[0.15em] text-white/60 border-b border-white/10">
              Historique des sessions
            </div>
            {[...data.serie].reverse().map((p) => (
              <SessionHistoryRow key={p.reunionId} p={p} />
            ))}
          </div>

          <p className="text-[10px] text-white/30 text-center pt-1 pb-4">
            Montants indicatifs · jetons figés à la clôture de chaque séance.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[9px] uppercase tracking-wider text-white/45">{label}</div>
      <div className={`mt-1 font-mono tabular-nums font-semibold ${sub ? "text-[13px]" : "text-xl"}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 px-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center">
        <Coins className="h-7 w-7 text-white/40" />
      </div>
      <div className="text-sm text-white/70">Aucun jeton de présence enregistré pour le moment.</div>
      <div className="text-[12px] text-white/40 max-w-xs">
        Les jetons apparaissent après la clôture de votre première session au CA.
      </div>
    </div>
  );
}
