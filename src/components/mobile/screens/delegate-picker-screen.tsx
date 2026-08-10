// DelegatePickerScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState } from "react";
import { TopBar } from "../shared/ui-components";
import { ROLE_LABELS } from "@/lib/role-labels";
import { type PV } from "@/types/domain";
import { CheckCircle2, Clock, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
export function DelegatePickerScreen({ nav }: { nav: (v: View) => void }) {
  const {
    confirmConvocation,
    confirmedCandidates,
    convocationReunionId,
    convocationsReady,
    delegatePresidentSeance,
    profile,
    requireOnline,
  } = useMobileSession();

  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const excuseOnly = async () => {
    if (!requireOnline("Excuse") || !profile) return;
    setBusy(true);
    try {
      await confirmConvocation(convocationReunionId!, profile.id, "excused");
      toast.success("Excuse enregistrée sans délégation", {
        description: "Revenez déléguer dès qu'un administrateur aura confirmé sa présence.",
      });
      nav({ tab: "home", sub: "convocation" });
    } catch {
      toast.error("Échec de l'excuse");
    } finally {
      setBusy(false);
    }
  };

  const delegate = async () => {
    if (!requireOnline("Délégation de présidence") || !selected) return;
    setBusy(true);
    try {
      await delegatePresidentSeance(convocationReunionId!, selected);
      toast.success("Présidence déléguée", {
        description:
          "Vous êtes excusé ; le délégué présidera et scellera le PV en votre absence.",
      });
      nav({ tab: "home", sub: "convocation" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la délégation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TopBar
        title="Déléguer la présidence"
        onBack={() => nav({ tab: "home", sub: "convocation" })}
      />
      <div className="px-5 py-4">
        {!convocationsReady ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-10">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
          </div>
        ) : confirmedCandidates.length === 0 ? (
          <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 text-center">
            <Clock className="h-6 w-6 text-slate-400 mx-auto" />
            <div className="mt-2 text-[12px] text-slate-600">
              Aucun administrateur n'a encore confirmé sa présence — réessayez plus tard.
            </div>
            <button
              onClick={excuseOnly}
              disabled={busy}
              className="mt-4 w-full bg-white border border-slate-300 text-navy rounded-xl py-3 font-semibold text-sm disabled:opacity-60"
            >
              M'excuser sans déléguer maintenant
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm">
              <div className="text-[11px] text-slate-500">
                Choisissez un administrateur ayant confirmé sa présence : il présidera et scellera
                le PV en votre absence.
              </div>
              <div className="mt-3 space-y-1.5">
                {confirmedCandidates.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border flex items-center gap-3 transition ${selected === u.id ? "border-gold bg-gold/5" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="h-8 w-8 rounded-full bg-navy text-gold flex items-center justify-center text-[11px] font-bold">
                      {u.initiales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-navy">{u.nom}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {u.qualite ?? ROLE_LABELS[u.role].label}
                      </div>
                    </div>
                    {selected === u.id && <CheckCircle2 className="h-4 w-4 text-gold" />}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={delegate}
              disabled={busy || !selected}
              className="mt-4 w-full bg-gradient-to-r from-gold to-yellow-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
            >
              <Crown className="h-5 w-5" /> Déléguer la présidence
            </button>
          </>
        )}
      </div>
    </div>
  );
}
