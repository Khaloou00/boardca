// VoteScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState } from "react";
import { BigVoteBtn } from "../shared/big-vote-btn";
import { TopBar } from "../shared/ui-components";
import { type View } from "../shared/view-state";
import { VoteResultScreen } from "./vote-result-screen";
import { CheckCircle2, CircleDot, Fingerprint, MinusCircle, UserCheck, Vote as VoteIcon, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useMobileSession } from "../shared/mobile-session";

export function VoteScreen({ nav, sub, data }: { nav: (v: View) => void; sub?: string; data?: any }) {
  const {
    castBulletin,
    isGuest,
    mandantPour,
    mesDelegations,
    profile,
    realUsersById,
    realVotes,
    requireOnline,
    seanceEnCours,
  } = useMobileSession();

  const openVotes = realVotes.filter((v) => v.statut === "ouvert");
  const [confirming, setConfirming] = useState<{
    id: string;
    choice: "oui" | "non" | "abstention";
  } | null>(null);
  // « Déjà voté » doit se lire pour le membre représenté, pas le compte
  // invité lui-même — sinon les boutons resteraient affichés après un vote
  // par procuration réussi (le bulletin est bien là, juste sous un autre id).
  // L'identité se résout sur la réunion DU SCRUTIN : `seanceEnCours` peut être
  // absente (séance pas encore démarrée) ou pointer une autre réunion, et le
  // repli sur l'id de l'invité faisait alors déposer le bulletin sous son
  // propre compte — rejeté par la policy `bulletins_insert_by_guest`, d'où le
  // faux message « Vote déjà enregistré ou scrutin clos ».
  const identitePourVote = (reunionId?: string) =>
    isGuest ? mandantPour(reunionId) : profile?.id;

  if (sub === "result" && data)
    return <VoteResultScreen voteId={data.id} onBack={() => nav({ tab: "vote" })} />;

  const confirm = async () => {
    if (!confirming || !profile) return;
    if (!requireOnline("Vote")) return;
    const c = confirming;
    const scrutin = openVotes.find((v) => v.id === c.id);
    const votant = identitePourVote(scrutin?.reunionId);
    if (!votant) {
      toast.error("Aucun mandat actif pour cette séance : vous ne pouvez pas voter.");
      setConfirming(null);
      return;
    }
    try {
      await castBulletin(c.id, votant, c.choice);
      setConfirming(null);
      nav({ tab: "vote", sub: "result", data: c });
    } catch (e: any) {
      // Remonter le message serveur (procuration, scrutin clos, doublon) plutôt
      // qu'un texte générique qui masquait la vraie cause.
      toast.error(e?.message ?? "Vote déjà enregistré ou scrutin clos");
      setConfirming(null);
    }
  };

  if (openVotes.length === 0) {
    return (
      <div>
        <TopBar title="Votes" />
        <div className="px-5 py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center">
            <VoteIcon className="h-7 w-7 text-slate-400" />
          </div>
          <div className="mt-4 font-semibold text-navy">Aucun scrutin ouvert</div>
          <div className="text-sm text-slate-500 mt-1">
            Le secrétaire n'a pas encore lancé de vote.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Scrutin en cours" />
      <div className="px-5 py-4 space-y-4">
        {openVotes.map((v) => {
          const votant = identitePourVote(v.reunionId);
          const already = votant
            ? v.bulletins.find((b) => b.userId === votant)?.choix
            : undefined;
          // Invité sans mandat actif sur la réunion de ce scrutin : il ne vote pas.
          const sansMandat = isGuest && !votant;
          // Membre représenté pour CETTE séance : le droit de vote est passé
          // à son mandataire (garde équivalent côté serveur, trigger
          // `trg_bulletin_refuse_si_represente`).
          const delegation = !isGuest
            ? mesDelegations.find((d) => d.reunionId === v.reunionId)
            : undefined;
          const mandataire = delegation
            ? (realUsersById[delegation.versUserId]?.nom ?? "votre mandataire")
            : null;
          return (
            <div key={v.id} className="bg-white rounded-2xl p-5 border border-slate-100">
              <div className="text-[10px] uppercase tracking-widest text-gold font-bold flex items-center gap-1">
                <CircleDot className="h-3 w-3 animate-pulse" /> Scrutin ouvert
              </div>
              <div className="text-navy font-bold text-lg mt-1">{v.intitule}</div>
              <div className="text-xs text-slate-500 mt-1">
                Vote secret · signature biométrique requise
              </div>
              {sansMandat ? (
                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 text-[12px] text-slate-600">
                  Vous n'avez pas de mandat actif pour cette séance : vous ne pouvez pas y voter.
                </div>
              ) : delegation ? (
                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2">
                  <UserCheck className="h-5 w-5 text-slate-500 shrink-0" />
                  <div className="text-[12px] text-slate-600">
                    Vous êtes représenté par <span className="font-semibold">{mandataire}</span>{" "}
                    pour cette séance : c'est votre mandataire qui vote en votre nom.
                  </div>
                </div>
              ) : already ? (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div className="text-sm font-semibold text-emerald-800">
                      Vote « {already} » enregistré
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      nav({ tab: "vote", sub: "result", data: { id: v.id, choice: already } })
                    }
                    className="mt-2 w-full py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-[12px] font-semibold"
                  >
                    Voir les résultats
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <BigVoteBtn
                    label="OUI"
                    color="emerald"
                    icon={CheckCircle2}
                    onClick={() => setConfirming({ id: v.id, choice: "oui" })}
                  />
                  <BigVoteBtn
                    label="NON"
                    color="red"
                    icon={XCircle}
                    onClick={() => setConfirming({ id: v.id, choice: "non" })}
                  />
                  <BigVoteBtn
                    label="ABSTENIR"
                    color="slate"
                    icon={MinusCircle}
                    onClick={() => setConfirming({ id: v.id, choice: "abstention" })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirming && (
        <div
          className="absolute inset-0 bg-black/60 z-50 flex items-end"
          onClick={() => setConfirming(null)}
        >
          <div
            className="bg-white w-full rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-12 bg-slate-300 rounded-full mx-auto mb-4" />
            <div className="text-center">
              <div className="h-20 w-20 rounded-full bg-navy/10 mx-auto flex items-center justify-center">
                <Fingerprint className="h-10 w-10 text-navy animate-pulse" />
              </div>
              <div className="mt-4 font-bold text-navy">Confirmer votre vote</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Ce vote est définitif après confirmation.
              </div>
              <div className="text-sm text-slate-600 mt-2">
                Choix : <span className="font-bold uppercase text-navy">{confirming.choice}</span>
              </div>
              <button
                onClick={confirm}
                className="mt-6 w-full bg-navy text-white rounded-xl py-3.5 font-semibold"
              >
                Valider avec biométrie
              </button>
              <button
                onClick={() => setConfirming(null)}
                className="mt-2 w-full text-slate-500 py-2 text-sm"
              >
                Réviser mon vote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
