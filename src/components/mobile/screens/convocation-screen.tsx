// ConvocationScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState, useEffect } from "react";
import { TopBar } from "../shared/ui-components";
import { type View } from "../shared/view-state";
import { PVScreen } from "./pvscreen";
import { supabase } from "@/lib/supabase";
import { type PV } from "@/types/domain";
import { BookOpen, Calendar, CheckCircle2, CircleDot, Crown, MapPin, UserCheck, Video } from "lucide-react";
import { toast } from "sonner";
import { useMobileSession } from "../shared/mobile-session";

export function ConvocationScreen({ nav }: { nav: (v: View) => void }) {
  const {
    confirmConvocation,
    convocateurNom,
    convocationReunionId,
    currentPCA,
    delegateUser,
    isPCA,
    mesDelegations,
    myConvocation,
    pcaConvocation,
    presenceConfirmed,
    presidentReunion,
    procurationSent,
    profile,
    realPresences,
    realPvs,
    realUsersById,
    realVotes,
    requireOnline,
    setConvocationDismissed,
    setPresenceConfirmed,
    signatures,
  } = useMobileSession();

  const [busy, setBusy] = useState(false);
  const isViewerPCA = isPCA; // le viewer courant est le PCA titulaire
  const excused = myConvocation?.statut === "excused";
  // Statut RÉEL en base. Ne pas y mêler `presenceConfirmed` : ce drapeau de
  // session, posé après une confirmation, désactivait le bouton pour TOUTES
  // les convocations suivantes (le PCA ne pouvait plus confirmer sa présidence
  // sur une nouvelle séance).
  const confirmed = myConvocation?.statut === "confirmed";

  // Mandat de procuration actif SORTANT (moi → un invité) pour CETTE réunion.
  // Une fois désigné, confirmer sa présence ou (re)envoyer une procuration
  // n'a plus de sens — le bug signalé était que les deux boutons restaient
  // cliquables même après désignation. On les remplace par le statut du
  // mandataire, et — la séance venue — le suivi de ses actions (elles sont
  // enregistrées sous MON identité, voir mémoire role-invite-procuration).
  const delegationGuest = mesDelegations.find((d) => d.reunionId === presidentReunion?.id);
  const delegateProfile = delegationGuest ? realUsersById[delegationGuest.versUserId] : undefined;
  const maPresence = realPresences.find(
    (p) => p.reunionId === presidentReunion?.id && p.userId === profile?.id,
  );
  const votesReunion = realVotes.filter((v) => v.reunionId === presidentReunion?.id);
  const monPv = realPvs.find((p) => p.reunionId === presidentReunion?.id);
  const maSignature = monPv?.signatures.find(
    (s) => s.userId === profile?.id && s.pvVersion === monPv.version,
  );
  const CHOIX_LABEL: Record<string, string> = {
    oui: "Pour",
    non: "Contre",
    abstention: "Abstention",
  };

  // La convocation part avec le recueil, mais le secrétariat peut aussi le
  // publier plus tard. Tant qu'aucun Board Book n'est publié pour cette réunion,
  // on masque le bouton — le canal Realtime le fait apparaître à la publication.
  const [boardBookPret, setBoardBookPret] = useState(false);
  const reunionId = presidentReunion?.id;
  useEffect(() => {
    if (!reunionId) return;
    let annule = false;
    const charger = () =>
      supabase
        .from("board_books")
        .select("genere_at")
        .eq("reunion_id", reunionId)
        .maybeSingle()
        .then(({ data }) => {
          if (!annule) setBoardBookPret(!!data?.genere_at);
        });
    charger();
    const canal = supabase
      .channel(`boardca:bb:convocation:${reunionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "board_books",
          filter: `reunion_id=eq.${reunionId}`,
        },
        () => charger(),
      )
      // Resynchro sur reconnexion : voir src/lib/notifications.ts.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") charger();
      });
    return () => {
      annule = true;
      supabase.removeChannel(canal);
    };
  }, [reunionId]);

  const doConfirm = async () => {
    if (!requireOnline("Confirmation de présence") || !profile) return;
    setBusy(true);
    try {
      await confirmConvocation(convocationReunionId!, profile.id, "confirmed");
      setPresenceConfirmed(true);
      setConvocationDismissed(true);
      toast.success(isViewerPCA ? "Présidence confirmée" : "Présence confirmée", {
        description: "Le secrétariat a été notifié.",
      });
    } catch {
      toast.error("Échec de la confirmation");
    } finally {
      setBusy(false);
    }
  };

  const excuseWithoutDelegate = async () => {
    if (!requireOnline("Excuse") || !profile) return;
    setBusy(true);
    try {
      await confirmConvocation(convocationReunionId!, profile.id, "excused");
      setConvocationDismissed(true);
      toast.success("Excuse enregistrée", {
        description:
          "Vous pourrez déléguer la présidence dès qu'un administrateur aura confirmé.",
      });
      nav({ tab: "home" });
    } catch {
      toast.error("Échec de l'excuse");
    } finally {
      setBusy(false);
    }
  };

  // Présidence prévue (déclarative, pas basée sur la présence du jour J — voir PVScreen pour l'effective).
  const chairLine =
    !pcaConvocation || pcaConvocation.statut !== "excused"
      ? currentPCA
        ? `Présidence : ${currentPCA.nom} (titulaire)`
        : null
      : delegateUser
        ? `Présidence déléguée à ${delegateUser.nom} pour cette séance`
        : "Présidence à confirmer (titulaire excusé, aucun délégué désigné)";

  return (
    <div>
      <TopBar title="Convocation officielle" onBack={() => nav({ tab: "home" })} />
      <div className="px-5 py-4">
        {isViewerPCA && (
          <div className="mb-3 rounded-xl bg-gold/10 border border-gold/30 px-4 py-3 flex items-start gap-2">
            <Crown className="h-4 w-4 text-gold shrink-0 mt-0.5" />
            <div className="text-[12px] text-navy">
              <span className="font-semibold">
                Convocation — en tant que Président du Conseil d'Administration
              </span>
              <div className="text-slate-600 mt-0.5">
                Vous présidez la séance et scellez le PV final. Si vous ne pouvez pas assister,
                déléguez la présidence à un administrateur ayant confirmé sa présence.
              </div>
            </div>
          </div>
        )}
        {chairLine && (
          <div className="mb-3 rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-[11px] text-slate-600 flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5 text-gold shrink-0" /> {chairLine}
          </div>
        )}

        <div className="rounded-2xl bg-white border-2 border-navy/10 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-br from-navy to-navy-light text-white px-5 py-4 text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold font-bold">
              Conseil d'Administration
            </div>
            <div className="text-lg font-bold mt-1">CONVOCATION OFFICIELLE</div>
            <div className="text-[11px] text-white/70 mt-1">
              BNETD · République de Côte d'Ivoire
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="text-center">
              <div className="text-navy font-bold text-[15px]">{presidentReunion?.titre}</div>
              <div className="mt-2 inline-flex flex-col gap-1 text-[12px] text-slate-700">
                <div className="flex items-center gap-2 justify-center">
                  <Calendar className="h-3.5 w-3.5 text-gold" />
                  {presidentReunion &&
                    new Date(presidentReunion.date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  {presidentReunion?.heure ? ` · ${presidentReunion.heure}` : ""}
                </div>
                {presidentReunion?.lieu && (
                  <div className="flex items-center gap-2 justify-center">
                    <MapPin className="h-3.5 w-3.5 text-gold" /> {presidentReunion.lieu}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">
                Ordre du jour
              </div>
              {(presidentReunion?.ordreDuJour ?? []).length === 0 ? (
                <div className="text-[12px] text-slate-400 italic">
                  Aucun point inscrit à l'ordre du jour.
                </div>
              ) : (
                <ol className="space-y-1.5">
                  {presidentReunion!.ordreDuJour.map((p, i) => (
                    <li key={p.id} className="flex items-start gap-2 text-[12px] text-slate-700">
                      <span className="h-5 w-5 rounded bg-navy text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="flex-1">{p.titre}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {convocateurNom && (
              <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-600 italic">
                Convoqué par{" "}
                <span className="not-italic font-semibold text-navy">{convocateurNom}</span>
                <br />
                Secrétaire du Conseil d'Administration
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {/* Lien de visio posé par le secrétariat à la création. Absent = présentiel
              seul. Il ne s'active qu'au DÉMARRAGE de la séance ; avant, il est
              grisé (le membre ne rejoint pas une séance qui n'a pas commencé). */}
          {presidentReunion?.lienVisio &&
            (presidentReunion.statut === "en_cours" ? (
              <a
                href={presidentReunion.lienVisio}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-white border border-navy/15 text-navy rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Video className="h-5 w-5" /> Lien de visioconférence
              </a>
            ) : (
              <button
                disabled
                title="Disponible au démarrage de la séance"
                className="w-full bg-slate-100 border border-slate-200 text-slate-400 rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Video className="h-5 w-5" /> Lien de visioconférence
                <span className="text-[10px] font-medium">· séance non démarrée</span>
              </button>
            ))}
          {boardBookPret && reunionId && (
            <button
              onClick={() => nav({ tab: "boardbook", sub: "reunion", data: { reunionId } })}
              className="w-full bg-navy text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <BookOpen className="h-5 w-5" /> Consulter le Board Book de la séance
            </button>
          )}
          {delegateProfile ? (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-navy/10 text-navy flex items-center justify-center font-semibold text-sm shrink-0">
                  {delegateProfile.initiales}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-navy truncate">
                    {delegateProfile.nom}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {delegateProfile.mustChangePassword
                      ? "Mandataire désigné — n'a pas encore activé son espace invité."
                      : "A activé son espace et peut vous représenter à cette séance."}
                  </div>
                </div>
              </div>
              {(presidentReunion?.statut === "en_cours" ||
                presidentReunion?.statut === "terminee") && (
                <div className="border-t border-slate-100 p-4 space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                    Actions de votre mandataire
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    {maPresence ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <CircleDot className="h-4 w-4 text-slate-300 shrink-0" />
                    )}
                    <span className={maPresence ? "text-navy" : "text-slate-400"}>
                      {maPresence
                        ? `Présence scannée (${maPresence.mode === "presentiel" ? "présentiel" : "à distance"})`
                        : "Présence pas encore scannée"}
                    </span>
                  </div>
                  {votesReunion.map((v) => {
                    const b = v.bulletins.find((x) => x.userId === profile?.id);
                    return (
                      <div key={v.id} className="flex items-center gap-2 text-[12px]">
                        {b ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <CircleDot className="h-4 w-4 text-slate-300 shrink-0" />
                        )}
                        <span className={`truncate ${b ? "text-navy" : "text-slate-400"}`}>
                          {v.intitule} — {b ? `voté ${CHOIX_LABEL[b.choix]}` : "pas encore voté"}
                        </span>
                      </div>
                    );
                  })}
                  {monPv && (
                    <div className="flex items-center gap-2 text-[12px]">
                      {maSignature ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <CircleDot className="h-4 w-4 text-slate-300 shrink-0" />
                      )}
                      <span className={maSignature ? "text-navy" : "text-slate-400"}>
                        {maSignature
                          ? "Procès-verbal signé"
                          : monPv.statut === "en_signature"
                            ? "PV pas encore signé"
                            : "PV pas encore ouvert à la signature"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={doConfirm}
                disabled={busy || confirmed || excused}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
              >
                <CheckCircle2 className="h-5 w-5" />{" "}
                {confirmed
                  ? isViewerPCA
                    ? "Présidence confirmée"
                    : "Présence confirmée"
                  : isViewerPCA
                    ? "Confirmer ma présidence"
                    : "Confirmer ma présence"}
              </button>
              {isViewerPCA ? (
                <button
                  onClick={() => nav({ tab: "home", sub: "delegate" })}
                  disabled={busy || (excused && !!delegateUser)}
                  className="w-full bg-white border border-slate-200 text-navy rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                >
                  <Crown className="h-5 w-5 text-gold" />{" "}
                  {excused
                    ? delegateUser
                      ? "Présidence déléguée"
                      : "Déléguer la présidence"
                    : "M'excuser et déléguer"}
                </button>
              ) : (
                // Une fois la présence confirmée, la procuration n'a plus de sens :
                // on masque le bouton (on ne délègue pas si l'on siège). `presenceConfirmed`
                // le fait disparaître dès le clic, sans attendre le rechargement serveur.
                !confirmed &&
                !presenceConfirmed && (
                  <button
                    onClick={() => nav({ tab: "home", sub: "procuration" })}
                    disabled={procurationSent}
                    className="w-full bg-white border border-slate-200 text-navy rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                  >
                    <UserCheck className="h-5 w-5" />{" "}
                    {procurationSent ? "Procuration envoyée" : "Envoyer une procuration"}
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
