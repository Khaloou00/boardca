// PCAScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState, useEffect } from "react";
import { type Signature } from "../shared/signature-pad";
import { TopBar } from "../shared/ui-components";
import { fetchDiscussions } from "@/lib/discussions";
import { type PV } from "@/types/domain";
import { ChevronRight, Crown, FileSignature, MessageSquare } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
export function PCAScreen({ nav }: { nav: (v: View) => void }) {
  const {
    canSeal,
    delegateUser,
    mySignatureReal,
    pcaConvocation,
    profile,
    pvSealed,
    signatures,
    waitingToSeal,
  } = useMobileSession();

  const [discussionsTotal, setDiscussionsTotal] = useState<number | null>(null);
  const [discussionsOuvertes, setDiscussionsOuvertes] = useState<number | null>(null);

  useEffect(() => {
    fetchDiscussions().then((list) => {
      setDiscussionsTotal(list.length);
      setDiscussionsOuvertes(list.filter((d) => d.statut === "ouverte").length);
    });
  }, []);

  const presidenceLabel =
    !pcaConvocation || pcaConvocation.statut !== "excused"
      ? "Vous présidez cette séance"
      : delegateUser
        ? `Déléguée à ${delegateUser.nom}`
        : "Excusé — aucun délégué désigné";

  const pvStatusLabel = pvSealed
    ? "PV scellé"
    : mySignatureReal
      ? "Votre signature est apposée"
      : canSeal
        ? "Vous pouvez sceller le PV"
        : waitingToSeal
          ? "En attente des signatures des membres"
          : "PV pas encore envoyé pour signature";

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-6">
      <TopBar title="Espace PCA" onBack={() => nav({ tab: "home" })} />
      <div className="px-5 py-4 space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-navy to-navy-light text-white p-5">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-gold" />
            <div className="text-sm font-semibold">Président du Conseil d'Administration</div>
          </div>
          <div className="mt-1 text-xs text-white/70">
            {profile?.nom} — en plus de vos droits de membre du CA, vous disposez des actions
            ci-dessous.
          </div>
        </div>

        <button
          onClick={() => nav({ tab: "discussions" })}
          className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 shadow-sm active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-navy font-semibold text-sm">
              <MessageSquare className="h-4 w-4 text-gold" /> Discussions du CA
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {discussionsOuvertes === null
              ? "Chargement…"
              : `${discussionsOuvertes} ouverte(s) sur ${discussionsTotal ?? 0}`}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Créer une discussion, échanger avec les membres du CA, la clôturer.
          </div>
        </button>

        <button
          onClick={() => nav({ tab: "home", sub: "convocation" })}
          className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 shadow-sm active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-navy font-semibold text-sm">
              <Crown className="h-4 w-4 text-gold" /> Présidence de séance
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </div>
          <div className="mt-1 text-xs text-slate-500">{presidenceLabel}</div>
          <div className="mt-2 text-[11px] text-slate-400">
            Si vous ne pouvez pas assister à une séance, déléguez la présidence à un
            administrateur ayant confirmé sa présence.
          </div>
        </button>

        <button
          onClick={() => nav({ tab: "home", sub: "pv" })}
          className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 shadow-sm active:scale-[0.98] transition"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-navy font-semibold text-sm">
              <FileSignature className="h-4 w-4 text-gold" /> Signature finale du PV
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </div>
          <div className="mt-1 text-xs text-slate-500">{pvStatusLabel}</div>
          <div className="mt-2 text-[11px] text-slate-400">
            Votre signature scelle définitivement le PV une fois tous les autres présents signés.
          </div>
        </button>
      </div>
    </div>
  );
}
