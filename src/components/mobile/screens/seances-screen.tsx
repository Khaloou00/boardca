// Liste de toutes les séances du Conseil. Extrait de `admin-app.tsx` :
// composant de premier niveau, plus de remontage à chaque rendu du parent.
import { Calendar, MapPin } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { TopBar } from "../shared/ui-components";
import type { Nav } from "../shared/view-state";

export function SeancesScreen({ nav }: { nav: Nav }) {
  const realReunions = useBoardStore((s) => s.reunions);
  const seances = [...realReunions].sort((a, b) => b.date.localeCompare(a.date));
  const STATUT: Record<string, { label: string; cls: string }> = {
    planifiee: { label: "Planifiée", cls: "bg-sky-100 text-sky-700" },
    en_cours: { label: "En cours", cls: "bg-amber-100 text-amber-700" },
    terminee: { label: "Terminée", cls: "bg-emerald-100 text-emerald-700" },
  };
  const TYPE: Record<string, string> = {
    ca_ordinaire: "Ordinaire",
    ca_extraordinaire: "Extraordinaire",
    comite: "Comité",
  };
  return (
    <div className="bg-[#F8FAFC] min-h-full">
      <TopBar title="Séances du Conseil" onBack={() => nav({ tab: "profile" })} />
      <div className="px-5 py-4 space-y-3">
        {seances.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-navy">Aucune séance</div>
            <div className="text-xs text-slate-500 max-w-[240px]">
              Les séances du Conseil apparaîtront ici dès leur planification.
            </div>
          </div>
        ) : (
          seances.map((r) => {
            const st = STATUT[r.statut] ?? {
              label: r.statut,
              cls: "bg-slate-100 text-slate-600",
            };
            return (
              <div
                key={r.id}
                className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm flex gap-3"
              >
                <div className="rounded-xl bg-navy text-gold px-3 py-2 text-center min-w-[58px] h-fit">
                  <div className="text-[9px] uppercase">
                    {new Date(r.date).toLocaleDateString("fr-FR", { month: "short" })}
                  </div>
                  <div className="text-xl font-bold leading-none">{new Date(r.date).getDate()}</div>
                  <div className="text-[9px] mt-0.5">{r.heure ?? ""}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-navy text-sm">{r.titre}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {r.lieu ?? "Lieu à définir"}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {TYPE[r.type] ?? r.type}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${st.cls}`}
                    >
                      {st.label}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {r.ordreDuJour.length} point(s)
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
