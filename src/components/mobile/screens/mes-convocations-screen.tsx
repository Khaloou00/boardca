// MesConvocationsScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState, useEffect } from "react";
import { TopBar } from "../shared/ui-components";
import { supabase } from "@/lib/supabase";
import { Loader2, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
export function MesConvocationsScreen({ nav }: { nav: (v: View) => void }) {
  const {
    allConvocations,
    confirmConvocation,
    convocationReunionId,
    profile,
    requireOnline,
  } = useMobileSession();

  type Ligne = {
    reunionId: string;
    titre: string;
    date: string;
    heure: string | null;
    lieu: string | null;
    statut: string;
    reunionClose: boolean;
  };
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setChargement(true);
    supabase
      .from("convocations")
      .select("statut, reunions(id, titre, date_reunion, heure, lieu, statut)")
      .eq("user_id", profile.id)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (
          (data ?? []) as unknown as {
            statut: string;
            reunions: {
              id: string;
              titre: string;
              date_reunion: string;
              heure: string | null;
              lieu: string | null;
              statut: string;
            } | null;
          }[]
        )
          .filter((c) => !!c.reunions)
          .map((c) => ({
            reunionId: c.reunions!.id,
            titre: c.reunions!.titre,
            date: c.reunions!.date_reunion,
            heure: c.reunions!.heure?.slice(0, 5) ?? null,
            lieu: c.reunions!.lieu,
            statut: c.statut,
            reunionClose: c.reunions!.statut === "terminee",
          }))
          .sort((a, b) => b.date.localeCompare(a.date));
        setLignes(rows);
        setChargement(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, allConvocations]);

  const REPONDU: Record<string, { label: string; cls: string }> = {
    confirmed: { label: "Présence confirmée", cls: "bg-emerald-100 text-emerald-700" },
    excused: { label: "Excusé", cls: "bg-amber-100 text-amber-700" },
  };

  const [enCours, setEnCours] = useState<string | null>(null);
  const repondre = async (reunionId: string, statut: "confirmed" | "excused") => {
    if (!requireOnline("Réponse à la convocation") || !profile) return;
    setEnCours(reunionId);
    try {
      await confirmConvocation(reunionId, profile.id, statut);
      toast.success(statut === "confirmed" ? "Présence confirmée" : "Excuse enregistrée");
    } catch {
      toast.error("Enregistrement impossible");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="bg-[#F8FAFC] min-h-full">
      <TopBar title="Mes convocations" onBack={() => nav({ tab: "profile" })} />
      <div className="px-5 py-4 space-y-3">
        {chargement ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : lignes.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Send className="h-6 w-6 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-navy">Aucune convocation</div>
            <div className="text-xs text-slate-500 max-w-[240px]">
              Les convocations du Secrétariat apparaîtront ici.
            </div>
          </div>
        ) : (
          lignes.map((l) => {
            const repondu = REPONDU[l.statut];
            // L'écran de convocation détaillé (procuration, délégation de
            // présidence) ne sait traiter que la séance la plus proche. Pour
            // les autres réunions en attente, on répond directement ici —
            // sinon leur convocation resterait sans issue.
            const seanceImminente = l.reunionId === convocationReunionId;
            // Une séance clôturée ne se répond plus, quel que soit le statut.
            const repondable = !repondu && !l.reunionClose;
            const busy = enCours === l.reunionId;
            const d = new Date(`${l.date}T12:00:00`);
            return (
              <div
                key={l.reunionId}
                className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm flex gap-3"
              >
                <div className="rounded-xl bg-navy text-gold px-3 py-2 text-center min-w-[58px] h-fit">
                  <div className="text-[9px] uppercase">
                    {d.toLocaleDateString("fr-FR", { month: "short" })}
                  </div>
                  <div className="text-xl font-bold leading-none">{d.getDate()}</div>
                  <div className="text-[9px] mt-0.5">{l.heure ?? ""}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-navy text-sm">{l.titre}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{l.lieu ?? "Lieu à définir"}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
                        repondu?.cls ??
                        (l.reunionClose
                          ? "bg-slate-100 text-slate-500"
                          : "bg-sky-100 text-sky-700")
                      }`}
                    >
                      {repondu?.label ??
                        (l.reunionClose ? "Séance terminée" : "Réponse attendue")}
                    </span>
                    {repondable && busy && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                    )}
                    {repondable && !busy && seanceImminente && (
                      <button
                        onClick={() => nav({ tab: "home", sub: "convocation" })}
                        className="text-[11px] font-semibold text-navy underline"
                      >
                        Répondre
                      </button>
                    )}
                    {repondable && !busy && !seanceImminente && (
                      <>
                        <button
                          onClick={() => repondre(l.reunionId, "confirmed")}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-600 text-white"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => repondre(l.reunionId, "excused")}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-200 text-slate-600"
                        >
                          M'excuser
                        </button>
                      </>
                    )}
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
