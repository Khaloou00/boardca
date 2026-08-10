import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApp } from "@/lib/app-store";
import { useBoardStore } from "@/store/useBoardStore";
import { voteTally } from "@/store/selectors";
import { useShallow } from "zustand/react/shallow";
import type {
  DocType,
  Reunion,
  PV,
  Signature as PvSignature,
  User as CaUser,
} from "@/types/domain";
import { TYPE_BADGE, normaliserDocType } from "@/lib/doc-types";
import { MeetingCalendar } from "@/components/calendar/meeting-calendar";
import { PdfAnnotator } from "@/components/pdf/pdf-annotator";
import {
  deleteAnnotation,
  fetchAnnotationsDeLaSeance,
  type AnnotationCible,
  type DocAnnotation,
} from "@/lib/annotations";
import { supabase } from "@/lib/supabase";
import { pvEstVide } from "@/lib/pv-format";
import { genererPvPdfUrl } from "@/lib/pv-pdf";
import {
  fetchPvObservations,
  ajouterPvObservation,
  type PvObservation,
} from "@/lib/pv-observations";
import { BrandLogo } from "@/components/brand-logo";
import { ROLE_LABELS } from "@/lib/role-labels";
import { DiscussionsScreen } from "./discussions-screen";
import { fetchDiscussions } from "@/lib/discussions";
import {
  fetchRapportsAction,
  uploadPieceJointe,
  lienPieceJointe,
  MAX_RAPPORT_BYTES,
} from "@/lib/action-rapports";
import type { ActionRapport } from "@/types/domain";
import {
  Home,
  BookOpen,
  Video,
  Vote as VoteIcon,
  Bell,
  User,
  ChevronRight,
  Calendar,
  CalendarDays,
  MapPin,
  Users,
  FileText,
  Paperclip,
  X,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Fingerprint,
  PenLine,
  MessageSquare,
  Download,
  Shield,
  LogOut,
  Clock,
  CircleDot,
  QrCode,
  ScanLine,
  Lock,
  Highlighter,
  Loader2,
  Search as SearchIcon,
  Trash2,
  AlertCircle,
  WifiOff,
  Wifi,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ShieldCheck,
  BadgeCheck,
  Send,
  UserCheck,
  FileSignature,
  ThumbsDown,
  ClipboardCheck,
  Crown,
  Coins,
  ListChecks,
  CalendarClock,
  MailCheck,
  Gavel,
  Mail,
  Phone,
  UserPlus,
  Copy,
} from "lucide-react";
import {
  fetchConsultations,
  repondreConsultation,
  decompte,
  peutRepondre,
  echue,
  type Consultation,
  type Choix as ChoixConsultation,
} from "@/lib/consultations";
import { toast } from "sonner";
import { MesJetonsScreen } from "@/components/jetons/MesJetonsScreen";
import { useNotifications, NotificationsProvider } from "@/hooks/useNotifications";
import type { Notification as NotificationItem, NotificationType } from "@/lib/notifications";
import { fetchPvArchives, type PvArchive } from "@/lib/archives";
import {
  TopBar,
  Corner,
  QuickAction,
  Stat,
  ProgressLine,
} from "./shared/ui-components";
import { CanvasSignPad, SignatureRow, type Signature } from "./shared/signature-pad";
import { NoMeetingScreen } from "./shared/no-meeting-screen";
import { relativeTimeShort } from "./shared/utils";
import { CLE_VUE, lireVueEnregistree, type Tab, type View } from "./shared/view-state";
import { MobileSessionProvider, useMobileSession } from "./shared/mobile-session";
import { HomeScreen } from "./screens/home-screen";
import { ActionsScreen } from "./screens/actions-screen";
import { MeetingDetail } from "./screens/meeting-detail";
import { PCAScreen } from "./screens/pcascreen";
import { PVSignScreen } from "./screens/pvsign-screen";
import { ProfileScreen } from "./screens/profile-screen";
import { ConsultationsScreen } from "./screens/consultations-screen";
import { MesConvocationsScreen } from "./screens/mes-convocations-screen";
import { BoardBookListScreen } from "./screens/board-book-list-screen";
import { NotifsScreen } from "./screens/notifs-screen";
import { DelegatePickerScreen } from "./screens/delegate-picker-screen";
import { ScannerScreen } from "./screens/scanner-screen";
import { DownloadScreen } from "./screens/download-screen";
import { CalendrierScreen } from "./screens/calendrier-screen";
import { SeancesScreen } from "./screens/seances-screen";
import { PvArchivesScreen } from "./screens/pv-archives-screen";
import { ScanConfirmScreen } from "./screens/scan-confirm-screen";



// Composant à part (PAS imbriqué dans `MobileAdminApp`) : seul lui se re-rend
// au fil des notifications (poll/Realtime), jamais l'app mobile entière — voir
// l'avertissement dans `useNotifications.tsx`.
function NotifBadge() {
  const { unread } = useNotifications();
  if (unread <= 0) return null;
  return (
    <span
      aria-label={`${unread} notification(s) non lue(s)`}
      className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
    >
      {unread > 9 ? "9+" : unread}
    </span>
  );
}






// Mappe les méthodes de signature du domaine (trace|otp|biometrie) vers les
// libellés accentués attendus par SignatureRow (tracé|otp|biométrie).
const METHODE_LABEL: Record<"trace" | "otp" | "biometrie", Signature["methode"]> = {
  trace: "tracé",
  otp: "otp",
  biometrie: "biométrie",
};


// Le Provider vit ICI, autour de l'écran mobile entier, pas dans son propre
// state — voir l'avertissement dans `useNotifications.tsx` : si l'écran mobile
// lui-même consommait le hook, chaque tick de notification redéfinirait toutes
// ses fonctions imbriquées (tous les écrans) et les remonterait.
export function MobileAdminApp() {
  return (
    <NotificationsProvider>
      <MobileSessionProvider>
        <MobileAdminAppScreen />
      </MobileSessionProvider>
    </NotificationsProvider>
  );
}

function MobileAdminAppScreen() {
  const {
    accesInviteExpire,
    actionsApercu,
    actionsEnRetardGlobal,
    addProcuration,
    allActions,
    allConvocations,
    boardBookReunion,
    canSeal,
    castBulletin,
    castVote,
    chargerMesDelegations,
    confirmConvocation,
    confirmedCandidates,
    consultations,
    consultationsATraiter,
    convocateurNom,
    convocationDismissed,
    convocationEnAttente,
    convocationRepondue,
    convocationReunionId,
    convocationsReady,
    currentPCA,
    currentUser,
    delegatePresidentSeance,
    delegateUser,
    delegateUserForPv,
    derniereSeanceTenue,
    detailReunion,
    detailReunionId,
    downloaded,
    effectiveSealer,
    fetchConvocations,
    fetchProcurationsStore,
    fetchVotesStore,
    iSuisPresent,
    idProfil,
    inviteExterneResultat,
    inviterExterne,
    isEffectiveSealer,
    isGuest,
    isPCA,
    log,
    logout,
    mandantPour,
    mandatsCharges,
    meeting,
    meetings,
    mesConvocations,
    mesDelegations,
    mesMandats,
    myConvocation,
    mySignatureReal,
    nav,
    navigate,
    offline,
    otherPresentUsers,
    othersAllSigned,
    partenaireProcuration,
    pcaConvocation,
    presenceConfirmed,
    presencesLoading,
    presentUsers,
    presidentConvocations,
    presidentReunion,
    prochaineDelegationReunion,
    prochaineSeance,
    procurationSent,
    profile,
    pvAttendMonAction,
    pvDataReady,
    pvIdentiteEffective,
    pvLoading,
    pvReunion,
    pvReunionId,
    pvSealed,
    realPresences,
    realProcurations,
    realPv,
    realPvs,
    realReunions,
    realSignaturesCourantes,
    realSignedCount,
    realSignedIds,
    realTotalPresents,
    realUsers,
    realUsersById,
    realVotes,
    rechargerConsultations,
    requireOnline,
    reunionIdsKey,
    reunionPresences,
    reunionsAVenirCount,
    reunionsPourEcrans,
    scanPresence,
    seanceAVenir,
    seanceEnCours,
    seancesConfirmees,
    setConsultations,
    setConvocationDismissed,
    setConvocationsReady,
    setDownloaded,
    setInviteExterneResultat,
    setMandatsCharges,
    setMesConvocations,
    setMesDelegations,
    setMesMandats,
    setOffline,
    setPresenceConfirmed,
    setProcurationSent,
    setReunionActive,
    setSignatures,
    setView,
    signPV,
    signatures,
    signedCount,
    soumettreRapportAction,
    titularPresent,
    totalSigners,
    updateMeeting,
    usersLoading,
    view,
    votes,
    votesOuvertsCount,
    waitingToSeal,
  } = useMobileSession();

  // Portail fermé dès la clôture de la séance représentée : plutôt que des
  // actions qui échoueraient une à une sur des erreurs RLS opaques (le filet
  // réel reste côté serveur — voir `private.is_active_guest()`), un écran
  // dédié de remerciement, avec la seule action possible : se déconnecter.
  // Le mandat redevient utilisable seulement si un membre du CA désigne à
  // nouveau ce compte pour une autre séance.
  if (accesInviteExpire) {
    const derniereReunion = mesMandats
      .map((m) => realReunions.find((r) => r.id === m.reunionId))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .sort((a, b) => (b.cloutureeAt ?? "").localeCompare(a.cloutureeAt ?? ""))[0];
    const seDeconnecter = async () => {
      await logout();
      navigate({ to: "/auth" });
    };
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 px-8 text-center">
        <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div className="mt-4 text-lg font-bold text-navy">Merci pour votre participation</div>
        <div className="mt-2 text-sm text-slate-500">
          {derniereReunion
            ? `La séance « ${derniereReunion.titre} » est clôturée. Votre accès en tant que mandataire est maintenant fermé.`
            : "Votre procuration n'est plus active pour aucune séance."}
        </div>
        <button
          onClick={seDeconnecter}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy text-white px-5 py-3 font-semibold active:scale-[0.98] transition"
        >
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 relative">
      {/* Offline mode banner */}
      {offline && (
        <div className="bg-slate-800 text-white text-[11px] px-4 py-1.5 flex items-center justify-center gap-2">
          <WifiOff className="h-3 w-3" /> Mode hors-ligne · Seuls le Board Book et vos annotations
          restent accessibles
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-24">
        {view.tab === "home" && !view.sub && <HomeScreen nav={nav} />}
        {view.tab === "home" &&
          view.sub === "meeting" &&
          (detailReunion ? (
            <MeetingDetail reunion={detailReunion} nav={nav} />
          ) : (
            <NoMeetingScreen title="Détail de la séance" onBack={() => nav({ tab: "home" })} />
          ))}
        {view.tab === "home" && view.sub === "convocation" && <ConvocationScreen nav={nav} />}
        {view.tab === "home" && view.sub === "delegate" && <DelegatePickerScreen nav={nav} />}
        {view.tab === "home" &&
          view.sub === "download" &&
          (meeting ? (
            <DownloadScreen nav={nav} />
          ) : (
            <NoMeetingScreen title="Téléchargement" onBack={() => nav({ tab: "home" })} />
          ))}
        {view.tab === "home" && view.sub === "procuration" && <ProcurationScreen nav={nav} />}
        {view.tab === "home" &&
          view.sub === "scan" &&
          (seanceEnCours ? (
            <ScannerScreen nav={nav} />
          ) : (
            <NoMeetingScreen title="Confirmer ma présence" onBack={() => nav({ tab: "home" })} />
          ))}
        {view.tab === "home" &&
          view.sub === "scan-ok" &&
          (seanceEnCours ? (
            <ScanConfirmScreen
              nav={nav}
              seanceEnCours={seanceEnCours}
              estGuest={isGuest}
              // La présence est enregistrée au nom du membre représenté :
              // afficher SON nom, pas celui du compte invité connecté.
              mandantNom={
                isGuest ? realUsersById[mandantPour(seanceEnCours?.id) ?? ""]?.nom : undefined
              }
            />
          ) : (
            <NoMeetingScreen title="Présence" onBack={() => nav({ tab: "home" })} />
          ))}
        {view.tab === "home" && view.sub === "pv" && (
          <PVScreen
            nav={nav}
            realPv={realPv}
            pvReunion={pvReunion}
            profile={profile}
            pvDataReady={pvDataReady}
            pvSealed={pvSealed}
            mySignatureReal={mySignatureReal}
            waitingToSeal={waitingToSeal}
            canSeal={canSeal}
            currentPCA={currentPCA}
            presentUsers={presentUsers}
            realTotalPresents={realTotalPresents}
            realSignedCount={realSignedCount}
          />
        )}
        {view.tab === "home" && view.sub === "pv-archives" && (
          <PvArchivesScreen onBack={() => nav({ tab: "home" })} />
        )}
        {view.tab === "home" && view.sub === "pv-sign" && <PVSignScreen nav={nav} />}
        {view.tab === "boardbook" &&
          (!view.sub ? (
            <BoardBookListScreen nav={nav} />
          ) : !(realReunions.find((r) => r.id === view.data?.reunionId) ?? boardBookReunion) ? (
            // Au rechargement de la page, l'onglet est restauré avant que les
            // réunions ne soient chargées : sans ce garde, BoardBookScreen lisait
            // `reunion.id` sur null et faisait planter l'app.
            <NoMeetingScreen title="Board Book" onBack={() => nav({ tab: "boardbook" })} />
          ) : (
            <BoardBookScreen
              nav={nav}
              sub={view.sub}
              data={view.data}
              realReunions={realReunions}
              boardBookReunion={boardBookReunion}
              profile={profile}
              requireOnline={requireOnline}
              partenaireProcuration={partenaireProcuration}
            />
          ))}
        {view.tab === "vote" && <VoteScreen nav={nav} sub={view.sub} data={view.data} />}
        {view.tab === "discussions" && <DiscussionsScreen />}
        {view.tab === "home" && view.sub === "pca-hub" && <PCAScreen nav={nav} />}
        {view.tab === "notifs" && <NotifsScreen nav={nav} />}
        {view.tab === "profile" && !view.sub && <ProfileScreen nav={nav} />}
        {view.tab === "profile" && view.sub === "jetons" && (
          <MesJetonsScreen onBack={() => nav({ tab: "profile" })} />
        )}
        {view.tab === "profile" && view.sub === "pv-archives" && (
          <PvArchivesScreen onBack={() => nav({ tab: "profile" })} />
        )}
        {view.tab === "profile" && view.sub === "convocations" && (
          <MesConvocationsScreen nav={nav} />
        )}
        {view.tab === "profile" && view.sub === "calendrier" && <CalendrierScreen nav={nav} />}
        {view.tab === "profile" && view.sub === "seances" && <SeancesScreen nav={nav} />}
        {view.tab === "profile" && view.sub === "actions" && <ActionsScreen nav={nav} />}
        {view.tab === "profile" && view.sub === "consultations" && (
          <ConsultationsScreen nav={nav} />
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-[env(safe-area-inset-bottom,20px)] pt-2 z-50 pointer-events-none">
        <nav
          className="bg-gradient-to-r from-indigo-100/20 to-blue-100/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-[0_8px_32px_rgba(13,27,62,0.08)] p-1 pointer-events-auto"
          aria-label="Navigation principale mobile"
        >
          <ul className={`grid gap-1 ${isGuest ? "grid-cols-3" : "grid-cols-5"}`}>
            {(
              [
                {
                  k: "home",
                  label: "Accueil",
                  icon: Home,
                },
                {
                  k: "boardbook",
                  label: "Board Book",
                  icon: BookOpen,
                },
                {
                  k: "discussions",
                  label: "Discussions",
                  icon: MessageSquare,
                },
                {
                  k: "notifs",
                  label: "Alertes",
                  icon: Bell,
                },
                {
                  k: "profile",
                  label: "Profil",
                  icon: User,
                },
              ] as { k: Tab; label: string; icon: typeof Home }[]
            )
              // L'invité ne représente qu'un membre pour une seule séance : pas de
              // discussions ni de profil/paramètres personnels à gérer.
              .filter((t) => !isGuest || t.k === "home" || t.k === "boardbook" || t.k === "notifs")
              .map((t) => {
                const active = view.tab === t.k;
                return (
                  <li key={t.k} className="relative">
                    {/* Gold top indicator */}
                    <div className="absolute top-0 inset-x-0 flex justify-center">
                      <span
                        className={`h-2 w-2 rounded-full bg-primary-500 transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}
                      />
                    </div>
                    <button
                      onClick={() => nav({ tab: t.k as Tab })}
                      aria-current={active ? "page" : undefined}
                      aria-label={t.label}
                      className={`w-full flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${active ? "bg-white/10 backdrop-blur-md border border-primary-500 shadow-lg scale-[1.04]" : "text-slate-600 hover:text-slate-800 hover:bg-slate-100/30"}`}
                    >
                      <span className="relative">
                        <t.icon
                          className={`h-4.5 w-4.5 transition-all duration-300 ${
                            active ? "text-navy" : "text-slate-600"
                          }`}
                          strokeWidth={active ? 2.25 : 1.75}
                          aria-hidden="true"
                        />
                        {t.k === "notifs" && <NotifBadge />}
                      </span>
                      <span
                        className={`text-[10px] transition-colors duration-200 ${
                          active ? "font-bold text-navy" : "font-medium text-slate-600"
                        }`}
                      >
                        {t.label}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </nav>
      </div>
    </div>
  );


  function ConvocationScreen({ nav }: { nav: (v: View) => void }) {
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


  function ProcurationScreen({ nav }: { nav: (v: View) => void }) {
    const [recherche, setRecherche] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [formInvite, setFormInvite] = useState(false);
    const [prenom, setPrenom] = useState("");
    const [nomInvite, setNomInvite] = useState("");
    const [emailInvite, setEmailInvite] = useState("");
    const [motif, setMotif] = useState("");
    const [busyInvite, setBusyInvite] = useState(false);
    // Vit dans MobileAdminApp, pas ici — voir le commentaire à sa déclaration
    // (piège de remount de ce fichier).
    const envoyee = inviteExterneResultat;

    const reunion = realReunions.find((r) => r.id === convocationReunionId) ?? presidentReunion;
    const titreSeance = reunion?.titre ?? "cette séance";

    // Toute personne du système sauf le super_admin et le PCA titulaire — et
    // moi-même. Inclut la Secrétaire et les invités déjà validés lors d'une
    // réunion précédente : les choisir ne crée rien, juste une procuration.
    const eligibles = realUsers.filter(
      (u) => u.role !== "super_admin" && !u.estPresidentCA && u.id !== profile?.id,
    );
    const q = recherche.trim().toLowerCase();
    const filtres = q
      ? eligibles.filter(
          (u) => u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        )
      : eligibles;
    const ressembleAUnEmail = q.includes("@") && q.includes(".");
    const aucunResultat = filtres.length === 0;

    const choisir = async (u: { id: string; nom: string }) => {
      if (!convocationReunionId || !profile) return;
      if (!requireOnline("Désignation d'un mandataire")) return;
      setBusyId(u.id);
      try {
        const { emailSent } = await addProcuration(convocationReunionId, profile.id, u.id);
        await confirmConvocation(convocationReunionId, profile.id, "excused");
        await chargerMesDelegations();
        setProcurationSent(true);
        toast.success("Mandataire désigné", {
          description: emailSent
            ? `${u.nom} peut désormais voter, signer et scanner votre présence à votre place — il/elle a été alerté(e) par email.`
            : `${u.nom} peut désormais voter, signer et scanner votre présence à votre place. L'email d'alerte n'a pas pu être envoyé — prévenez-le/la directement.`,
        });
        nav({ tab: "home" });
      } catch (e) {
        toast.error("Échec de la désignation", {
          description: e instanceof Error ? e.message : undefined,
        });
      } finally {
        setBusyId(null);
      }
    };

    const ouvrirFormInvite = () => {
      setEmailInvite(ressembleAUnEmail ? recherche.trim() : "");
      setPrenom("");
      setNomInvite("");
      setMotif("");
      setFormInvite(true);
    };

    const inviterPersonne = async () => {
      if (!requireOnline("Invitation d'un mandataire")) return;
      if (!nomInvite.trim() || !prenom.trim() || !emailInvite.trim()) {
        return toast.error("Nom, prénom et email requis");
      }
      if (!convocationReunionId) return toast.error("Aucune séance à représenter");
      setBusyInvite(true);
      try {
        const resultat = await inviterExterne(convocationReunionId, {
          nom: nomInvite.trim(),
          prenom: prenom.trim(),
          email: emailInvite.trim(),
          motif: motif.trim() || undefined,
        });
        await chargerMesDelegations();
        setInviteExterneResultat({
          nom: nomInvite.trim(),
          prenom: prenom.trim(),
          emailSent: resultat.emailSent,
          lien: resultat.lien,
        });
        setFormInvite(false);
      } catch (e) {
        toast.error("Échec de l'invitation", {
          description: e instanceof Error ? e.message : undefined,
        });
      } finally {
        setBusyInvite(false);
      }
    };

    const terminer = () => {
      setProcurationSent(true);
      setInviteExterneResultat(null);
      nav({ tab: "home" });
    };

    if (envoyee) {
      return (
        <div>
          <TopBar title="Procuration" onBack={terminer} />
          <div className="px-5 py-4">
            <div className="rounded-2xl bg-white border border-emerald-200 p-5 shadow-sm text-center">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="mt-3 text-[15px] font-bold text-navy">Mandataire désigné</div>
              <div className="mt-1 text-[12px] text-slate-500">
                {envoyee.emailSent
                  ? `Un email d'invitation a été envoyé à ${envoyee.nom} ${envoyee.prenom} avec son accès à l'espace invité.`
                  : `${envoyee.nom} ${envoyee.prenom} peut déjà vous représenter, mais l'email d'invitation n'a pas pu être envoyé — communiquez-lui l'accès ci-dessous manuellement.`}
              </div>
              {!envoyee.emailSent && envoyee.lien && (
                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-left text-[12px] space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 font-mono text-navy break-all">{envoyee.lien}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(envoyee.lien!);
                        toast.success("Lien copié");
                      }}
                      className="shrink-0 h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 active:scale-95"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-slate-400">
                    Envoyez ce lien à {envoyee.nom} {envoyee.prenom} (SMS, WhatsApp…) — il y créera
                    son mot de passe personnel.
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={terminer}
              className="mt-4 w-full bg-navy text-white rounded-xl py-3.5 font-semibold active:scale-[0.98]"
            >
              Terminé
            </button>
          </div>
        </div>
      );
    }

    if (formInvite) {
      return (
        <div>
          <TopBar title="Nouvel invité" onBack={() => setFormInvite(false)} />
          <div className="px-5 py-4">
            <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm space-y-3">
              <div className="text-[11px] text-slate-500">
                Cette personne n'est pas encore dans le système : son compte est créé immédiatement
                et elle reçoit un email avec le lien pour se connecter et vous représenter.
              </div>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Nom
                </span>
                <input
                  value={nomInvite}
                  onChange={(e) => setNomInvite(e.target.value)}
                  placeholder="Nom"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Prénom
                </span>
                <input
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Prénom"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Email
                </span>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={emailInvite}
                    onChange={(e) => setEmailInvite(e.target.value)}
                    placeholder="email@exemple.com"
                    className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Motif (facultatif)
                </span>
                <input
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Raison de la représentation"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </label>
            </div>
            <button
              onClick={inviterPersonne}
              disabled={busyInvite}
              className="mt-4 w-full bg-navy text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
            >
              {busyInvite ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              {busyInvite ? "Création en cours…" : "Créer et inviter"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <TopBar title="Procuration" onBack={() => nav({ tab: "home", sub: "convocation" })} />
        <div className="px-5 py-4">
          <div className="text-[11px] text-slate-500 mb-3">
            Désignez la personne qui vous représentera pour « {titreSeance} » : elle pourra voter,
            signer le procès-verbal, scanner votre présence et recevoir le Board Book à votre place,
            jusqu'à 2 jours après la clôture de la séance.
          </div>
          <div className="relative mb-3">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {filtres.map((u) => (
              <button
                key={u.id}
                onClick={() => choisir(u)}
                disabled={!!busyId}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 disabled:opacity-60"
              >
                <div className="h-9 w-9 rounded-full bg-navy text-gold flex items-center justify-center text-[12px] font-bold shrink-0">
                  {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : u.initiales}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-navy truncate">{u.nom}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {ROLE_LABELS[u.role].short} · {u.email}
                  </div>
                </div>
              </button>
            ))}
            {aucunResultat && (
              <div className="px-4 py-6 text-center text-[12px] text-slate-500">
                Aucune personne ne correspond à « {recherche} ».
              </div>
            )}
          </div>
          {ressembleAUnEmail && aucunResultat && (
            <button
              onClick={ouvrirFormInvite}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gold text-navy bg-gold/5 py-3.5 font-semibold active:scale-[0.98]"
            >
              <UserPlus className="h-5 w-5" /> Inviter « {recherche.trim()} »
            </button>
          )}
        </div>
      </div>
    );
  }





  // « Board Book » = un dossier par réunion : l'ordre du jour, et sous chaque
  // point les documents qui s'y rattachent. Il n'y a pas de PDF unique compilé —
  // chaque pièce s'ouvre séparément. Une réunion a son recueil « disponible » dès
  // que le secrétariat l'a publié (ligne dans `board_books`).

  function VoteScreen({ nav, sub, data }: { nav: (v: View) => void; sub?: string; data?: any }) {
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

  function VoteResultScreen({ voteId, onBack }: { voteId: string; onBack: () => void }) {
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

  // Notifications réelles : produites par les triggers Postgres sur les événements
  // métier (convocation, scrutin, PV, action, document, board book, discussion).
  // Rien ne s'affiche tant qu'aucune action n'a eu lieu dans l'application.

  // PV signés en définitive par le PCA (archives, lecture seule). Atteint depuis
  // le Profil ET depuis l'Accès rapide de l'Accueil quand le PV courant est
  // scellé — d'où un `onBack` fourni par l'appelant plutôt qu'une destination
  // codée en dur, sinon le retour renverrait vers le mauvais onglet.

  // Toutes les séances du Conseil et leur statut.
  // Lecteur PDF intégré : rend le vrai fichier et permet de surligner /
  // commenter (privé ou partagé). L'URL signée est créée à l'ouverture.
  // Toutes les convocations du membre, toutes réunions confondues. Le store ne
  // contient que celles de la réunion active : on interroge donc directement.
  // Re-fetch quand `allConvocations` change → la liste se met à jour dès qu'une
  // réponse est enregistrée depuis l'Accueil.

  // Visionneuse d'image : mêmes commandes de zoom que le lecteur PDF. Pas de
  // couche texte, donc pas d'annotation possible sur une image.
  // Toutes les séances du Conseil, en grille mensuelle. Cliquer une séance ouvre
  // son détail (même écran que « Prochaine séance »).

  // Consultation écrite hors séance. Le membre répond UNE fois (RLS
  // `cons_rep_insert_self` : soi-même, consultation ouverte, avant la date limite).

  // Suivi des actions du membre. La RLS `actions_update_responsable` autorise le
  // responsable à faire avancer SES actions ; `act_comm_insert_scope` à commenter.




  // Espace PCA : consolide les actions propres au Président, en plus de celles
  // d'un membre du CA ordinaire (discussions du CA, présidence de séance,
  // signature finale du PV). Renvoie vers les écrans existants plutôt que de
  // dupliquer leur logique.
}

function PVScreen({
  nav,
  realPv,
  pvReunion,
  profile,
  pvDataReady,
  pvSealed,
  mySignatureReal,
  waitingToSeal,
  canSeal,
  currentPCA,
  presentUsers,
  realTotalPresents,
  realSignedCount,
}: {
  nav: (v: View) => void;
  realPv: PV | undefined;
  pvReunion: Reunion | null;
  profile: CaUser | null;
  pvDataReady: boolean;
  pvSealed: boolean;
  mySignatureReal: PvSignature | undefined;
  waitingToSeal: boolean;
  canSeal: boolean;
  currentPCA: CaUser | undefined;
  presentUsers: CaUser[];
  realTotalPresents: number;
  realSignedCount: number;
}) {
  const pct = realTotalPresents ? Math.round((realSignedCount / realTotalPresents) * 100) : 0;

  // PDF lisible du PV, généré à la volée depuis son contenu, pour être lu et annoté
  // (surlignage, commentaires privés/partagés) comme un document du Board Book.
  const [pvPdfUrl, setPvPdfUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!realPv || pvEstVide(realPv.contenu ?? "")) {
      setPvPdfUrl(null);
      return;
    }
    const url = genererPvPdfUrl({
      titre: pvReunion?.titre ?? "Procès-verbal",
      date: pvReunion
        ? new Date(pvReunion.date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "",
      lieu: pvReunion?.lieu ?? "—",
      contenuHtml: realPv.contenu ?? "",
    });
    setPvPdfUrl(url);
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realPv?.id, realPv?.contenu, pvReunion?.id]);

  // Observations partagées sur ce PV (désapprobations, réserves) — visibles de tous.
  const [observations, setObservations] = useState<PvObservation[]>([]);
  const [obsTexte, setObsTexte] = useState("");
  const [obsBusy, setObsBusy] = useState(false);
  const [obsOuvert, setObsOuvert] = useState(false);
  const pvIdCourant = realPv?.id ?? null;
  useEffect(() => {
    if (!pvIdCourant) return setObservations([]);
    let annule = false;
    const charger = () =>
      fetchPvObservations(pvIdCourant)
        .then((o) => !annule && setObservations(o))
        .catch(() => {});
    charger();
    const canal = supabase
      .channel(`boardca:pv-obs:${pvIdCourant}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pv_observations",
          filter: `pv_id=eq.${pvIdCourant}`,
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
  }, [pvIdCourant]);

  const envoyerObservation = async (type: "observation" | "desapprobation") => {
    if (!realPv || !profile || !obsTexte.trim()) return;
    setObsBusy(true);
    try {
      await ajouterPvObservation(realPv.id, profile.id, obsTexte, type, realPv.version);
      setObsTexte("");
      setObsOuvert(false);
      setObservations(await fetchPvObservations(realPv.id));
      toast.success(
        type === "desapprobation" ? "Désapprobation enregistrée" : "Observation partagée",
        { description: "Les membres du CA et le Secrétariat en sont informés." },
      );
    } catch {
      toast.error("Envoi impossible");
    } finally {
      setObsBusy(false);
    }
  };
  if (!pvDataReady) {
    return (
      <div className="bg-[#F8FAFC] min-h-full pb-6 relative z-0 overflow-y-auto flex-1">
        <TopBar title="Procès-verbal" onBack={() => nav({ tab: "home" })} />
        <div className="px-5 py-10 flex flex-col items-center gap-2 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <div className="text-xs">Chargement du procès-verbal…</div>
        </div>
      </div>
    );
  }
  // Aucun PV en base tant que la Secrétaire n'a pas clôturé une séance.
  if (!realPv || !pvReunion) {
    return (
      <div className="bg-[#F8FAFC] min-h-full">
        <TopBar title="Procès-verbal" onBack={() => nav({ tab: "home" })} />
        <div className="px-8 py-20 flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <div className="text-sm font-semibold text-navy">Aucun procès-verbal</div>
          <div className="text-xs text-slate-500 max-w-[250px]">
            Le PV sera disponible après la clôture d'une séance par le Secrétariat.
          </div>
        </div>
      </div>
    );
  }
  // Une observation (a fortiori une désapprobation) est l'ALTERNATIVE à la
  // signature, pas un complément — cf. le texte d'état vide plus bas
  // (« Signer le PV vaut approbation ; une observation permet d'exprimer une
  // réserve »). Sans cette valeur, "Apposer ma signature" restait cliquable
  // après une désapprobation déjà envoyée, ce qui est contradictoire.
  // Filtré sur la manche COURANTE (pv.version) : un PV renvoyé après correction
  // (RPC `renvoyer_pv`) est un NOUVEAU texte — les positions prises sur la
  // version précédente ne s'y appliquent plus du tout. Côté membre elles ne
  // sont donc ni affichées, ni comptées, ni bloquantes : chacun repart d'une
  // page blanche (le Secrétariat, lui, garde l'historique complet dans son
  // panneau, c'est là que ça sert).
  const observationsCourantes = observations.filter((o) => o.pvVersion === realPv?.version);
  const monObservation = observationsCourantes.find((o) => o.userId === profile?.id);

  // Bloc de signature : réutilisé, placé AVANT les observations (le membre lit le
  // PV, signe — ou pas — puis consulte/émet les observations).
  const blocSignature = pvSealed ? (
    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
      <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto" />
      <div className="mt-2 font-bold text-emerald-800">PV intégralement signé</div>
      <div className="text-[11px] text-emerald-700 mt-1">
        Scellé par {currentPCA?.nom ?? "le PCA"} · Archivé · Conservation 10 ans
      </div>
    </div>
  ) : realPv?.statut !== "en_signature" ? (
    <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 text-center text-[12px] text-slate-600 flex items-center justify-center gap-2">
      <Clock className="h-4 w-4" /> Le PV n'a pas encore été envoyé pour signature par le
      Secrétariat
    </div>
  ) : mySignatureReal ? (
    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-[12px] text-emerald-800 font-semibold flex items-center justify-center gap-2">
      <CheckCircle2 className="h-4 w-4" /> Votre signature a été apposée
    </div>
  ) : waitingToSeal ? (
    <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 text-center text-[12px] text-slate-600 flex items-center justify-center gap-2">
      <Clock className="h-4 w-4" /> En attente des signatures des membres ({realSignedCount}/
      {Math.max(realTotalPresents - 1, 0)})
    </div>
  ) : canSeal ? (
    <button
      onClick={() => nav({ tab: "home", sub: "pv-sign" })}
      className="w-full bg-gradient-to-r from-gold to-yellow-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] shadow"
    >
      <Crown className="h-5 w-5" /> Sceller le PV
    </button>
  ) : monObservation ? null : (
    <button
      onClick={() => nav({ tab: "home", sub: "pv-sign" })}
      className="w-full bg-gradient-to-r from-gold to-yellow-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] shadow"
    >
      <FileSignature className="h-5 w-5" /> Apposer ma signature
    </button>
  );

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-6">
      <TopBar title="Procès-verbal" onBack={() => nav({ tab: "home" })} />
      <div className="px-4 py-4 space-y-4">
        {/* Le document PDF du PV : en-tête, présents et texte y figurent déjà. */}
        {pvEstVide(realPv?.contenu ?? "") ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-6 text-center text-[12px] italic text-slate-400">
            Le procès-verbal n'a pas encore été rédigé par le Secrétariat.
          </div>
        ) : pvPdfUrl && profile ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden">
            <PdfAnnotator
              cible={{ pvId: realPv!.id }}
              url={pvPdfUrl}
              userId={profile.id}
              visibiliteImposee="public"
              pvVersion={realPv!.version}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Préparation du PDF…
          </div>
        )}

        {/* Signature — avant les observations. */}
        {blocSignature}

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 text-[12px] text-slate-700 space-y-3">
            {/* Observations partagées : la voix des membres qui ne signent pas. */}
            <section>
              <div className="text-[10px] uppercase tracking-widest text-gold font-bold mb-1.5">
                Observations du Conseil ({observationsCourantes.length})
              </div>

              {/* La désapprobation est une action à part entière : bouton plein, visible.
                  Une seule position par membre — pas de 2e désapprobation/observation
                  une fois la première envoyée (voir `monObservation` ci-dessus). */}
              {!pvSealed && !mySignatureReal && !obsOuvert && !monObservation && (
                <button
                  onClick={() => setObsOuvert(true)}
                  className="mb-2 w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-2.5 text-[13px] font-bold text-red-700 active:scale-[0.98] transition"
                >
                  <ThumbsDown className="h-4 w-4" /> Désapprouver ou émettre une réserve
                </button>
              )}

              {obsOuvert && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                  <textarea
                    value={obsTexte}
                    onChange={(e) => setObsTexte(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    placeholder="Votre réserve, votre désaccord ou votre demande de correction. Visible de tous les membres et du Secrétariat."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => envoyerObservation("desapprobation")}
                      disabled={obsBusy || !obsTexte.trim()}
                      className="flex-1 rounded-lg bg-red-600 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                    >
                      {obsBusy ? "Envoi…" : "Désapprouver"}
                    </button>
                    <button
                      onClick={() => envoyerObservation("observation")}
                      disabled={obsBusy || !obsTexte.trim()}
                      className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-[12px] font-semibold text-navy disabled:opacity-50"
                    >
                      Simple observation
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setObsOuvert(false);
                      setObsTexte("");
                    }}
                    className="mt-1.5 w-full py-1 text-[11px] text-slate-500"
                  >
                    Annuler
                  </button>
                </div>
              )}

              {observationsCourantes.length === 0 ? (
                <div className="mt-2 text-[11px] italic text-slate-400">
                  Aucune observation. Signer le PV vaut approbation ; une observation permet
                  d'exprimer une réserve visible de tous.
                </div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {observationsCourantes.map((o) => (
                    <li
                      key={o.id}
                      className={`rounded-lg border p-2.5 text-[12px] ${
                        o.type === "desapprobation"
                          ? "border-red-200 bg-red-50/50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            o.type === "desapprobation"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {o.type === "desapprobation" ? "Désapprouve" : "Observation"}
                        </span>
                        <span className="font-semibold text-navy">{o.auteurNom ?? "—"}</span>
                        <span className="ml-auto text-[10px] text-slate-400">
                          {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-700 whitespace-pre-wrap">{o.texte}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              Signatures électroniques
            </div>
            <div className="mt-2 space-y-2">
              {presentUsers.map((u) => {
                const sig = realPv?.signatures.find(
                  (s) => s.userId === u.id && s.pvVersion === realPv.version,
                );
                if (sig) {
                  return (
                    <SignatureRow
                      key={u.id}
                      you={u.id === profile?.id}
                      s={{
                        userId: u.id,
                        nom: u.nom,
                        qualite: u.estPresidentCA
                          ? "Président du Conseil d'Administration"
                          : (u.qualite ?? ROLE_LABELS[u.role].label),
                        methode: METHODE_LABEL[sig.methode],
                        imageBase64: sig.imageBase64,
                        timestamp: sig.signedAt,
                        hash: sig.hash ?? "",
                      }}
                    />
                  );
                }
                // Un membre qui a désapprouvé/émis une réserve n'a pas simplement
                // « pas encore signé » : le statut doit refléter sa position réelle.
                // Sur la manche courante uniquement : après un renvoi, chacun
                // repart « En attente » sur le nouveau texte.
                const obsUser = observationsCourantes.find((o) => o.userId === u.id);
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between text-[12px] px-1 py-1.5"
                  >
                    <div className="text-slate-500 flex items-center gap-1">
                      {u.nom} {u.estPresidentCA && <Crown className="h-3 w-3 text-gold" />}
                    </div>
                    {obsUser?.type === "desapprobation" ? (
                      <div className="inline-flex items-center gap-1 text-red-600 text-[11px] font-semibold">
                        <ThumbsDown className="h-3 w-3" /> Désapprouvé
                      </div>
                    ) : obsUser ? (
                      <div className="inline-flex items-center gap-1 text-amber-600 text-[11px] font-semibold">
                        <ThumbsDown className="h-3 w-3" /> Réserve émise
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                        <Clock className="h-3 w-3" /> En attente
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Signatures reçues : {realSignedCount}/{realTotalPresents}
                </span>
                <span className="font-semibold text-navy">{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold to-yellow-600 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardBookScreen({
  nav,
  sub,
  data,
  realReunions,
  boardBookReunion,
  profile,
  requireOnline,
  partenaireProcuration,
}: {
  nav: (v: View) => void;
  sub?: string;
  data?: any;
  realReunions: Reunion[];
  boardBookReunion: Reunion | null;
  profile: CaUser | null;
  requireOnline: (label?: string) => boolean;
  partenaireProcuration: (reunionId?: string | null) => { userId: string; nom: string } | undefined;
}) {
  type BBDoc = {
    id: string;
    nom: string;
    type: DocType;
    tailleBytes: number;
    pages: number | null;
    storagePath: string | null;
    pointOjId: string | null;
  };
  // Chaque réunion est un « dossier » : l'écran affiche le Board Book de la
  // réunion passée en navigation, pas une réunion devinée globalement.
  const reunion = realReunions.find((r) => r.id === data?.reunionId) ?? boardBookReunion!;
  const [docs, setDocs] = useState<BBDoc[]>([]);
  const [bb, setBb] = useState<{
    id: string;
    pages: number | null;
    tailleBytes: number | null;
    storagePath: string | null;
    genereAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // Incrémenté par le canal Realtime : le Board Book généré par le
  // secrétariat doit apparaître sans que le membre recharge l'app.
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const canal = supabase
      .channel(`boardca:bb:${reunion.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "board_books",
          filter: `reunion_id=eq.${reunion.id}`,
        },
        () => setRev((n) => n + 1),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `reunion_id=eq.${reunion.id}`,
        },
        () => setRev((n) => n + 1),
      )
      // Resynchro sur reconnexion : voir src/lib/notifications.ts.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRev((n) => n + 1);
      });
    return () => {
      supabase.removeChannel(canal);
    };
  }, [reunion.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase
        .from("documents")
        .select("id, nom, type, taille_bytes, pages, storage_path, point_oj_id")
        .eq("reunion_id", reunion.id),
      supabase
        .from("board_books")
        .select("id, pages, taille_bytes, storage_path, genere_at")
        .eq("reunion_id", reunion.id)
        .maybeSingle(),
    ]).then(([docsRes, bbRes]) => {
      if (cancelled) return;
      setDocs(
        ((docsRes.data ?? []) as any[]).map((d) => ({
          id: d.id,
          nom: d.nom,
          type: normaliserDocType(d.type),
          tailleBytes: d.taille_bytes ?? 0,
          pages: d.pages,
          storagePath: d.storage_path,
          pointOjId: d.point_oj_id,
        })),
      );
      const b = bbRes.data as any;
      setBb(
        b
          ? {
              id: b.id,
              pages: b.pages,
              tailleBytes: b.taille_bytes,
              storagePath: b.storage_path,
              genereAt: b.genere_at,
            }
          : null,
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reunion.id, rev]);

  // Annotations réelles de tous les documents de la réunion : les miennes
  // (privées + partagées) et celles partagées par les autres, filtrées par RLS.
  const [annos, setAnnos] = useState<DocAnnotation[]>([]);
  const docIds = docs.map((d) => d.id).join(",");
  const bbId = bb?.id ?? null;
  useEffect(() => {
    if (!docIds && !bbId) {
      setAnnos([]);
      return;
    }
    let cancelled = false;
    fetchAnnotationsDeLaSeance(docIds ? docIds.split(",") : [], bbId)
      .then((a) => !cancelled && setAnnos(a))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [docIds, bbId]);
  const docNomById = Object.fromEntries(docs.map((d) => [d.id, d.nom]));

  const openDoc = async (d: BBDoc) => {
    if (!d.storagePath) {
      toast.error("Fichier indisponible");
      return;
    }
    if (!requireOnline("Ouverture du document")) return;
    // PDF → lecteur intégré annotable ; image → visionneuse intégrée (zoom).
    // Les autres formats (docx, xlsx…) n'ont rien à rendre en interne : on les
    // délègue au navigateur via une URL signée.
    if (d.type === "pdf" || d.type === "image") {
      nav({
        tab: "boardbook",
        sub: d.type === "pdf" ? "viewer" : "image",
        data: { reunionId: reunion.id, documentId: d.id, nom: d.nom, storagePath: d.storagePath },
      });
      return;
    }
    setOpeningId(d.id);
    try {
      const { data } = await supabase.storage
        .from("boardca-docs")
        .createSignedUrl(d.storagePath, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      else toast.error("Lien indisponible");
    } finally {
      setOpeningId(null);
    }
  };

  if (sub === "viewer" && data?.storagePath)
    return (
      <PdfViewerScreen
        cible={{ documentId: data.documentId }}
        nom={data.nom}
        storagePath={data.storagePath}
        partenaire={partenaireProcuration(data.reunionId ?? reunion.id)}
        onBack={() => nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } })}
        profile={profile}
      />
    );

  if (sub === "image" && data?.storagePath)
    return (
      <ImageViewerScreen
        nom={data.nom}
        storagePath={data.storagePath}
        onBack={() => nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } })}
      />
    );

  if (sub === "annotations")
    return (
      <AnnotationsPanel
        annotations={annos}
        docNomById={docNomById}
        userId={profile?.id ?? ""}
        onBack={() => nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } })}
        onOpenAnnotation={(a) => {
          // Annotations héritées du temps où le recueil était un PDF unique : ce
          // document n'existe plus, on ramène au sommaire de la séance.
          if (a.boardBookId) {
            nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } });
            return;
          }
          const d = docs.find((x) => x.id === a.documentId);
          if (d?.storagePath && d.type === "pdf")
            nav({
              tab: "boardbook",
              sub: "viewer",
              data: {
                reunionId: reunion.id,
                documentId: d.id,
                nom: d.nom,
                storagePath: d.storagePath,
              },
            });
          else nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } });
        }}
        onDeleted={(id) => setAnnos((prev) => prev.filter((a) => a.id !== id))}
      />
    );

  const annCount = annos.length;
  const extStyle = TYPE_BADGE;
  const fmtSize = (b: number) =>
    b < 1024 * 1024
      ? `${Math.max(1, Math.round(b / 1024))} Ko`
      : `${(b / 1024 / 1024).toFixed(1)} Mo`;
  const statusMeta =
    reunion.statut === "en_cours"
      ? { bg: "#FEE2E2", color: "#DC2626", label: "EN COURS" }
      : reunion.statut === "terminee"
        ? { bg: "#F1F5F9", color: "#64748B", label: "TERMINÉE" }
        : { bg: "#E0F2FE", color: "#0369A1", label: "À VENIR" };

  // Le Board Book EST l'ordre du jour : chaque point, puis les documents qui lui
  // sont rattachés — aucun fichier unique compilé, chaque pièce s'ouvre seule.
  // Les fichiers orphelins (sans point) n'entrent pas dans le recueil.
  const points = [...reunion.ordreDuJour].sort((a, b) => a.position - b.position);
  const docsDuPoint = (pointId: string) => docs.filter((d) => d.pointOjId === pointId);
  const nbRattaches = points.reduce((n, p) => n + docsDuPoint(p.id).length, 0);
  const recueilPret = !!bb;

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-20 relative">
      <TopBar title="Board Book" onBack={() => nav({ tab: "boardbook" })} />
      <div className="px-5 py-4">
        <div
          className="bg-white rounded-xl p-4 border-l-4 border-[#C9A84C]"
          style={{ boxShadow: "0 2px 12px rgba(13,27,62,0.08)" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Séance concernée
            </div>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: statusMeta.bg, color: statusMeta.color }}
            >
              <CircleDot className="h-2.5 w-2.5" /> {statusMeta.label}
            </span>
          </div>
          <div className="mt-1 font-bold text-[#0D1B3E] text-[15px] leading-tight">
            {reunion.titre}
          </div>
          <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />{" "}
            {new Date(reunion.date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {reunion.heure ? ` · ${reunion.heure}` : ""}
          </div>
          <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> {points.length} point(s) à l'ordre du jour ·{" "}
            {nbRattaches} document{nbRattaches > 1 ? "s" : ""}
          </div>
        </div>

        {loading ? (
          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-400 py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Synchronisation…
          </div>
        ) : !recueilPret ? (
          <div className="mt-8 flex flex-col items-center text-center gap-3 px-6">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-navy">Board Book en préparation</div>
            <div className="text-xs text-slate-500 max-w-[250px]">
              Le secrétariat n'a pas encore publié le recueil de cette séance.
            </div>
          </div>
        ) : (
          /* Le recueil : l'ordre du jour, point par point, avec ses documents. */
          <div className="mt-5 space-y-4">
            {/* AJOUT : PDF compilé (sommaire + points & fichiers), quand le
                secrétariat l'a généré. La liste par point ci-dessous reste. */}
            {bb?.storagePath && (
              <button
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from("boardca-docs")
                    .createSignedUrl(bb.storagePath!, 3600);
                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                  else toast.error("PDF indisponible");
                }}
                className="w-full text-left rounded-2xl bg-gradient-to-br from-navy to-navy-light text-white p-4 flex items-center gap-3 shadow-lg active:scale-[0.98] transition"
              >
                <div className="h-11 w-11 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">Board Book — PDF complet</div>
                  <div className="text-[11px] text-white/70 mt-0.5">
                    Sommaire + tous les documents{bb.pages ? ` · ${bb.pages} pages` : ""}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/50 shrink-0" />
              </button>
            )}
            {points.map((p) => {
              const pieces = docsDuPoint(p.id);
              return (
                <section key={p.id}>
                  <header className="flex items-start gap-2 pb-1.5 mb-2 border-b border-[#F1F5F9]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-navy text-gold text-[10px] font-bold">
                      {p.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13px] font-semibold text-[#0D1B3E] leading-snug">
                        {p.titre}
                      </h3>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        {pieces.length === 0
                          ? "Aucun document"
                          : `${pieces.length} document${pieces.length > 1 ? "s" : ""}`}
                      </div>
                    </div>
                  </header>

                  {pieces.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#E2E8F0] py-3 text-center text-[11px] text-slate-400">
                      Aucune pièce rattachée à ce point.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pieces.map((d) => {
                        const style = extStyle[d.type] ?? extStyle.autre;
                        return (
                          <button
                            key={d.id}
                            onClick={() => openDoc(d)}
                            className="w-full bg-white rounded-xl p-3 flex items-center gap-3 border border-[#F1F5F9] active:scale-[0.99] transition"
                          >
                            <div
                              className={`h-11 w-11 rounded-lg ${style.bg} text-white flex flex-col items-center justify-center shrink-0`}
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-[8px] font-bold leading-none mt-0.5">
                                {style.label}
                              </span>
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="text-[14px] font-semibold text-[#0D1B3E] truncate">
                                {d.nom}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {fmtSize(d.tailleBytes)}
                                {d.pages ? ` · ${d.pages} page(s)` : ""}
                              </div>
                            </div>
                            {openingId === d.id ? (
                              <Loader2 className="h-4 w-4 text-[#CBD5E1] shrink-0 animate-spin" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-[#CBD5E1] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <div className="absolute bottom-[52px] left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-[#F1F5F9] px-4 py-2.5 flex items-center gap-2 z-20">
        <button
          onClick={() =>
            nav({ tab: "boardbook", sub: "annotations", data: { reunionId: reunion.id } })
          }
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#0D1B3E] text-white text-[12px] font-semibold active:scale-[0.98]"
        >
          <PenLine className="h-4 w-4" /> Mes annotations ({annCount})
        </button>
      </div>
    </div>
  );
}

function PdfViewerScreen({
  cible,
  nom,
  storagePath,
  partenaire,
  onBack,
  profile,
}: {
  cible: AnnotationCible;
  nom: string;
  storagePath: string;
  /** Binôme mandant/mandataire actif — voir `partenaireProcuration`. */
  partenaire?: { userId: string; nom: string };
  onBack: () => void;
  profile: CaUser | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("boardca-docs")
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.signedUrl) setUrl(data.signedUrl);
        else setEchec(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-24">
      <TopBar title={nom} onBack={onBack} />
      {/* Marges réduites : la page doit occuper le maximum de largeur. */}
      <div className="px-2 py-3">
        {echec ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Lien du document indisponible.
          </div>
        ) : !url || !profile ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Préparation du document…
          </div>
        ) : (
          <PdfAnnotator
            cible={cible}
            url={url}
            userId={profile.id}
            partageAvecUserId={partenaire?.userId}
            partageAvecNom={partenaire?.nom}
          />
        )}
      </div>
    </div>
  );
}

function ImageViewerScreen({
  nom,
  storagePath,
  onBack,
}: {
  nom: string;
  storagePath: string;
  onBack: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("boardca-docs")
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.signedUrl) setUrl(data.signedUrl);
        else setEchec(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  const zoomer = (delta: number) =>
    setZoom((z) => Math.min(4, Math.max(0.5, Math.round((z + delta) * 100) / 100)));

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-24">
      <TopBar title={nom} onBack={onBack} />
      <div className="px-2 py-3 space-y-3">
        {echec ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Lien du document indisponible.
          </div>
        ) : !url ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Préparation de l'image…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2">
              <button
                onClick={() => zoomer(-0.25)}
                disabled={zoom <= 0.5}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40"
                aria-label="Réduire"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-navy tabular-nums px-2 py-1 rounded-lg hover:bg-slate-50"
                title="Ajuster à la largeur"
              >
                <Maximize2 className="h-3.5 w-3.5 text-slate-400" />
                {Math.round(zoom * 100)} %
              </button>
              <button
                onClick={() => zoomer(0.25)}
                disabled={zoom >= 4}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40"
                aria-label="Agrandir"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-1 overflow-auto">
              <img
                src={url}
                alt={nom}
                className="block rounded-lg"
                style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ===== Sub-screens & helpers ===== */


// Gros bouton de vote (Oui / Non / Abstention) sur l'écran de scrutin mobile.
function BigVoteBtn({
  label,
  color,
  icon: Icon,
  onClick,
}: {
  label: string;
  color: "emerald" | "red" | "slate";
  icon: any;
  onClick: () => void;
}) {
  const tons = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return (
    <button
      onClick={onClick}
      className={`py-4 rounded-xl border-2 flex flex-col items-center gap-1.5 active:scale-[0.97] transition ${tons[color]}`}
    >
      <Icon className="h-6 w-6" />
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

// Barre de résultat d'un scrutin (dépouillement en direct).
function ResultBar({
  label,
  count,
  pct,
  color,
}: {
  label: string;
  count: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="font-semibold text-navy">{label}</span>
        <span className="text-slate-500">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ===== Annotations ===== */

// Liste réelle des annotations du Board Book : les miennes (privées + partagées)
// et les commentaires partagés des autres membres, selon la RLS de `annotations`.
function AnnotationsPanel({
  annotations,
  docNomById,
  userId,
  onBack,
  onOpenAnnotation,
  onDeleted,
}: {
  annotations: DocAnnotation[];
  docNomById: Record<string, string>;
  userId: string;
  onBack: () => void;
  onOpenAnnotation: (a: DocAnnotation) => void;
  onDeleted: (id: string) => void;
}) {
  type Filtre = "all" | "highlight" | "comment" | "private" | "public";
  const [filter, setFilter] = useState<Filtre>("all");
  const [q, setQ] = useState("");

  const correspond = (a: DocAnnotation) =>
    filter === "all" ||
    (filter === "highlight" || filter === "comment" ? a.type === filter : a.visibility === filter);

  const filtered = annotations.filter(
    (a) =>
      correspond(a) && (!q || `${a.texte} ${a.note ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );

  const del = async (id: string) => {
    try {
      await deleteAnnotation(id);
      onDeleted(id);
      toast.success("Annotation supprimée");
    } catch {
      toast.error("Suppression impossible");
    }
  };

  const LIBELLE: Record<Filtre, string> = {
    all: "Toutes",
    highlight: "Surlignages",
    comment: "Commentaires",
    private: "Privées",
    public: "Partagées",
  };

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-6">
      <TopBar title="Mes annotations" onBack={onBack} />
      <div className="px-4 py-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="w-full bg-white rounded-lg pl-8 pr-3 py-2 text-[13px] border border-slate-200 outline-none"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(["all", "highlight", "comment", "private", "public"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${filter === k ? "bg-[#0D1B3E] text-white" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              {LIBELLE[k]}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center">
              <AlertCircle className="h-6 w-6 text-slate-300 mx-auto" />
              <div className="mt-2 text-sm font-semibold text-navy">Aucune annotation</div>
              <div className="mt-1 text-[11px] text-slate-500">
                Ouvrez un PDF du Board Book et sélectionnez un passage pour l'annoter.
              </div>
              <button
                onClick={onBack}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0D1B3E] text-white text-[12px] font-semibold"
              >
                <BookOpen className="h-4 w-4" /> Ouvrir le Board Book
              </button>
            </div>
          ) : (
            filtered.map((a) => (
              <article key={a.id} className="bg-white rounded-xl p-3 border border-slate-100">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider">
                  {a.type === "highlight" ? (
                    <span className="text-yellow-700">Surlignage</span>
                  ) : (
                    <span className="text-blue-700">Commentaire</span>
                  )}
                  {a.visibility === "private" ? (
                    <span className="text-slate-500 flex items-center gap-1 normal-case font-semibold">
                      <Lock className="h-3 w-3" /> Privé
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1 normal-case font-semibold">
                      <Users className="h-3 w-3" /> Partagé
                    </span>
                  )}
                  <span className="ml-auto text-slate-400 normal-case font-normal">
                    {new Date(a.createdAt).toLocaleDateString("fr-FR")} · {a.auteurNom ?? "—"}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1 italic">« {a.texte} »</div>
                {a.note && (
                  <div className="mt-2 text-sm text-navy bg-slate-50 rounded-md p-2">{a.note}</div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-[10px] text-slate-400 truncate min-w-0 flex-1">
                    {a.boardBookId
                      ? "Board Book"
                      : (a.documentId && docNomById[a.documentId]) || "Document"}{" "}
                    · page {a.page}
                  </div>
                  <button
                    onClick={() => onOpenAnnotation(a)}
                    className="text-[11px] text-navy font-semibold px-2 py-1 rounded shrink-0"
                  >
                    Voir dans le document
                  </button>
                  {a.userId === userId && (
                    <button
                      onClick={() => del(a.id)}
                      aria-label="Supprimer l'annotation"
                      className="text-[11px] text-red-600 font-semibold p-1.5 rounded shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

