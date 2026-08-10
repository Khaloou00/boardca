// ConsultationsScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState } from "react";
import { TopBar } from "../shared/ui-components";
import { decompte, echue, peutRepondre, repondreConsultation, type Choix as ChoixConsultation, type Consultation } from "@/lib/consultations";
import { Clock, Gavel, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
export function ConsultationsScreen({ nav }: { nav: (v: View) => void }) {
  const {
    consultations,
    profile,
    rechargerConsultations,
    requireOnline,
  } = useMobileSession();

  const [envoi, setEnvoi] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [motivation, setMotivation] = useState("");

  const repondre = async (c: Consultation, choix: ChoixConsultation) => {
    if (!profile || !requireOnline("Réponse à la consultation")) return;
    setEnvoi(c.id);
    try {
      await repondreConsultation(c.id, profile.id, choix, motivation);
      toast.success("Réponse enregistrée", { description: "Elle est définitive." });
      setOuvert(null);
      setMotivation("");
      rechargerConsultations();
    } catch (e: any) {
      toast.error("Réponse refusée", { description: e?.message });
    } finally {
      setEnvoi(null);
    }
  };

  const CHOIX: { valeur: ChoixConsultation; label: string; cls: string }[] = [
    { valeur: "oui", label: "Pour", cls: "bg-emerald-500" },
    { valeur: "non", label: "Contre", cls: "bg-rose-500" },
    { valeur: "abstention", label: "Abstention", cls: "bg-slate-400" },
  ];

  return (
    <div className="bg-[#F8FAFC] min-h-full">
      <TopBar title="Consultation écrite" onBack={() => nav({ tab: "profile" })} />

      {consultations.length === 0 ? (
        <div className="py-16 flex flex-col items-center text-center gap-3 px-8">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <MailCheck className="h-6 w-6 text-slate-400" />
          </div>
          <div className="text-sm font-semibold text-navy">Aucune consultation</div>
          <div className="text-xs text-slate-500 max-w-[250px]">
            Les décisions prises hors séance apparaîtront ici dès leur ouverture par le
            secrétariat.
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {consultations.map((c) => {
            const { oui, non, abstention, total } = decompte(c);
            const maReponse = c.reponses.find((r) => r.userId === profile?.id);
            const repondable = peutRepondre(c) && !maReponse;
            const close = c.statut === "close";
            const jours = Math.ceil(
              (new Date(c.deadline).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000,
            );

            return (
              <div
                key={c.id}
                className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {close ? (
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${c.resultat === "adoptee" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                    >
                      <Gavel className="h-2.5 w-2.5" />
                      {c.resultat === "adoptee" ? "Adoptée" : "Rejetée"}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${echue(c) ? "bg-rose-100 text-rose-700" : "bg-gold/15 text-gold"}`}
                    >
                      <Clock className="h-2.5 w-2.5" />
                      {echue(c)
                        ? "Délai expiré"
                        : jours === 0
                          ? "Dernier jour"
                          : `${jours} j restants`}
                    </span>
                  )}
                  {maReponse && (
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-navy/10 text-navy">
                      Vous avez voté : {maReponse.choix}
                    </span>
                  )}
                </div>

                <div className="mt-2 font-bold text-sm text-navy">{c.question}</div>
                {c.contexte && (
                  <div className="mt-1 text-[11px] text-slate-500">{c.contexte}</div>
                )}

                {/* Dépouillement : visible de tous (RLS `cons_rep_read_auth`). */}
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-600 font-semibold">{oui} pour</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-rose-600 font-semibold">{non} contre</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500 font-semibold">{abstention} abst.</span>
                  <span className="ml-auto text-slate-400">{total} réponse(s)</span>
                </div>

                {repondable ? (
                  ouvert === c.id ? (
                    <div className="mt-3 space-y-2">
                      <input
                        value={motivation}
                        onChange={(e) => setMotivation(e.target.value)}
                        placeholder="Motivation (facultative)"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-gold"
                      />
                      <div className="flex gap-1.5">
                        {CHOIX.map((ch) => (
                          <button
                            key={ch.valeur}
                            disabled={envoi === c.id}
                            onClick={() => repondre(c, ch.valeur)}
                            className={`flex-1 rounded-lg py-2.5 text-[11px] font-bold text-white active:scale-95 disabled:opacity-50 ${ch.cls}`}
                          >
                            {envoi === c.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                            ) : (
                              ch.label
                            )}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setOuvert(null)}
                        className="w-full text-[11px] text-slate-400 py-1"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setOuvert(c.id);
                        setMotivation("");
                      }}
                      className="mt-3 w-full rounded-xl bg-navy text-white py-2.5 text-[12px] font-semibold active:scale-[0.98]"
                    >
                      Donner ma réponse
                    </button>
                  )
                ) : (
                  !maReponse && (
                    <div className="mt-3 text-[11px] text-slate-400 text-center py-1.5">
                      {close ? "Consultation clôturée." : "Le délai de réponse est expiré."}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
