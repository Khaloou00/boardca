// BoardBookListScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState, useEffect } from "react";
import { TopBar } from "../shared/ui-components";
import { supabase } from "@/lib/supabase";
import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
export function BoardBookListScreen({ nav }: { nav: (v: View) => void }) {
  const {
    realReunions,
    reunionsPourEcrans,
  } = useMobileSession();

  const [recueils, setRecueils] = useState<
    Record<string, { pages: number | null; pret: boolean }>
  >({});
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const charger = () =>
      supabase
        .from("board_books")
        .select("reunion_id, pages, genere_at")
        .then(({ data }) => {
          if (cancelled) return;
          setRecueils(
            Object.fromEntries(
              ((data ?? []) as any[]).map((b) => [
                b.reunion_id,
                { pages: b.pages, pret: !!b.genere_at },
              ]),
            ),
          );
          setChargement(false);
        });
    charger();
    // Le recueil compilé par le secrétariat doit apparaître sans rechargement.
    const canal = supabase
      .channel("boardca:bb:liste")
      .on("postgres_changes", { event: "*", schema: "public", table: "board_books" }, () =>
        charger(),
      )
      // Resynchro sur reconnexion : voir src/lib/notifications.ts.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") charger();
      });
    return () => {
      cancelled = true;
      supabase.removeChannel(canal);
    };
  }, []);

  // Un invité ne voit que le(s) Board Book(s) de la réunion où il est mandaté
  // — `reunionsPourEcrans` vaut `realReunions` pour tous les autres rôles.
  const seances = [...reunionsPourEcrans].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-20">
      <TopBar title="Board Book" />
      <div className="px-5 py-4 space-y-3">
        {chargement ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : seances.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-navy">Aucune séance</div>
            <div className="text-xs text-slate-500 max-w-[240px]">
              Les Board Books apparaîtront ici, un dossier par séance.
            </div>
          </div>
        ) : (
          seances.map((r) => {
            const info = recueils[r.id];
            const d = new Date(`${r.date}T12:00:00`);
            return (
              <button
                key={r.id}
                onClick={() =>
                  nav({ tab: "boardbook", sub: "reunion", data: { reunionId: r.id } })
                }
                className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 shadow-sm flex gap-3 active:scale-[0.99] transition"
              >
                <div className="rounded-xl bg-navy text-gold px-3 py-2 text-center min-w-[58px] h-fit">
                  <div className="text-[9px] uppercase">
                    {d.toLocaleDateString("fr-FR", { month: "short" })}
                  </div>
                  <div className="text-xl font-bold leading-none">{d.getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-navy text-sm truncate">{r.titre}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {r.ordreDuJour.length} point(s) à l'ordre du jour
                  </div>
                  <div className="mt-2">
                    <span
                      className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
                        info?.pret
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {info?.pret ? "Recueil disponible" : "En préparation"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 self-center" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
