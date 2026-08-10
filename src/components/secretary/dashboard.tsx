import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { Plus, ArrowRight, MapPin, ListChecks, Clock } from "lucide-react";
import { ReunionStatsPanel } from "@/components/kpis-gouvernance/ReunionStatsPanel";
import { datePartsFr, typeMeta, statutMeta } from "@/lib/reunion-visuals";

export function SecretaryDashboard({
  onOpenMeeting,
  onNew,
}: {
  onOpenMeeting: (id: string) => void;
  onNew: () => void;
}) {
  const reunions = useBoardStore(useShallow((s) => s.reunions));
  const upcoming = reunions.filter((r) => r.statut !== "terminee");

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">Espace Secrétariat</div>
          <h1 className="text-3xl font-bold text-navy mt-1">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pilotez chaque réunion du Conseil, de la préparation à l'archivage.
          </p>
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 rounded-lg bg-gold text-gold-foreground px-4 py-2.5 font-semibold hover:brightness-110 transition"
        >
          <Plus className="h-4 w-4" /> Nouvelle réunion
        </button>
      </div>

      <ReunionStatsPanel />

      <section>
        <h2 className="text-lg font-semibold text-navy mb-3">Prochaines réunions</h2>
        <div className="space-y-3">
          {upcoming.map((r) => {
            const ty = typeMeta(r.type);
            const st = statutMeta(r.statut);
            const p = datePartsFr(r.date);
            return (
              <button
                key={r.id}
                onClick={() => onOpenMeeting(r.id)}
                className={`group relative w-full overflow-hidden text-left rounded-2xl bg-card border border-border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-gold flex items-center gap-5 ${ty.halo}`}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: ty.couleur }}
                  aria-hidden="true"
                />
                <div
                  className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${ty.tuile}`}
                >
                  <span className="text-2xl font-bold leading-none tabular-nums">{p.jour}</span>
                  <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide opacity-90">
                    {p.mois}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ${ty.chip}`}
                    >
                      {ty.label}
                    </span>
                    {st && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wider ${st.chip}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${st.pastille}`}
                          aria-hidden="true"
                        />
                        {st.label}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 font-bold text-navy truncate">{r.titre}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> {r.heure ?? "Heure à définir"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{r.lieu ?? "Lieu à définir"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ListChecks className="h-3.5 w-3.5" /> {r.ordreDuJour.length} point(s)
                    </span>
                  </div>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all group-hover:bg-navy group-hover:text-gold">
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
          {upcoming.length === 0 && (
            <div className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-10 text-center">
              Aucune réunion planifiée.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
