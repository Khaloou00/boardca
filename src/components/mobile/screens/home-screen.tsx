// HomeScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { QuickAction, Stat } from "../shared/ui-components";
import { BrandLogo } from "@/components/brand-logo";
import { type PV } from "@/types/domain";
import { Bell, Calendar, CalendarDays, CheckCircle2, ChevronRight, CircleDot, Clock, Crown, FileSignature, ListChecks, MapPin, QrCode, Vote as VoteIcon, WifiOff } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
export function HomeScreen({ nav }: { nav: (v: View) => void }) {
  const {
    actionsApercu,
    canSeal,
    convocateurNom,
    convocationDismissed,
    convocationEnAttente,
    convocationRepondue,
    delegateUser,
    isGuest,
    isPCA,
    mandantPour,
    meeting,
    mesDelegations,
    myConvocation,
    mySignatureReal,
    offline,
    presenceConfirmed,
    presidentReunion,
    prochaineSeance,
    procurationSent,
    profile,
    pvAttendMonAction,
    pvSealed,
    realPresences,
    realPvs,
    realSignedCount,
    realTotalPresents,
    realUsersById,
    realVotes,
    reunionsAVenirCount,
    seanceAVenir,
    seanceEnCours,
    signatures,
    votesOuvertsCount,
  } = useMobileSession();

  // La bannière n'apparaît que si l'utilisateur a RÉELLEMENT une convocation
  // en attente pour une séance à venir.
  const showBanner =
    !!convocationEnAttente && !convocationDismissed && !presenceConfirmed && !procurationSent;
  return (
    <div className="pb-4">
      <div className="bg-gradient-to-br from-navy to-navy-light text-white px-5 pt-4 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between">
          <div>
            <BrandLogo imgClassName="h-3.5" className="mb-1.5" variant="white" />
            <div className="text-lg font-bold mt-0.5">
              Bonjour{profile?.nom ? `, ${profile.nom.split(" ")[0]}` : ""}
              {isGuest ? " invité" : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {offline && (
              <div
                aria-label="Mode hors-ligne"
                className="h-9 w-9 rounded-full flex items-center justify-center border bg-white/10 border-white/20 text-gold"
                title="Mode hors-ligne actif"
              >
                <WifiOff className="h-4 w-4" />
              </div>
            )}
            <div className="h-10 w-10 rounded-full bg-gold text-gold-foreground flex items-center justify-center font-semibold">
              {profile?.initiales ?? "?"}
            </div>
          </div>
        </div>
        {/* Un invité représente un seul membre pour une seule séance : ces
            compteurs (toutes séances confondues) n'ont pas de sens pour lui. */}
        {!isGuest && (
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat n={String(reunionsAVenirCount)} l="Réunion" />
            <Stat n={String(votesOuvertsCount)} l="Vote actif" />
            <Stat n={`${realSignedCount}/${realTotalPresents}`} l="Accords PV" />
          </div>
        )}
      </div>

      <div className="px-5 mt-5 space-y-4">
        {/* Aperçu du suivi des actions : évolution d'un coup d'œil — avancement
            moyen + répartition par état. Toute la carte ouvre le détail.
            Un invité n'a jamais d'action confiée à son propre compte : hors
            de son mandat (vote/PV/présence/Board Book), pas de sens ici. */}
        {!isGuest && (
          <button
            onClick={() => nav({ tab: "profile", sub: "actions" })}
            className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 active:scale-[0.98] transition shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
                <ListChecks className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-navy">Suivi des actions</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {actionsApercu.total === 0
                    ? "Aucune action confiée pour l'instant"
                    : actionsApercu.enRetard > 0
                      ? `${actionsApercu.enRetard} en retard · ${actionsApercu.enCours} en cours`
                      : `${actionsApercu.enCours} en cours · ${actionsApercu.terminees} terminée${actionsApercu.terminees > 1 ? "s" : ""}`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xl font-bold text-navy leading-none tabular-nums">
                  {actionsApercu.moyen}%
                </div>
                <div className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">
                  Avancement
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
            </div>

            {actionsApercu.total > 0 && (
              <>
                {/* Barre d'évolution : proportion terminé / en cours / en retard. */}
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
                  {actionsApercu.terminees > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${(actionsApercu.terminees / actionsApercu.total) * 100}%`,
                      }}
                    />
                  )}
                  {actionsApercu.enCours > 0 && (
                    <div
                      className="h-full bg-navy"
                      style={{ width: `${(actionsApercu.enCours / actionsApercu.total) * 100}%` }}
                    />
                  )}
                  {actionsApercu.enRetard > 0 && (
                    <div
                      className="h-full bg-rose-500"
                      style={{
                        width: `${(actionsApercu.enRetard / actionsApercu.total) * 100}%`,
                      }}
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Terminées{" "}
                    {actionsApercu.terminees}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-navy" /> En cours{" "}
                    {actionsApercu.enCours}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> En retard{" "}
                    {actionsApercu.enRetard}
                  </span>
                </div>
              </>
            )}
          </button>
        )}

        {isPCA && (
          <button
            onClick={() => nav({ tab: "home", sub: "pca-hub" })}
            className="w-full text-left rounded-2xl bg-gradient-to-br from-navy to-navy-light text-white p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-lg"
            aria-label="Ouvrir l'espace PCA"
          >
            <div className="h-11 w-11 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-gold font-bold">
                Président du Conseil d'Administration
              </div>
              <div className="font-bold text-sm mt-0.5">Espace PCA</div>
              <div className="text-[11px] text-white/70 mt-0.5">
                Discussions, présidence de séance, sceau du PV
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/50 shrink-0" />
          </button>
        )}

        {/* Un invité n'a pas sa propre convocation à traiter : il représente
            déjà un membre qui, lui, a répondu en déléguant. */}
        {!isGuest &&
          (isPCA
            ? // Convocation reçue par le PCA : point d'entrée où il confirme sa
              // présidence OU délègue s'il ne peut pas assister. Statut réel lu en base.
              // Comme pour un membre, elle disparaît une fois la réponse donnée.
              !!myConvocation &&
              !convocationRepondue && (
                <button
                  onClick={() => nav({ tab: "home", sub: "convocation" })}
                  className="w-full text-left rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-yellow-50 p-4 flex items-start gap-3 active:scale-[0.98] transition shadow-sm"
                  aria-label="Répondre à la convocation en tant que PCA"
                >
                  <div className="h-10 w-10 rounded-full bg-gold text-gold-foreground flex items-center justify-center shrink-0 shadow">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-gold font-bold">
                      Convocation · Présidence du CA
                    </div>
                    <div className="text-navy font-bold text-sm mt-0.5 truncate">
                      {presidentReunion?.titre ?? "Séance à venir"}
                    </div>
                    {presidentReunion && (
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {new Date(`${presidentReunion.date}T12:00:00`).toLocaleDateString(
                          "fr-FR",
                          {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          },
                        )}
                      </div>
                    )}
                    {myConvocation?.statut === "confirmed" ? (
                      <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Vous présiderez la séance
                      </div>
                    ) : myConvocation?.statut === "excused" && delegateUser ? (
                      <div className="text-[11px] text-navy font-semibold mt-1 flex items-center gap-1">
                        <Crown className="h-3 w-3 text-gold" /> Présidence déléguée à{" "}
                        {delegateUser.nom}
                      </div>
                    ) : myConvocation?.statut === "excused" ? (
                      <div className="text-[11px] text-amber-700 font-semibold mt-1">
                        Excusé · désignez un président de séance
                      </div>
                    ) : (
                      <div className="text-[11px] text-gold font-semibold mt-1.5 flex items-center gap-1">
                        À traiter : confirmer ou déléguer la présidence{" "}
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </button>
              )
            : showBanner && (
                <button
                  onClick={() => nav({ tab: "home", sub: "convocation" })}
                  className="w-full text-left rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 to-yellow-50 p-4 flex items-start gap-3 active:scale-[0.98] transition shadow-sm"
                  aria-label="Voir la nouvelle convocation"
                >
                  <div className="h-10 w-10 rounded-full bg-gold text-gold-foreground flex items-center justify-center shrink-0 shadow">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-gold font-bold">
                      Nouvelle convocation
                    </div>
                    <div className="text-navy font-bold text-sm mt-0.5 truncate">
                      {convocationEnAttente!.titre}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {new Date(`${convocationEnAttente!.date}T12:00:00`).toLocaleDateString(
                        "fr-FR",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                      {convocateurNom ? ` · Envoyée par ${convocateurNom}` : ""}
                    </div>
                    <div className="text-[11px] text-gold font-semibold mt-1.5 flex items-center gap-1">
                      Voir la convocation <ChevronRight className="h-3 w-3" />
                    </div>
                  </div>
                </button>
              ))}

        {!isGuest && !isPCA && seanceAVenir && (presenceConfirmed || procurationSent) && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="text-[12px] text-emerald-800 flex-1">
              {presenceConfirmed
                ? `Présence confirmée pour « ${seanceAVenir.titre} ».`
                : "Procuration envoyée. Un mandataire vous représentera."}
            </div>
          </div>
        )}

        {/* Émargement : uniquement quand une séance est réellement ouverte.
            Vérité serveur (realPresences), pas un drapeau local : survit au
            rechargement et se met à jour en Realtime — y compris quand
            c'est un mandataire qui scanne à ma place (voir plus bas). */}
        {seanceEnCours &&
          (() => {
            const idPresenceCible = isGuest ? mandantPour(seanceEnCours.id) : profile?.id;
            const presenceEnregistree =
              !!idPresenceCible &&
              realPresences.some(
                (p) => p.reunionId === seanceEnCours.id && p.userId === idPresenceCible,
              );
            // Un membre qui a délégué sa présence (procuration active pour
            // CETTE séance) ne scanne jamais lui-même : c'est son mandataire
            // qui le fait depuis son propre compte invité.
            const presenceDeleguee =
              !isGuest && mesDelegations.some((d) => d.reunionId === seanceEnCours.id);

            if (presenceEnregistree) {
              return (
                <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-bold text-navy">Présence enregistrée</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Réunion en cours — {seanceEnCours.titre}
                    </div>
                  </div>
                </div>
              );
            }
            if (presenceDeleguee) return null;
            return (
              <button
                onClick={() => nav({ tab: "home", sub: "scan" })}
                className="w-full bg-gradient-to-r from-gold to-yellow-600 text-white rounded-2xl p-4 flex items-center gap-3 shadow-lg active:scale-[0.98] transition"
              >
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <QrCode className="h-6 w-6" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold">Confirmer ma présence</div>
                  <div className="text-[11px] opacity-90 truncate">
                    Séance en cours — {seanceEnCours.titre}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5" />
              </button>
            );
          })()}

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Prochaine séance
          </div>
          {prochaineSeance ? (
            (() => {
              const delegationDeCetteSeance = !isGuest
                ? mesDelegations.find((d) => d.reunionId === prochaineSeance.id)
                : undefined;
              const identitePourSuivi = isGuest
                ? mandantPour(prochaineSeance.id)
                : delegationDeCetteSeance
                  ? profile?.id
                  : undefined;
              const suiviVisible =
                !!identitePourSuivi &&
                (prochaineSeance.statut === "en_cours" || prochaineSeance.statut === "terminee");
              const maPresenceCarte = realPresences.find(
                (p) => p.reunionId === prochaineSeance.id && p.userId === identitePourSuivi,
              );
              // Présence RÉELLEMENT enregistrée pour MOI (pas la personne que
              // je suis censé suivre) — distincte de `prochaineSeance`, qui ne
              // dépend que de la convocation `confirmed` (« je viendrai »).
              // Sans cette distinction, le badge affichait « Présence confirmée »
              // dès la confirmation de la convocation, alors même que la bannière
              // « Confirmer ma présence » restait affichée juste au-dessus.
              const maPresenceReelle = !isGuest
                ? realPresences.some(
                    (p) => p.reunionId === prochaineSeance.id && p.userId === profile?.id,
                  )
                : false;
              const votesCarte = realVotes.filter((v) => v.reunionId === prochaineSeance.id);
              const pvCarte = realPvs.find((p) => p.reunionId === prochaineSeance.id);
              const maSignatureCarte = pvCarte?.signatures.find(
                (s) => s.userId === identitePourSuivi && s.pvVersion === pvCarte.version,
              );
              const CHOIX_LABEL: Record<string, string> = {
                oui: "Pour",
                non: "Contre",
                abstention: "Abstention",
              };
              return (
                <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <button
                    onClick={() =>
                      nav({
                        tab: "home",
                        sub: "meeting",
                        data: { reunionId: prochaineSeance.id },
                      })
                    }
                    className="w-full text-left p-4 active:scale-[0.98] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-wider text-gold font-bold">
                            {prochaineSeance.type === "ca_extraordinaire"
                              ? "CA Extraordinaire"
                              : prochaineSeance.type === "comite"
                                ? "Comité"
                                : "CA Ordinaire"}
                          </div>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                            {isGuest
                              ? `Vous représentez ${realUsersById[mandantPour(prochaineSeance.id) ?? ""]?.nom ?? "un membre"}`
                              : delegationDeCetteSeance
                                ? `Représenté par ${realUsersById[delegationDeCetteSeance.versUserId]?.nom ?? "votre mandataire"}`
                                : maPresenceReelle
                                  ? "Présence confirmée"
                                  : "Convocation confirmée"}
                          </span>
                        </div>
                        <div className="text-navy font-bold mt-0.5">{prochaineSeance.titre}</div>
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />{" "}
                            {new Date(prochaineSeance.date).toLocaleDateString("fr-FR", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </div>
                          {prochaineSeance.heure && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" /> {prochaineSeance.heure}
                            </div>
                          )}
                          {prochaineSeance.lieu && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" /> {prochaineSeance.lieu}
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                    </div>
                  </button>
                  {suiviVisible && (
                    <div className="border-t border-slate-100 p-4 space-y-2">
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                        Actions de votre mandataire
                      </div>
                      <div className="flex items-center gap-2 text-[12px]">
                        {maPresenceCarte ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <CircleDot className="h-4 w-4 text-slate-300 shrink-0" />
                        )}
                        <span className={maPresenceCarte ? "text-navy" : "text-slate-400"}>
                          {maPresenceCarte
                            ? `Présence scannée (${maPresenceCarte.mode === "presentiel" ? "présentiel" : "à distance"})`
                            : "Présence pas encore scannée"}
                        </span>
                      </div>
                      {votesCarte.map((v) => {
                        const b = v.bulletins.find((x) => x.userId === identitePourSuivi);
                        return (
                          <div key={v.id} className="flex items-center gap-2 text-[12px]">
                            {b ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : (
                              <CircleDot className="h-4 w-4 text-slate-300 shrink-0" />
                            )}
                            <span className={`truncate ${b ? "text-navy" : "text-slate-400"}`}>
                              {v.intitule} —{" "}
                              {b ? `voté ${CHOIX_LABEL[b.choix]}` : "pas encore voté"}
                            </span>
                          </div>
                        );
                      })}
                      {pvCarte && (
                        <div className="flex items-center gap-2 text-[12px]">
                          {maSignatureCarte ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <CircleDot className="h-4 w-4 text-slate-300 shrink-0" />
                          )}
                          <span className={maSignatureCarte ? "text-navy" : "text-slate-400"}>
                            {maSignatureCarte
                              ? "Procès-verbal signé"
                              : pvCarte.statut === "en_signature"
                                ? "PV pas encore signé"
                                : "PV pas encore ouvert à la signature"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="w-full rounded-2xl bg-white p-4 shadow-sm border border-slate-100 text-center">
              <Calendar className="h-6 w-6 text-slate-300 mx-auto" />
              <div className="mt-2 text-[13px] font-medium text-navy">
                {isGuest ? "Aucun mandat actif" : "Aucune séance confirmée"}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {isGuest
                  ? "Vous serez notifié dès qu'un membre du CA vous désignera pour une séance."
                  : "Confirmez votre présence à une convocation pour la voir apparaître ici."}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Accès rapide
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!isGuest && (
              <QuickAction
                icon={CalendarDays}
                label="Mon Calendrier"
                onClick={() => nav({ tab: "profile", sub: "calendrier" })}
              />
            )}
            <QuickAction
              icon={VoteIcon}
              label="Voter maintenant"
              onClick={() => nav({ tab: "vote" })}
              accent
            />
            {/* L'invité (mandataire) ne signe pas le PV : la tuile n'a pas d'objet pour lui. */}
            {!isGuest && (
              <QuickAction
                icon={FileSignature}
                label={
                  pvAttendMonAction
                    ? canSeal
                      ? "Sceller le PV"
                      : "Signer le PV"
                    : pvSealed || mySignatureReal
                      ? "PV signé"
                      : "Procès-verbal"
                }
                // Une fois le PV scellé (tous les membres ont signé, le PCA a
                // apposé le sceau), l'écran de rédaction/signature n'a plus
                // d'objet : on mène directement à la liste des PV signés, seuls
                // documents encore utiles à ce stade.
                onClick={() => nav({ tab: "home", sub: pvSealed ? "pv-archives" : "pv" })}
                alerte={pvAttendMonAction}
                alerteTexte={canSeal ? "À sceller" : "À signer"}
              />
            )}
            {(() => {
              // Même vérité serveur que la bannière du haut : la tuile doit
              // dire « déjà présent » plutôt que réinviter à scanner. Pour un
              // invité, la présence portée est celle de son mandant.
              const cible = isGuest
                ? seanceEnCours
                  ? mandantPour(seanceEnCours.id)
                  : undefined
                : profile?.id;
              const dejaPresent =
                !!seanceEnCours &&
                !!cible &&
                realPresences.some((p) => p.reunionId === seanceEnCours.id && p.userId === cible);
              return (
                <QuickAction
                  icon={QrCode}
                  label={dejaPresent ? "Présence enregistrée" : "Scanner présence"}
                  onClick={() => nav({ tab: "home", sub: "scan" })}
                  fait={dejaPresent}
                  faitTexte="Vous êtes déjà présent"
                />
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
