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
import { ProcurationScreen } from "./screens/procuration-screen";
import { ConvocationScreen } from "./screens/convocation-screen";
import { VoteScreen } from "./screens/vote-screen";
import { VoteResultScreen } from "./screens/vote-result-screen";
import { BoardBookScreen } from "./screens/board-book-screen";
import { PVScreen } from "./screens/pvscreen";
import { ImageViewerScreen } from "./screens/image-viewer-screen";
import { PdfViewerScreen } from "./screens/pdf-viewer-screen";
import { AnnotationsPanel } from "./shared/annotations-panel";
import { NotifBadge } from "./shared/notif-badge";
import { BigVoteBtn } from "./shared/big-vote-btn";
import { ResultBar } from "./shared/result-bar";
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









  // « Board Book » = un dossier par réunion : l'ordre du jour, et sous chaque
  // point les documents qui s'y rattachent. Il n'y a pas de PDF unique compilé —
  // chaque pièce s'ouvre séparément. Une réunion a son recueil « disponible » dès
  // que le secrétariat l'a publié (ligne dans `board_books`).



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





/* ===== Sub-screens & helpers ===== */


// Gros bouton de vote (Oui / Non / Abstention) sur l'écran de scrutin mobile.

// Barre de résultat d'un scrutin (dépouillement en direct).

/* ===== Annotations ===== */

// Liste réelle des annotations du Board Book : les miennes (privées + partagées)
// et les commentaires partagés des autres membres, selon la RLS de `annotations`.

