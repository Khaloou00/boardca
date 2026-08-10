// VoteResultScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useMemo } from "react";
import { ResultBar } from "../shared/result-bar";
import { TopBar } from "../shared/ui-components";
import { voteTally } from "@/store/selectors";
import { BadgeCheck, CheckCircle2, Lock, Vote as VoteIcon } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";

export function VoteResultScreen({ voteId, onBack }: { voteId: string; onBack: () => void }) {
  const {
    isGuest,
    mandantPour,
    profile,
    realProcurations,
    realUsersById,
    realVotes,
  } = useMobileSession();

  const v = realVotes.find((x) => x.id === voteId);
  // Vote secret : tant que le scrutin est ouvert, personne (même le votant)
  // ne voit l'évolution des résultats — seule la Secrétaire les découvre à la
  // clôture, moment où tous les membres sont notifiés de la conclusion. On ne
  // calcule/affiche le décompte qu'une fois le scrutin réellement clos.
  const clos = v?.statut === "clos";
  // Décompte réel des bulletins, pondéré : un membre mandataire d'un autre
  // (procuration active) compte double — même règle que côté secrétariat et
  // que le trigger DB qui scelle le résultat officiel à la clôture.
  const tally = useMemo(() => {
    if (!v || !clos) return { oui: 0, non: 0, abs: 0 };
    const t = voteTally(v, realProcurations);
    return { oui: t.oui, non: t.non, abs: t.abs };
  }, [v, clos, realProcurations]);
  const total = tally.oui + tally.non + tally.abs;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const adopted = tally.oui > tally.non;
  const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  // Le bulletin est enregistré au nom du membre représenté : le nom affiché
  // et le choix retrouvé doivent être les siens, pas ceux du compte invité
  // connecté — identité effective, même règle que partout ailleurs dans ce
  // fichier (voir mandantPour). On dérive le choix depuis les bulletins
  // plutôt que de le recevoir en prop : cet écran est aussi atteint depuis
  // une notification de clôture, sans qu'un choix n'ait été « juste » posé.
  const identiteVote = isGuest ? (mandantPour(v?.reunionId) ?? profile?.id) : profile?.id;
  const votantNom = isGuest
    ? (realUsersById[mandantPour(v?.reunionId) ?? ""]?.nom ?? profile?.nom)
    : profile?.nom;
  const monChoix = v?.bulletins.find((b) => b.userId === identiteVote)?.choix;

  return (
    <div>
      <TopBar title={clos ? "Résultat du scrutin" : "Vote"} onBack={onBack} />
      <div className="px-5 py-4">
        <div className="text-center">
          <div
            className={`h-20 w-20 rounded-full mx-auto flex items-center justify-center animate-in zoom-in duration-500 ${monChoix ? "bg-emerald-100" : "bg-slate-100"}`}
          >
            {monChoix ? (
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            ) : (
              <VoteIcon className="h-10 w-10 text-slate-400" />
            )}
          </div>
          <div className="mt-4 text-lg font-bold text-navy">
            {monChoix ? "Vote enregistré" : (v?.intitule ?? "Scrutin")}
          </div>
          {monChoix ? (
            <>
              <div className="text-[12px] text-slate-500 mt-1">
                {votantNom} · <span className="uppercase font-semibold">{monChoix}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {new Date().toLocaleDateString("fr-FR")} · {now}
              </div>
            </>
          ) : (
            <div className="text-[12px] text-slate-500 mt-1">
              {clos ? "Vous n'avez pas voté à ce scrutin." : "Vote non encore enregistré."}
            </div>
          )}
        </div>

        {clos ? (
          <>
            <div className="mt-6 bg-white rounded-2xl p-4 border border-slate-100">
              <div className="text-[10px] uppercase tracking-widest text-gold font-bold">
                Résultats finaux
              </div>
              <div className="text-[13px] font-semibold text-navy mt-1 mb-4">
                {v?.intitule ?? "Scrutin"}
              </div>
              <ResultBar
                label="OUI"
                count={tally.oui}
                pct={pct(tally.oui)}
                color="bg-emerald-500"
              />
              <ResultBar label="NON" count={tally.non} pct={pct(tally.non)} color="bg-red-500" />
              <ResultBar
                label="ABS"
                count={tally.abs}
                pct={pct(tally.abs)}
                color="bg-slate-400"
              />
            </div>

            <div
              className={`mt-4 rounded-2xl p-4 text-center font-bold ${adopted ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}
            >
              <BadgeCheck className="h-6 w-6 mx-auto mb-1" />
              Résolution {adopted ? "ADOPTÉE" : "REJETÉE"}
            </div>
          </>
        ) : (
          <div className="mt-6 bg-white rounded-2xl p-5 border border-slate-100 text-center">
            <Lock className="h-6 w-6 text-slate-400 mx-auto mb-2" />
            <div className="text-sm font-semibold text-navy">Vote secret</div>
            <div className="text-[12px] text-slate-500 mt-1">
              Les résultats ne sont dévoilés qu'à la clôture du scrutin par la Secrétaire. Vous
              recevrez une notification avec la conclusion.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
