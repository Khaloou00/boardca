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
import { CalendrierScreen } from "./screens/calendrier-screen";
import { SeancesScreen } from "./screens/seances-screen";

// Rendu d'une notification selon l'événement métier qui l'a produite.
const NOTIF_META: Record<NotificationType, { icon: any; color: string }> = {
  convocation: { icon: Send, color: "bg-navy text-white" },
  vote: { icon: VoteIcon, color: "bg-navy text-white" },
  pv: { icon: FileSignature, color: "bg-gold text-gold-foreground" },
  action: { icon: ClipboardCheck, color: "bg-emerald-500 text-white" },
  document: { icon: FileText, color: "bg-sky-500 text-white" },
  board_book: { icon: BookOpen, color: "bg-emerald-500 text-white" },
  discussion: { icon: MessageSquare, color: "bg-slate-600 text-white" },
  jeton: { icon: Coins, color: "bg-gold text-gold-foreground" },
  delegation: { icon: Crown, color: "bg-navy text-white" },
  consultation: { icon: MailCheck, color: "bg-amber-500 text-white" },
};

// Un type ajouté en base (contrainte `notifications_type_check`) mais pas encore
// ici ne doit pas faire tomber tout l'écran Alertes : on retombe sur une cloche.
const metaDe = (type: string) =>
  NOTIF_META[type as NotificationType] ?? { icon: Bell, color: "bg-slate-500 text-white" };

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




const AGENDA_POINTS = [
  { n: 1, title: "Approbation du PV du 25 Juin 2026", pages: 8, file: "PV Juin 2026" },
  { n: 2, title: "Rapport financier Q3 2026", pages: 24, file: "Rapport financier Q3" },
  { n: 3, title: "Plan Stratégique 2026-2030", pages: 32, file: "Plan Stratégique" },
  { n: 4, title: "Budget modificatif Q3", pages: 18, file: "Budget modificatif" },
  { n: 5, title: "Questions diverses", pages: 4, file: "Questions diverses" },
];

const PV_SIGNERS = [
  { id: "USR-002", nom: "Touré Mamadou", qualite: "Ministère de l'Économie" },
  { id: "USR-003", nom: "Ouattara Seydou", qualite: "Présidence de la République" },
  { id: "USR-004", nom: "Yao Désiré", qualite: "Ministère des Infrastructures" },
  { id: "USR-005", nom: "Coulibaly Fatou", qualite: "Conseil d'État" },
  { id: "USR-006", nom: "Traoré Issouf", qualite: "Cour des Comptes" },
  { id: "USR-007", nom: "Koffi Ama", qualite: "DG BNETD" },
  { id: "USR-008", nom: "Bah Aliou", qualite: "Personnel BNETD" },
  { id: "USR-009", nom: "Meité Souleymane", qualite: "Ministère du Plan" },
];

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
      <MobileAdminAppScreen />
    </NotificationsProvider>
  );
}

function MobileAdminAppScreen() {
  const [view, setView] = useState<View>(() => lireVueEnregistree()?.view ?? { tab: "home" });
  const navigate = useNavigate();
  const logout = useBoardStore((s) => s.logout);
  const { meetings, votes, currentUser, updateMeeting, castVote, log } = useApp();
  const meeting = meetings[0];

  // Données réelles (Supabase) pour le PV et les signatures de la réunion démo.
  const {
    profile,
    users: realUsers,
    presences: realPresences,
    pvs: realPvs,
    procurations: realProcurations,
    usersLoading,
    presencesLoading,
    pvLoading,
  } = useBoardStore(
    useShallow((s) => ({
      profile: s.profile,
      users: s.users,
      presences: s.presences,
      pvs: s.pvs,
      procurations: s.procurations,
      usersLoading: s.usersLoading,
      presencesLoading: s.presencesLoading,
      pvLoading: s.pvLoading,
    })),
  );
  // Tant que ces trois fetches n'ont pas au moins tourné une fois, les dérivés
  // (présents, signatures, éligibilité au sceau PCA) ne sont pas fiables — un
  // rendu prématuré peut par ex. évaluer "tout le monde a signé" sur une liste
  // de présents encore incomplète.
  const pvDataReady = !usersLoading && !presencesLoading && !pvLoading && realUsers.length > 0;
  const setReunionActive = useBoardStore((s) => s.setReunionActive);
  const signPV = useBoardStore((s) => s.signPV);
  const scanPresence = useBoardStore((s) => s.scanPresence);

  // TOUTES les actions du Conseil : depuis la migration 034, un membre du CA
  // (administrateur) supervise l'exécution des décisions et lit l'avancement des
  // actions confiées à chaque responsable (RLS `actions_read_scope`). Un membre
  // peut toujours mettre à jour SES propres actions (RLS `actions_update_responsable`).
  const allActions = useBoardStore(useShallow((s) => s.actions));
  const soumettreRapportAction = useBoardStore((s) => s.soumettreRapportAction);
  const actionsEnRetardGlobal = allActions.filter(
    (a) =>
      a.statut !== "terminee" &&
      a.avancement < 100 &&
      a.echeance &&
      a.echeance < new Date().toLocaleDateString("en-CA"),
  ).length;

  // Aperçu d'avancement des actions du Conseil, pour la carte « Suivi des actions »
  // de l'accueil : répartition par état + avancement moyen. Même règle d'état que
  // l'écran de détail (terminée / en retard / en cours) pour une lecture cohérente.
  const actionsApercu = useMemo(() => {
    const auj = new Date().toLocaleDateString("en-CA");
    const etat = (a: (typeof allActions)[number]) =>
      a.statut === "terminee" || a.avancement >= 100
        ? "terminee"
        : a.echeance && a.echeance < auj
          ? "en_retard"
          : "en_cours";
    const total = allActions.length;
    const terminees = allActions.filter((a) => etat(a) === "terminee").length;
    const enRetard = allActions.filter((a) => etat(a) === "en_retard").length;
    const enCours = total - terminees - enRetard;
    const moyen = total ? Math.round(allActions.reduce((s, a) => s + a.avancement, 0) / total) : 0;
    return { total, terminees, enRetard, enCours, moyen };
  }, [allActions]);

  // Consultations écrites hors séance (migration 031). Rechargées à la demande :
  // un membre y répond une seule fois, la réponse est immuable.
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const rechargerConsultations = useCallback(() => {
    fetchConsultations()
      .then(setConsultations)
      .catch(() => undefined);
  }, []);
  useEffect(rechargerConsultations, [rechargerConsultations]);
  // « À traiter » = ouverte, dans les délais, et je n'ai pas encore répondu.
  const consultationsATraiter = consultations.filter(
    (c) => peutRepondre(c) && !c.reponses.some((r) => r.userId === profile?.id),
  ).length;

  const { realReunions, allConvocations } = useBoardStore(
    useShallow((s) => ({ realReunions: s.reunions, allConvocations: s.convocations })),
  );

  const isGuest = profile?.role === "invite";

  // La vue restaurée au chargement l'a été AVANT que le profil ne soit connu
  // (le `useState` initial ne peut pas l'attendre). On la valide ici, une fois
  // l'identité résolue, et on retombe sur l'Accueil dans les deux cas où la
  // restauration n'aurait pas de sens :
  //   - elle appartient à un AUTRE compte (bascule de profil via RoleSwitcher,
  //     fréquente en démo) ;
  //   - c'est un onglet interdit à l'invité (sa barre n'a que Accueil/Board
  //     Book/Alertes — sans ce garde il atterrirait sur un écran qui ne le
  //     concerne pas, avec des listes vides par RLS).
  const idProfil = profile?.id;
  useEffect(() => {
    if (!idProfil) return; // profil pas encore chargé : on ne tranche pas
    const enregistre = lireVueEnregistree();
    if (!enregistre) return;
    const autreCompte = !!enregistre.userId && enregistre.userId !== idProfil;
    const ongletInterdit =
      isGuest && !["home", "boardbook", "notifs"].includes(enregistre.view.tab);
    if (autreCompte || ongletInterdit) {
      setView({ tab: "home" });
      window.localStorage.setItem(
        CLE_VUE,
        JSON.stringify({ userId: idProfil, view: { tab: "home" } }),
      );
    }
  }, [idProfil, isGuest]);

  // Réunions où l'invité a un mandat actif. `reunions_read_auth` reste ouverte
  // à tout authentifié (comme pour les 4 autres rôles, non touché — voir
  // migration RLS) : ce filtre protège l'EXPÉRIENCE côté client, les actions
  // réelles (vote/signature/présence) restent de toute façon bornées par les
  // policies `*_by_guest` en base, indépendamment de ce que l'UI affiche ici.
  type MandatGuest = { reunionId: string; deUserId: string };
  const [mesMandats, setMesMandats] = useState<MandatGuest[]>([]);
  const [mandatsCharges, setMandatsCharges] = useState(false);
  useEffect(() => {
    if (!profile || !isGuest) {
      setMesMandats([]);
      setMandatsCharges(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("procurations")
      .select("reunion_id, de_user_id")
      .eq("vers_user_id", profile.id)
      .eq("statut", "active")
      .then(({ data }) => {
        if (cancelled) return;
        setMesMandats(
          (data ?? []).map((r) => ({ reunionId: r.reunion_id, deUserId: r.de_user_id })),
        );
        setMandatsCharges(true);
      });
    return () => {
      cancelled = true;
    };
  }, [profile, isGuest]);

  // Le membre représenté pour une réunion donnée — undefined hors mandat actif
  // (les écrans retombent alors sur `profile.id`, la RLS refusera l'action).
  const mandantPour = useCallback(
    (reunionId?: string | null) => mesMandats.find((m) => m.reunionId === reunionId)?.deUserId,
    [mesMandats],
  );

  // Sens inverse : le mandataire que MOI (membre du CA) j'ai désigné pour une
  // réunion donnée — sert à proposer le partage d'annotation avec lui, et à
  // masquer "Confirmer ma présence"/"Envoyer une procuration" une fois désigné
  // (voir ConvocationScreen). Exposé via une fonction nommée (pas juste un
  // effet) pour pouvoir la rappeler explicitement juste après une désignation
  // réussie : sans ça, ce state ne se rafraîchissait qu'au remount/rechargement
  // de page, ce qui laissait les deux boutons actifs pendant toute la session
  // en cours après une procuration — c'était le bug rapporté.
  type DelegationSortante = { reunionId: string; versUserId: string };
  const [mesDelegations, setMesDelegations] = useState<DelegationSortante[]>([]);
  const chargerMesDelegations = useCallback(async () => {
    if (!profile || isGuest) {
      setMesDelegations([]);
      return;
    }
    const { data } = await supabase
      .from("procurations")
      .select("reunion_id, vers_user_id")
      .eq("de_user_id", profile.id)
      .eq("statut", "active");
    setMesDelegations(
      (data ?? []).map((r) => ({ reunionId: r.reunion_id, versUserId: r.vers_user_id })),
    );
  }, [profile, isGuest]);
  useEffect(() => {
    chargerMesDelegations();
  }, [chargerMesDelegations]);

  // Un invité n'agit JAMAIS sur « la première réunion en_cours du système »
  // comme un membre normal — seulement sur celles où il a un mandat.
  const reunionsPourEcrans = isGuest
    ? realReunions.filter((r) => mesMandats.some((m) => m.reunionId === r.id))
    : realReunions;

  // Fenêtre d'accès de l'invité : désignation → clôture de LA réunion représentée,
  // sans délai de grâce après (même règle que `private.is_active_guest()` côté
  // RLS, recalculée ici en confort d'affichage — le filet réel reste le serveur).
  // L'espace se ferme dès la clôture : plus de droit de signer le PV à la place
  // du membre représenté après coup, ça n'a pas de sens si l'accès est fermé.
  // `false` tant que les mandats n'ont pas fini de charger, pour ne jamais
  // flasher l'écran « accès fermé » à un invité valide.
  const accesInviteExpire =
    isGuest &&
    mandatsCharges &&
    !mesMandats.some((m) => {
      const r = realReunions.find((x) => x.id === m.reunionId);
      if (!r) return false;
      return !r.cloutureeAt;
    });

  // "Prochaine séance" = uniquement les réunions à venir dont CET utilisateur a
  // CONFIRMÉ sa présence. On lit ses convocations (toutes réunions) jointes aux
  // réunions ; re-fetch quand ses convocations changent (après confirmation).
  type SeanceConfirmee = {
    id: string;
    titre: string;
    type: string;
    date: string;
    heure: string | null;
    lieu: string | null;
  };
  type MaConvocation = SeanceConfirmee & { statut: string };
  // Une seule requête pour TOUTES mes convocations à venir : on en dérive à la
  // fois les séances confirmées et la convocation encore en attente de réponse.
  const [mesConvocations, setMesConvocations] = useState<MaConvocation[]>([]);
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    supabase
      .from("convocations")
      .select("statut, reunions(id, titre, type, date_reunion, heure, lieu, statut)")
      .eq("user_id", profile.id)
      .then(({ data }) => {
        if (cancelled) return;
        const todayStr = new Date().toLocaleDateString("en-CA");
        const rows = (
          (data ?? []) as unknown as {
            statut: string;
            reunions: {
              id: string;
              titre: string;
              type: string;
              date_reunion: string;
              heure: string | null;
              lieu: string | null;
              statut: string;
            } | null;
          }[]
        )
          // Une séance CLÔTURÉE n'est ni « la prochaine séance », ni une
          // convocation à laquelle répondre — même si sa date est aujourd'hui.
          // Le filtre sur la seule date laissait passer une réunion terminée
          // le jour même.
          .filter(
            (c) =>
              !!c.reunions &&
              c.reunions.statut !== "terminee" &&
              c.reunions.date_reunion >= todayStr,
          )
          .map((c) => ({
            id: c.reunions!.id,
            titre: c.reunions!.titre,
            type: c.reunions!.type,
            date: c.reunions!.date_reunion,
            // "HH:MM:SS" (type `time` Postgres) → "HH:MM", comme mapReunion.
            heure: c.reunions!.heure?.slice(0, 5) ?? null,
            lieu: c.reunions!.lieu,
            statut: c.statut,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setMesConvocations(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, allConvocations]);

  const seancesConfirmees = mesConvocations.filter((c) => c.statut === "confirmed");
  // Convocation à laquelle je n'ai PAS encore répondu, la plus proche. Le bandeau
  // d'accueil doit la cibler, pas simplement « la prochaine séance » : une séance
  // déjà confirmée (ou déjà en cours) masquerait sinon une convocation en attente
  // pour une réunion ultérieure.
  const convocationEnAttente =
    mesConvocations.find((c) => c.statut !== "confirmed" && c.statut !== "excused") ?? null;

  // Réunions résolues dynamiquement (plus d'ID codé en dur) :
  //  - séance à venir  → convocation, délégation de présidence, émargement
  //  - dernière séance tenue → procès-verbal & signatures
  const seanceAVenir = useMemo(() => {
    // Comparaison sur la chaîne "YYYY-MM-DD" (pas d'objet Date) : évite qu'une
    // séance du JOUR même soit écartée à cause du décalage UTC/local.
    const todayStr = new Date().toLocaleDateString("en-CA");
    return [...reunionsPourEcrans]
      .filter((r) => r.statut !== "terminee" && r.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [reunionsPourEcrans]);
  const derniereSeanceTenue = useMemo(
    () =>
      [...reunionsPourEcrans]
        .filter((r) => r.statut === "terminee")
        .sort((a, b) => b.date.localeCompare(a.date))[0],
    [reunionsPourEcrans],
  );
  const seanceEnCours = reunionsPourEcrans.find((r) => r.statut === "en_cours");
  // Board Book : on présente la séance en cours si elle existe, sinon la prochaine
  // séance à venir, sinon la dernière tenue.
  const boardBookReunion = seanceEnCours ?? seanceAVenir ?? derniereSeanceTenue ?? null;
  // Le PV n'est chargé par le bootstrap que pour la réunion ACTIVE (souvent la plus
  // récente par date, pas celle dont le PV attend une signature). Résultat : le membre
  // voyait « Aucun procès-verbal » alors qu'un PV lui était envoyé. On charge donc le PV
  // et les présences de TOUTES les réunions (n petit pour un Conseil), pour retrouver
  // le PV où qu'il soit.
  const reunionIdsKey = reunionsPourEcrans.map((r) => r.id).join(",");
  useEffect(() => {
    if (!profile) return;
    const store = useBoardStore.getState();
    for (const r of reunionsPourEcrans) {
      store.fetchPV(r.id);
      store.fetchPresences(r.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reunionIdsKey, profile?.id]);

  // La séance à traiter pour le PV = celle dont le PV attend ma signature (en_signature),
  // sinon le dernier PV scellé, sinon la dernière séance tenue. Indépendant du statut de
  // la séance : un PV peut être envoyé en signature avant même la bascule « terminée ».
  const pvReunionId = useMemo(() => {
    const parDate = [...reunionsPourEcrans].sort((a, b) => b.date.localeCompare(a.date));
    const pvDe = (statut: string) =>
      parDate.find((r) => realPvs.find((p) => p.reunionId === r.id)?.statut === statut)?.id;
    return pvDe("en_signature") ?? pvDe("signe") ?? derniereSeanceTenue?.id ?? null;
  }, [reunionsPourEcrans, realPvs, derniereSeanceTenue]);
  // Cible des écrans de convocation : la convocation NON RÉPONDUE la plus
  // proche, sinon à défaut la prochaine séance.
  const convocationReunionId = convocationEnAttente?.id ?? seanceAVenir?.id ?? null;

  // Compteurs de l'en-tête, tirés des vraies données.
  const realVotes = useBoardStore((s) => s.votes);
  const castBulletin = useBoardStore((s) => s.castBulletin);
  const fetchVotesStore = useBoardStore((s) => s.fetchVotes);
  const reunionsAVenirCount = realReunions.filter((r) => r.statut !== "terminee").length;
  const votesOuvertsCount = realVotes.filter((v) => v.statut === "ouvert").length;

  const fetchProcurationsStore = useBoardStore((s) => s.fetchProcurations);
  // Les scrutins ouverts vivent dans la séance EN COURS : on charge ses votes
  // (l'active-reunion mobile cible la dernière séance tenue, pour le PV) — et
  // ses procurations, nécessaires au dépouillement pondéré (voteTally).
  useEffect(() => {
    if (seanceEnCours) {
      fetchVotesStore(seanceEnCours.id);
      fetchProcurationsStore(seanceEnCours.id);
    }
  }, [seanceEnCours?.id, fetchVotesStore, fetchProcurationsStore]);

  useEffect(() => {
    if (pvReunionId && useBoardStore.getState().reunionActiveId !== pvReunionId) {
      setReunionActive(pvReunionId);
    }
  }, [setReunionActive, pvReunionId]);

  const fetchConvocations = useBoardStore((s) => s.fetchConvocations);
  const confirmConvocation = useBoardStore((s) => s.confirmConvocation);
  const delegatePresidentSeance = useBoardStore((s) => s.delegatePresidentSeance);
  const addProcuration = useBoardStore((s) => s.addProcuration);
  const inviterExterne = useBoardStore((s) => s.inviterExterne);
  const [convocationsReady, setConvocationsReady] = useState(false);

  useEffect(() => {
    if (!convocationReunionId) {
      setConvocationsReady(true);
      return;
    }
    fetchConvocations(convocationReunionId).then(() => setConvocationsReady(true));
  }, [fetchConvocations, convocationReunionId]);

  const realUsersById = useMemo(
    () => Object.fromEntries(realUsers.map((u) => [u.id, u])),
    [realUsers],
  );
  const currentPCA = realUsers.find((u) => u.estPresidentCA);

  // Binôme mandant/mandataire actif sur une réunion, vu depuis N'IMPORTE
  // LEQUEL des deux : sert à proposer le partage d'annotation ciblé (Board
  // Book/documents/PV). `undefined` si aucun mandat des deux côtés.
  const partenaireProcuration = useCallback(
    (reunionId?: string | null) => {
      const id = isGuest
        ? mandantPour(reunionId)
        : mesDelegations.find((d) => d.reunionId === reunionId)?.versUserId;
      if (!id) return undefined;
      const nom = realUsersById[id]?.nom;
      return nom ? { userId: id, nom } : undefined;
    },
    [isGuest, mandantPour, mesDelegations, realUsersById],
  );

  // La réunion AFFICHÉE dans l'écran de convocation doit être celle sur laquelle
  // agissent confirmation, procuration et délégation (`convocationReunionId`),
  // sinon le PCA délèguerait la présidence d'une autre séance que celle affichée.
  const presidentReunion = realReunions.find((r) => r.id === convocationReunionId) ?? seanceAVenir;
  const presidentConvocations = allConvocations.filter((c) => c.reunionId === convocationReunionId);
  const myConvocation = presidentConvocations.find((c) => c.userId === profile?.id);
  // Une convocation à laquelle on a répondu (confirmée ou excusée) quitte
  // l'Accueil et ne vit plus que dans « Mes convocations ». On se fie au statut
  // en base : les drapeaux de session ne survivent pas à un rechargement.
  const convocationRepondue =
    myConvocation?.statut === "confirmed" || myConvocation?.statut === "excused";
  const pcaConvocation = currentPCA
    ? presidentConvocations.find((c) => c.userId === currentPCA.id)
    : undefined;
  const delegateUser = presidentReunion?.presidentSeanceId
    ? realUsersById[presidentReunion.presidentSeanceId]
    : undefined;
  // Qui a convoqué : le créateur réel de la réunion (secrétaire), sinon rien.
  const convocateurNom = seanceAVenir?.createdBy
    ? realUsersById[seanceAVenir.createdBy]?.nom
    : undefined;
  const confirmedCandidates = presidentConvocations
    .filter((c) => c.statut === "confirmed" && c.userId !== currentPCA?.id)
    .map((c) => realUsersById[c.userId])
    .filter((u): u is NonNullable<typeof u> => !!u);

  // Un invité n'a pas de convocation en propre (`mesConvocations` reste vide —
  // celles-ci appartiennent au mandant) : sa « prochaine séance » est la plus
  // proche parmi celles qu'il représente (`reunionsPourEcrans`, déjà scopée à
  // ses mandats actifs), pas une convocation confirmée par lui-même.
  // Un membre qui a délégué (procuration sortante) n'a pas non plus de
  // convocation "confirmed" à afficher ici — sans ce repli, la carte
  // retombait sur "Aucune séance confirmée" alors qu'il est bien représenté :
  // c'est ce qui permet ensuite de voir le suivi des actions de son mandataire
  // une fois la séance démarrée (ConvocationScreen n'est plus réaccessible une
  // fois la convocation répondue — ce repli reste, lui, toujours visible).
  const prochaineDelegationReunion = useMemo(() => {
    const candidats = mesDelegations
      .map((d) => realReunions.find((r) => r.id === d.reunionId))
      .filter((r): r is NonNullable<typeof r> => !!r && r.statut !== "terminee");
    return [...candidats].sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }, [mesDelegations, realReunions]);
  const prochaineSeance = isGuest
    ? (seanceAVenir ?? null)
    : (seancesConfirmees[0] ?? prochaineDelegationReunion);

  // Réunion affichée par l'écran « Détail de la séance ». L'appelant passe l'id
  // de la séance sur laquelle il a cliqué (`view.data.reunionId`) ; on la résout
  // depuis le store pour disposer de l'ordre du jour. Sans id (retour arrière,
  // lien direct), on retombe sur la séance en cours puis la prochaine à venir.
  // Auparavant l'écran lisait la donnée démo `meetings[0]`, vide pour un vrai
  // membre → « Aucune séance disponible » alors qu'une séance existait.
  const detailReunionId =
    view.sub === "meeting" ? (view.data?.reunionId as string | undefined) : undefined;
  const detailReunion =
    (detailReunionId ? realReunions.find((r) => r.id === detailReunionId) : undefined) ??
    seanceEnCours ??
    seanceAVenir ??
    null;

  const realPv = realPvs.find((p) => p.reunionId === pvReunionId);
  const reunionPresences = realPresences.filter((p) => p.reunionId === pvReunionId);
  const presentUsers = reunionPresences
    .map((p) => realUsersById[p.userId])
    .filter((u): u is NonNullable<typeof u> => !!u);
  // Un PV renvoyé après correction incrémente `version` (RPC `renvoyer_pv`) : les
  // signatures d'une version antérieure restent en base (immuables) mais ne
  // comptent plus — chacun doit (re)signer la version courante.
  const realSignaturesCourantes = (realPv?.signatures ?? []).filter(
    (s) => s.pvVersion === realPv?.version,
  );
  const realSignedIds = new Set(realSignaturesCourantes.map((s) => s.userId));
  const realSignedCount = realSignedIds.size;
  const realTotalPresents = presentUsers.length;
  const isPCA = !!profile?.estPresidentCA; // identité PCA titulaire (convocation, etc.)
  // Pour un invité, « ma » signature/présence sur le PV est celle du membre
  // représenté (même ligne que si le membre avait agi lui-même — voir
  // signPV/effectiveUserId plus bas). Un membre normal n'est pas affecté :
  // `pvIdentiteEffective` retombe alors sur `profile.id`.
  const pvIdentiteEffective = isGuest ? (mandantPour(pvReunionId) ?? profile?.id) : profile?.id;
  const mySignatureReal = realSignaturesCourantes.find((s) => s.userId === pvIdentiteEffective);

  // Président EFFECTIF de la séance (même règle que le trigger DB check_pv_complete) :
  // titulaire présent prime, sinon délégué présent, sinon aucun sceau requis.
  const pvReunion = realReunions.find((r) => r.id === pvReunionId) ?? null;
  const titularPresent = !!currentPCA && presentUsers.some((u) => u.id === currentPCA.id);
  const delegateUserForPv = pvReunion?.presidentSeanceId
    ? presentUsers.find((u) => u.id === pvReunion.presidentSeanceId)
    : undefined;
  const effectiveSealer = titularPresent ? currentPCA : delegateUserForPv;
  const isEffectiveSealer = !!effectiveSealer && effectiveSealer.id === profile?.id;

  const otherPresentUsers = presentUsers.filter((u) => u.id !== effectiveSealer?.id);
  // .every() sur un tableau vide renvoie true par vacuité : tant que les présences
  // n'ont pas fini de charger (ou s'il n'y a aucun autre présent), on ne doit
  // jamais en déduire "tout le monde a signé".
  const othersAllSigned =
    otherPresentUsers.length > 0 && otherPresentUsers.every((u) => realSignedIds.has(u.id));
  const canSeal = isEffectiveSealer && !mySignatureReal && othersAllSigned;
  const waitingToSeal = isEffectiveSealer && !mySignatureReal && !othersAllSigned;
  const pvSealed = realPv?.statut === "signe";

  // Un PV attend MON action quand il est en signature, que je suis présent (seuls les
  // présents signent) et que je n'ai pas encore signé. Le président de séance ne compte
  // que lorsque son tour est venu (canSeal) : c'est lui qui scelle en dernier.
  const iSuisPresent = presentUsers.some((u) => u.id === pvIdentiteEffective);
  const pvAttendMonAction =
    realPv?.statut === "en_signature" &&
    iSuisPresent &&
    !mySignatureReal &&
    (isEffectiveSealer ? canSeal : true);
  
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const [downloaded, setDownloaded] = useState(false);
  // Retours visuels immédiats, le temps que le refetch remonte le statut réel.
  // Ils sont RELATIFS à une convocation : sans remise à zéro, répondre à une
  // séance masquait à jamais la bannière et le bouton des séances suivantes.
  const [presenceConfirmed, setPresenceConfirmed] = useState(false);
  const [procurationSent, setProcurationSent] = useState(false);
  const [convocationDismissed, setConvocationDismissed] = useState(false);
  // Doit vivre ICI (pas dans ProcurationScreen, fonction imbriquée redéfinie à
  // chaque rendu) : toute écriture qui excuse le mandant ou modifie les
  // procurations est reçue en Realtime par ce même client, ce qui redéfinit
  // ProcurationScreen et effacerait un état local en cours de route (voir le
  // piège documenté pour ce fichier — mémoire role-invite-procuration).
  const [inviteExterneResultat, setInviteExterneResultat] = useState<{
    nom: string;
    prenom: string;
    emailSent: boolean;
    lien?: string;
  } | null>(null);
  useEffect(() => {
    setPresenceConfirmed(false);
    setProcurationSent(false);
    setConvocationDismissed(false);
    setInviteExterneResultat(null);
  }, [convocationReunionId]);
  // Pre-seed 3 signatures so M. Koné is the 4th to sign (matches spec: 3/9 → 4/9)
  const [signatures, setSignatures] = useState<Signature[]>([
    {
      userId: "USR-002",
      nom: "Touré Mamadou",
      qualite: "Ministère de l'Économie",
      methode: "otp",
      timestamp: "2026-07-15T15:18:00Z",
      hash: "b7e2c1d9a4f8",
    },
    {
      userId: "USR-003",
      nom: "Ouattara Seydou",
      qualite: "Présidence de la République",
      methode: "biométrie",
      timestamp: "2026-07-15T15:31:00Z",
      hash: "c4a9e2d1b7f3",
    },
    {
      userId: "USR-004",
      nom: "Yao Désiré",
      qualite: "Ministère des Infrastructures",
      methode: "tracé",
      timestamp: "2026-07-15T15:44:00Z",
      hash: "d1f8b3c7e2a9",
    },
  ]);

  // Toute navigation est mémorisée : c'est ce qui permet de retrouver l'écran
  // en cours après un rafraîchissement (voir `lireVueEnregistree`).
  const nav = (v: View) => {
    setView(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        CLE_VUE,
        JSON.stringify({ userId: useBoardStore.getState().profile?.id, view: v }),
      );
    }
  };

  const totalSigners = PV_SIGNERS.length + 1; // +1 = M. Koné (currentUser)
  const signedCount = signatures.length;

  const requireOnline = (label = "Action") => {
    if (offline) {
      toast.error("Connexion requise", {
        description: `${label} indisponible en mode hors-ligne.`,
      });
      return false;
    }
    return true;
  };

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
            <ScanConfirmScreen nav={nav} />
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

  function HomeScreen({ nav }: { nav: (v: View) => void }) {
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

  function DelegatePickerScreen({ nav }: { nav: (v: View) => void }) {
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

  function DownloadScreen({ nav }: { nav: (v: View) => void }) {
    const [step, setStep] = useState(-1); // -1 cover, 0..n points, ==length means done
    const done = step >= AGENDA_POINTS.length;
    useEffect(() => {
      if (done) {
        setDownloaded(true);
        log("Board Book téléchargé hors-ligne (mobile)", meeting.title);
        return;
      }
      const t = setTimeout(() => setStep((s) => s + 1), 550);
      return () => clearTimeout(t);
    }, [step, done]);

    const pct = done ? 100 : Math.round(((step + 1) / (AGENDA_POINTS.length + 1)) * 100);
    const totalPages = AGENDA_POINTS.reduce((sum, p) => sum + p.pages, 0);

    return (
      <div>
        <TopBar title="Téléchargement" onBack={() => nav({ tab: "home", sub: "convocation" })} />
        <div className="px-5 py-4">
          <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
            {!done ? (
              <>
                <div className="flex items-center gap-2 text-navy font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin text-gold" /> Téléchargement en cours…
                </div>
                <div className="mt-4 space-y-2">
                  <ProgressLine
                    done={step >= -1 && step >= 0}
                    label="Couverture & Sommaire"
                    pages="—"
                    active={step === -1}
                  />
                  {AGENDA_POINTS.map((p, i) => (
                    <ProgressLine
                      key={p.n}
                      done={step > i}
                      active={step === i}
                      label={`Point ${p.n} — ${p.file}`}
                      pages={`${p.pages} pages`}
                    />
                  ))}
                </div>
                <div className="mt-5">
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-yellow-600 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-[11px] text-slate-500 font-medium">
                    {pct}%
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="h-16 w-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center animate-in zoom-in duration-500">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="mt-3 font-bold text-navy">Board Book disponible hors-ligne</div>
                <div className="mt-2 text-[12px] text-slate-600 space-y-0.5">
                  <div>
                    {totalPages} pages · 5,8 MB ·{" "}
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Chiffré AES-256
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Valable jusqu'au 16/07/2026</div>
                </div>
                <button
                  onClick={() => nav({ tab: "boardbook" })}
                  className="mt-5 w-full bg-navy text-white rounded-xl py-3 font-semibold"
                >
                  Ouvrir le Board Book
                </button>
                <button
                  onClick={() => nav({ tab: "home" })}
                  className="mt-2 w-full text-slate-500 py-2 text-sm"
                >
                  Retour à l'accueil
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function ScannerScreen({ nav }: { nav: (v: View) => void }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const target = seanceEnCours;
    const doScan = async (mode: "presentiel" | "distance") => {
      if (!target || !profile) return;
      if (!requireOnline("Confirmation de présence")) return;
      setErr(null);
      setBusy(true);
      try {
        // Un invité scanne AU NOM du membre représenté, en mode 'procuration'
        // (jamais 'presentiel'/'distance' pour quelqu'un d'autre — voir policy
        // pres_insert_by_guest). Un membre qui confirme pour lui-même choisit
        // présentiel (scan du QR) ou à distance (bouton « Présent »).
        const mandant = isGuest ? mandantPour(target.id) : undefined;
        if (isGuest) {
          if (!mandant) throw new Error("Aucun mandat actif pour cette séance");
          await scanPresence(target.id, mandant, "procuration");
        } else {
          await scanPresence(target.id, profile.id, mode);
        }
        setPresenceConfirmed(true);
        nav({ tab: "home", sub: "scan-ok" });
      } catch {
        setErr("La confirmation n'a pas pu être enregistrée. Réessayez.");
      } finally {
        setBusy(false);
      }
    };
    return (
      <div>
        <TopBar title="Confirmer ma présence" onBack={() => nav({ tab: "home" })} />
        <div className="px-5 py-4">
          <div className="text-center text-navy font-bold">{target?.titre}</div>
          <div className="text-center text-xs text-slate-500 mt-0.5">
            Centrez le QR affiché en séance
          </div>
          <div className="mt-6 relative mx-auto aspect-square max-w-[280px] rounded-2xl bg-black overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-black to-slate-900" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-3/4 aspect-square">
                <Corner className="top-0 left-0" />
                <Corner className="top-0 right-0 rotate-90" />
                <Corner className="bottom-0 right-0 rotate-180" />
                <Corner className="bottom-0 left-0 -rotate-90" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gold shadow-[0_0_12px_#C9A84C] animate-[pulse_1.8s_ease-in-out_infinite]" />
              </div>
            </div>
            <div className="absolute bottom-2 left-0 right-0 text-center text-white/70 text-[11px]">
              Recherche du QR Code…
            </div>
          </div>

          {/* Raccourci de DÉMONSTRATION : la lecture réelle du QR par la caméra
              n'est pas implémentée, ce bouton enregistre directement la présence
              en mode « presentiel » (le même que produirait un vrai scan), ce qui
              fait apparaître le membre comme présent physiquement sur le PV.
              Volontairement petit et rouge pour ne pas être confondu avec une
              action métier — à retirer le jour où le scan caméra existe. */}
          <button
            onClick={() => doScan("presentiel")}
            disabled={busy}
            className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 active:scale-95 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanLine className="h-3.5 w-3.5" />
            )}
            Simuler le scan
          </button>

          <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" /> OU{" "}
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="mt-4 text-center text-xs text-slate-500">
            Vous suivez la séance à distance, sans être sur place ?
          </div>
          <button
            onClick={() => doScan("distance")}
            disabled={busy}
            className="mt-2 w-full bg-white border-[1.5px] border-navy text-navy rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            Présent
          </button>
          {err && <div className="mt-3 text-center text-xs text-red-600">{err}</div>}
        </div>
      </div>
    );
  }

  function ScanConfirmScreen({ nav }: { nav: (v: View) => void }) {
    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    // La présence est enregistrée au nom du membre représenté : afficher SON
    // nom, pas celui du compte invité connecté (voir ScannerScreen.doScan).
    const mandantNom = isGuest
      ? realUsersById[mandantPour(seanceEnCours?.id) ?? ""]?.nom
      : undefined;
    return (
      <div>
        <TopBar title="Présence confirmée" />
        <div className="px-5 py-10 text-center">
          <div className="h-24 w-24 rounded-full bg-emerald-100 mx-auto flex items-center justify-center animate-in zoom-in duration-500">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
          <div className="mt-6 text-xl font-bold text-navy">Présence enregistrée !</div>
          <div className="mt-3 bg-white rounded-2xl p-5 border border-slate-100 text-left">
            <div className="text-[10px] uppercase tracking-widest text-gold font-bold">Séance</div>
            <div className="text-navy font-semibold">{seanceEnCours?.titre}</div>
            <div className="mt-3 text-[10px] uppercase tracking-widest text-gold font-bold">
              {isGuest ? "Représenté par procuration" : "Membre du CA"}
            </div>
            <div className="text-navy font-semibold">{mandantNom ?? profile?.nom}</div>
            <div className="mt-3 text-[10px] uppercase tracking-widest text-gold font-bold">
              Arrivée enregistrée
            </div>
            <div className="text-navy font-semibold">{now}</div>
          </div>
          <button
            onClick={() =>
              nav({ tab: "home", sub: "meeting", data: { reunionId: seanceEnCours?.id } })
            }
            className="mt-6 w-full bg-navy text-white rounded-xl py-3.5 font-semibold"
          >
            Voir la réunion →
          </button>
          <button
            onClick={() => nav({ tab: "home" })}
            className="mt-2 w-full text-slate-500 py-2 text-sm"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  function MeetingDetail({ reunion, nav }: { reunion: Reunion; nav: (v: View) => void }) {
    const typeLabel =
      reunion.type === "ca_extraordinaire"
        ? "CA Extraordinaire"
        : reunion.type === "comite"
          ? "Comité"
          : "CA Ordinaire";
    const dateLabel = new Date(reunion.date).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const oj = [...reunion.ordreDuJour].sort((a, b) => a.position - b.position);
    const enCours = reunion.statut === "en_cours";

    // Le détail doit valoir pour N'IMPORTE QUELLE séance ouverte depuis l'Accueil,
    // pas seulement celle que le store a préchargée (`convocationReunionId`).
    const [convocs, setConvocs] = useState<{ userId: string; statut: string }[]>([]);
    const [recueil, setRecueil] = useState<{ pages: number | null; pret: boolean } | null>(null);
    const [chargement, setChargement] = useState(true);

    useEffect(() => {
      let annule = false;
      setChargement(true);
      Promise.all([
        supabase.from("convocations").select("user_id, statut").eq("reunion_id", reunion.id),
        supabase
          .from("board_books")
          .select("pages, storage_path")
          .eq("reunion_id", reunion.id)
          .maybeSingle(),
      ]).then(([convRes, bbRes]) => {
        if (annule) return;
        setConvocs(
          ((convRes.data ?? []) as any[]).map((c) => ({ userId: c.user_id, statut: c.statut })),
        );
        const b = bbRes.data as any;
        setRecueil(b ? { pages: b.pages, pret: !!b.storage_path } : null);
        setChargement(false);
      });
      return () => {
        annule = true;
      };
    }, [reunion.id]);

    const confirmes = convocs.filter((c) => c.statut === "confirmed");
    const excuses = convocs.filter((c) => c.statut === "excused");
    const enAttente = convocs.filter((c) => c.statut !== "confirmed" && c.statut !== "excused");

    // Président effectif : le titulaire, sauf s'il s'est excusé et a délégué.
    const delegue = reunion.presidentSeanceId
      ? realUsersById[reunion.presidentSeanceId]
      : undefined;
    const pcaExcuse = currentPCA
      ? convocs.find((c) => c.userId === currentPCA.id)?.statut === "excused"
      : false;
    const president = pcaExcuse && delegue ? delegue : currentPCA;

    const STATUT_SEANCE: Record<string, { label: string; cls: string }> = {
      planifiee: { label: "À venir", cls: "bg-sky-100 text-sky-700" },
      en_cours: { label: "En cours", cls: "bg-amber-100 text-amber-700" },
      terminee: { label: "Terminée", cls: "bg-slate-100 text-slate-600" },
    };
    const st = STATUT_SEANCE[reunion.statut] ?? { label: reunion.statut, cls: "bg-slate-100" };

    return (
      <div className="bg-[#F8FAFC] min-h-full">
        <TopBar title="Détail de la séance" onBack={() => nav({ tab: "home" })} />
        <div className="px-5 py-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wider text-gold font-bold">
                {typeLabel}
              </div>
              <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${st.cls}`}>
                {st.label}
              </span>
            </div>
            <div className="text-navy font-bold mt-0.5">{reunion.titre}</div>
            <div className="mt-2 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {dateLabel}
                {reunion.heure ? ` · ${reunion.heure}` : ""}
              </div>
              {reunion.lieu && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {reunion.lieu}
                </div>
              )}
              {convocs.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {convocs.length} convoqué
                  {convocs.length > 1 ? "s" : ""} · quorum requis {reunion.quorumRequis}
                </div>
              )}
              {president && (
                <div className="flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-gold" />
                  {president === delegue
                    ? `Présidée par ${president.nom} (délégation)`
                    : `Présidée par ${president.nom}`}
                </div>
              )}
            </div>
          </div>

          {/* Réponses aux convocations : qui sera là. */}
          {!chargement && convocs.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {[
                { v: confirmes.length, l: "Confirmés", c: "bg-emerald-500" },
                { v: excuses.length, l: "Excusés", c: "bg-rose-500" },
                { v: enAttente.length, l: "Sans réponse", c: "bg-slate-400" },
              ].map((t) => (
                <div
                  key={t.l}
                  className={`rounded-2xl p-3 text-center text-white shadow-sm ${t.c}`}
                >
                  <div className="text-2xl font-bold leading-none">{t.v}</div>
                  <div className="text-[10px] opacity-85 mt-1.5">{t.l}</div>
                </div>
              ))}
            </div>
          )}

          {enCours &&
            (() => {
              // Même vérité serveur que sur l'Accueil (voir plus haut) : ne pas
              // réafficher un bouton de scan une fois la présence déjà enregistrée,
              // y compris quand c'est un mandataire qui a scanné à ma place.
              const idPresenceCible = isGuest ? mandantPour(reunion.id) : profile?.id;
              const presenceEnregistree =
                !!idPresenceCible &&
                realPresences.some(
                  (p) => p.reunionId === reunion.id && p.userId === idPresenceCible,
                );
              const presenceDeleguee =
                !isGuest && mesDelegations.some((d) => d.reunionId === reunion.id);

              if (presenceEnregistree) {
                return (
                  <div className="mt-4 w-full bg-slate-100 border border-slate-200 rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 text-slate-600">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Présence enregistrée
                  </div>
                );
              }
              if (presenceDeleguee) return null;
              return (
                <button
                  onClick={() => nav({ tab: "home", sub: "scan" })}
                  className="mt-4 w-full bg-gradient-to-r from-gold to-yellow-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
                >
                  <QrCode className="h-5 w-5" /> Confirmer ma présence
                </button>
              );
            })()}

          {/* Board Book de CETTE séance — le recueil compilé et ses pièces. */}
          <button
            onClick={() =>
              nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } })
            }
            className="mt-4 w-full text-left rounded-2xl bg-gradient-to-br from-navy to-navy-light text-white p-4 flex items-center gap-3 shadow-lg active:scale-[0.98] transition"
          >
            <div className="h-12 w-12 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
              <BookOpen className="h-6 w-6 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">Board Book de la séance</div>
              <div className="text-[11px] text-white/70 mt-0.5">
                {chargement
                  ? "Chargement…"
                  : recueil?.pret
                    ? `Recueil compilé${recueil.pages ? ` · ${recueil.pages} pages` : ""} · Ouvrir et annoter`
                    : "En préparation par le secrétariat"}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/50 shrink-0" />
          </button>

          <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Ordre du jour
          </div>
          {oj.length === 0 ? (
            <div className="bg-white rounded-xl p-4 border border-slate-100 text-center text-[13px] text-slate-500">
              L'ordre du jour n'a pas encore été publié.
            </div>
          ) : (
            <div className="space-y-2 pb-6">
              {oj.map((a, i) => (
                <div
                  key={a.id}
                  className="bg-white rounded-xl p-3 border border-slate-100 flex items-start gap-3"
                >
                  <div className="h-7 w-7 rounded-lg bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-navy">{a.titre}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {a.dureeMin ? `${a.dureeMin} min` : "Durée non précisée"}
                      {a.obligatoire ? " · Obligatoire" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // « Board Book » = un dossier par réunion : l'ordre du jour, et sous chaque
  // point les documents qui s'y rattachent. Il n'y a pas de PDF unique compilé —
  // chaque pièce s'ouvre séparément. Une réunion a son recueil « disponible » dès
  // que le secrétariat l'a publié (ligne dans `board_books`).
  function BoardBookListScreen({ nav }: { nav: (v: View) => void }) {
    const [recueils, setRecueils] = useState<
      Record<string, { pages: number | null; pret: boolean }>
    >({});
    const [chargement, setChargement] = useState(true);

    useEffect(() => {
      let cancelled = false;
      const charger = () =>
        supabase
          .from("board_books")
          .select("reunion_id, pages, genere_at")
          .then(({ data }) => {
            if (cancelled) return;
            setRecueils(
              Object.fromEntries(
                ((data ?? []) as any[]).map((b) => [
                  b.reunion_id,
                  { pages: b.pages, pret: !!b.genere_at },
                ]),
              ),
            );
            setChargement(false);
          });
      charger();
      // Le recueil compilé par le secrétariat doit apparaître sans rechargement.
      const canal = supabase
        .channel("boardca:bb:liste")
        .on("postgres_changes", { event: "*", schema: "public", table: "board_books" }, () =>
          charger(),
        )
        // Resynchro sur reconnexion : voir src/lib/notifications.ts.
        .subscribe((status) => {
          if (status === "SUBSCRIBED") charger();
        });
      return () => {
        cancelled = true;
        supabase.removeChannel(canal);
      };
    }, []);

    // Un invité ne voit que le(s) Board Book(s) de la réunion où il est mandaté
    // — `reunionsPourEcrans` vaut `realReunions` pour tous les autres rôles.
    const seances = [...reunionsPourEcrans].sort((a, b) => b.date.localeCompare(a.date));

    return (
      <div className="bg-[#F8FAFC] min-h-full pb-20">
        <TopBar title="Board Book" />
        <div className="px-5 py-4 space-y-3">
          {chargement ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : seances.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-slate-400" />
              </div>
              <div className="text-sm font-semibold text-navy">Aucune séance</div>
              <div className="text-xs text-slate-500 max-w-[240px]">
                Les Board Books apparaîtront ici, un dossier par séance.
              </div>
            </div>
          ) : (
            seances.map((r) => {
              const info = recueils[r.id];
              const d = new Date(`${r.date}T12:00:00`);
              return (
                <button
                  key={r.id}
                  onClick={() =>
                    nav({ tab: "boardbook", sub: "reunion", data: { reunionId: r.id } })
                  }
                  className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 shadow-sm flex gap-3 active:scale-[0.99] transition"
                >
                  <div className="rounded-xl bg-navy text-gold px-3 py-2 text-center min-w-[58px] h-fit">
                    <div className="text-[9px] uppercase">
                      {d.toLocaleDateString("fr-FR", { month: "short" })}
                    </div>
                    <div className="text-xl font-bold leading-none">{d.getDate()}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-navy text-sm truncate">{r.titre}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {r.ordreDuJour.length} point(s) à l'ordre du jour
                    </div>
                    <div className="mt-2">
                      <span
                        className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
                          info?.pret
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {info?.pret ? "Recueil disponible" : "En préparation"}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 self-center" />
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

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
  function NotifsScreen({ nav }: { nav: (v: View) => void }) {
    // Abonnement propre à cet écran (pas via une closure sur l'app mobile
    // entière) : seul NotifsScreen se re-rend au fil des notifications, voir
    // l'avertissement dans `useNotifications.tsx`.
    const { items, unread, loading, markRead } = useNotifications();

    const open = (n: NotificationItem) => {
      if (!n.lu) markRead([n.id]);
      switch (n.type) {
        case "pv":
          nav({ tab: "home", sub: "pv" });
          break;
        case "vote": {
          // Un scrutin clos n'apparaît plus dans la liste des scrutins ouverts
          // (« Aucun scrutin ouvert ») : la notification de clôture doit mener
          // directement au résultat de CE scrutin, pas à une liste vide.
          const vote = n.ressourceId ? realVotes.find((v) => v.id === n.ressourceId) : undefined;
          if (vote?.statut === "clos") {
            nav({ tab: "vote", sub: "result", data: { id: vote.id } });
          } else {
            nav({ tab: "vote" });
          }
          break;
        }
        case "convocation":
          nav({ tab: "home", sub: "convocation" });
          break;
        case "document":
        case "board_book":
          nav({ tab: "boardbook" });
          break;
        case "discussion":
          nav({ tab: "discussions" });
          break;
        case "jeton":
          nav({ tab: "profile", sub: "jetons" });
          break;
        case "delegation":
          nav({ tab: "home", sub: "convocation" });
          break;
        case "consultation":
          nav({ tab: "profile", sub: "consultations" });
          break;
        default:
          break;
      }
    };

    return (
      <div>
        <TopBar
          title="Notifications"
          right={
            unread > 0 ? (
              <button
                onClick={() => markRead()}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold active:scale-95 active:bg-gold/20 transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Tout lire
              </button>
            ) : undefined
          }
        />
        {loading ? (
          <div className="px-5 py-16 flex justify-center">
            <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-8 py-20 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Bell className="h-6 w-6 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-navy">Aucune notification</div>
            <div className="text-xs text-slate-500 max-w-[250px]">
              Convocations, scrutins, PV à signer et actions assignées apparaîtront ici.
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-2">
            {items.map((n) => {
              const meta = metaDe(n.type);
              return (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  className={`w-full text-left rounded-xl p-3 border flex gap-3 active:scale-[0.98] transition ${
                    n.lu ? "bg-white border-slate-100" : "bg-gold/5 border-gold/30"
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}
                  >
                    <meta.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-navy flex items-center gap-1.5">
                      {n.titre}
                      {!n.lu && <span className="h-1.5 w-1.5 rounded-full bg-gold shrink-0" />}
                    </div>
                    {n.message && (
                      <div className="text-xs text-slate-500 truncate">{n.message}</div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 shrink-0">
                    {relativeTimeShort(n.createdAt)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // PV signés en définitive par le PCA (archives, lecture seule). Atteint depuis
  // le Profil ET depuis l'Accès rapide de l'Accueil quand le PV courant est
  // scellé — d'où un `onBack` fourni par l'appelant plutôt qu'une destination
  // codée en dur, sinon le retour renverrait vers le mauvais onglet.
  function PvArchivesScreen({ onBack }: { onBack: () => void }) {
    const [rows, setRows] = useState<PvArchive[]>([]);
    const [loading, setLoading] = useState(true);
    // Aperçu PDF du PV scellé (avec la signature du PCA), ouvert au clic d'une carte.
    const [apercu, setApercu] = useState<{ url: string; titre: string } | null>(null);
    useEffect(() => {
      let cancelled = false;
      fetchPvArchives()
        .then((r) => !cancelled && setRows(r))
        .catch(() => !cancelled && setRows([]))
        .finally(() => !cancelled && setLoading(false));
      return () => {
        cancelled = true;
      };
    }, []);

    // Construit le PDF final du PV : son contenu + la SEULE signature du PCA (les
    // approbations des membres n'y figurent pas — c'est le sceau qui fait foi).
    const ouvrirPdf = (p: PvArchive) => {
      const pvReel = realPvs.find((x) => x.reunionId === p.reunionId);
      if (!pvReel || !pvReel.contenu) {
        toast.error("Contenu du procès-verbal indisponible");
        return;
      }
      const sigPca = pvReel.signatures.find(
        (s) => s.pvVersion === pvReel.version && realUsersById[s.userId]?.estPresidentCA,
      );
      const reunion = realReunions.find((r) => r.id === p.reunionId);
      const url = genererPvPdfUrl({
        titre: p.reunionTitre,
        date: p.date
          ? new Date(p.date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "—",
        lieu: reunion?.lieu ?? "—",
        contenuHtml: pvReel.contenu,
        signatures: sigPca
          ? [
              {
                nom: realUsersById[sigPca.userId]?.nom ?? p.scellePar ?? "Président du Conseil",
                date: new Date(sigPca.signedAt).toLocaleString("fr-FR"),
                image: sigPca.imageBase64,
              },
            ]
          : [],
      });
      setApercu({ url, titre: p.reunionTitre });
    };

    const fermerPdf = () => {
      if (apercu) URL.revokeObjectURL(apercu.url);
      setApercu(null);
    };

    if (apercu) {
      return (
        <div className="bg-[#0b1220] min-h-full flex flex-col">
          <TopBar title="PV scellé" onBack={fermerPdf} />
          <iframe
            title={apercu.titre}
            src={apercu.url}
            className="flex-1 w-full border-0 bg-white"
          />
        </div>
      );
    }

    return (
      <div className="bg-[#F8FAFC] min-h-full">
        <TopBar title="Procès-verbal" onBack={onBack} />
        <div className="px-5 py-4 space-y-3">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <FileSignature className="h-6 w-6 text-slate-400" />
              </div>
              <div className="text-sm font-semibold text-navy">Aucun PV signé</div>
              <div className="text-xs text-slate-500 max-w-[250px]">
                Un procès-verbal apparaît ici une fois que tous les membres ont donné leur accord et
                que le PCA l'a signé.
              </div>
            </div>
          ) : (
            rows.map((p) => (
              <button
                key={p.id}
                onClick={() => ouvrirPdf(p)}
                className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 shadow-sm active:scale-[0.98] transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-navy text-sm">{p.reunionTitre}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {p.date
                        ? new Date(p.date).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "—"}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                    <ShieldCheck className="h-2.5 w-2.5" />{" "}
                    {p.statut === "archive" ? "Archivé" : "Scellé"}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-[12px]">
                  <Crown className="h-4 w-4 text-gold shrink-0" />
                  <span className="text-slate-500">Signé par</span>
                  <span className="font-semibold text-navy ml-auto">{p.scellePar ?? "—"}</span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-navy">
                  <FileText className="h-4 w-4 text-gold" /> Ouvrir le PV signé (PDF)
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Toutes les séances du Conseil et leur statut.
  // Lecteur PDF intégré : rend le vrai fichier et permet de surligner /
  // commenter (privé ou partagé). L'URL signée est créée à l'ouverture.
  // Toutes les convocations du membre, toutes réunions confondues. Le store ne
  // contient que celles de la réunion active : on interroge donc directement.
  // Re-fetch quand `allConvocations` change → la liste se met à jour dès qu'une
  // réponse est enregistrée depuis l'Accueil.
  function MesConvocationsScreen({ nav }: { nav: (v: View) => void }) {
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

  // Visionneuse d'image : mêmes commandes de zoom que le lecteur PDF. Pas de
  // couche texte, donc pas d'annotation possible sur une image.
  // Toutes les séances du Conseil, en grille mensuelle. Cliquer une séance ouvre
  // son détail (même écran que « Prochaine séance »).

  // Consultation écrite hors séance. Le membre répond UNE fois (RLS
  // `cons_rep_insert_self` : soi-même, consultation ouverte, avant la date limite).
  function ConsultationsScreen({ nav }: { nav: (v: View) => void }) {
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

  // Suivi des actions du membre. La RLS `actions_update_responsable` autorise le
  // responsable à faire avancer SES actions ; `act_comm_insert_scope` à commenter.
  function ActionsScreen({ nav }: { nav: (v: View) => void }) {
    const [busy, setBusy] = useState<string | null>(null);
    // Carte dont le fil de rapports est déplié, et carte dont le formulaire de
    // rapport est ouvert (le responsable saisit texte + avancement + pièce jointe).
    const [ouvert, setOuvert] = useState<string | null>(null);
    const [formOuvert, setFormOuvert] = useState<string | null>(null);
    const [rapports, setRapports] = useState<Record<string, ActionRapport[]>>({});
    const [texte, setTexte] = useState("");
    const [avancement, setAvancement] = useState(0);
    const [fichier, setFichier] = useState<File | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const aujourdhui = new Date().toLocaleDateString("en-CA");
    const etat = (a: (typeof allActions)[number]) =>
      a.statut === "terminee"
        ? "terminee"
        : a.statut === "a_valider"
          ? "a_valider"
          : a.echeance && a.echeance < aujourdhui
            ? "en_retard"
            : "en_cours";
    const META = {
      en_cours: { label: "En cours", badge: "bg-navy/10 text-navy", barre: "bg-navy" },
      en_retard: { label: "En retard", badge: "bg-rose-100 text-rose-700", barre: "bg-rose-500" },
      a_valider: {
        label: "À confirmer",
        badge: "bg-amber-100 text-amber-700",
        barre: "bg-amber-500",
      },
      terminee: {
        label: "Terminée",
        badge: "bg-emerald-100 text-emerald-700",
        barre: "bg-emerald-500",
      },
    } as const;

    const rang = { en_retard: 0, a_valider: 1, en_cours: 2, terminee: 3 } as const;
    const trier = (arr: typeof allActions) =>
      [...arr].sort((a, b) => {
        const d = rang[etat(a)] - rang[etat(b)];
        return d !== 0 ? d : (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999");
      });

    const total = allActions.length;
    const enCours = allActions.filter((a) => etat(a) === "en_cours").length;
    const enRetard = allActions.filter((a) => etat(a) === "en_retard").length;
    const aValider = allActions.filter((a) => etat(a) === "a_valider").length;
    const terminees = allActions.filter((a) => etat(a) === "terminee").length;
    const moyen = total ? Math.round(allActions.reduce((s, a) => s + a.avancement, 0) / total) : 0;

    // Regroupement par responsable : le membre du CA supervise l'avancement des
    // actions confiées à chacun (les groupes avec du retard remontent en premier).
    const responsableIds = Array.from(new Set(allActions.map((a) => a.responsableId)));
    const groupes = responsableIds
      .map((id) => {
        const acts = trier(allActions.filter((a) => a.responsableId === id));
        const moy = acts.length
          ? Math.round(acts.reduce((s, a) => s + a.avancement, 0) / acts.length)
          : 0;
        const retards = acts.filter((a) => etat(a) === "en_retard").length;
        return { id, user: realUsers.find((u) => u.id === id), acts, moy, retards };
      })
      .sort((g1, g2) => {
        const r = (g2.retards > 0 ? 1 : 0) - (g1.retards > 0 ? 1 : 0);
        return r !== 0 ? r : (g1.user?.nom ?? "").localeCompare(g2.user?.nom ?? "");
      });

    // Charge (à la demande) les rapports d'une action pour les afficher.
    const chargerRapports = async (id: string) => {
      try {
        const r = await fetchRapportsAction(id);
        setRapports((m) => ({ ...m, [id]: r }));
      } catch {
        /* silencieux : la liste reste simplement vide */
      }
    };

    // Ouvre/prépare le formulaire de rapport (avancement pré-rempli à la valeur courante).
    const ouvrirForm = (a: (typeof allActions)[number]) => {
      if (formOuvert === a.id) {
        setFormOuvert(null);
        return;
      }
      setFormOuvert(a.id);
      setTexte("");
      setAvancement(a.avancement);
      setFichier(null);
    };

    const choisirFichier = (f: File | null) => {
      if (f && f.size > MAX_RAPPORT_BYTES) {
        toast.error("Fichier trop lourd", { description: "25 Mo maximum." });
        return;
      }
      setFichier(f);
    };

    // Soumission d'un rapport : texte obligatoire, pièce jointe facultative.
    const soumettre = async (id: string) => {
      if (!texte.trim()) {
        toast.error("Le rapport doit contenir un texte");
        return;
      }
      setBusy(id);
      try {
        let piece;
        if (fichier) piece = await uploadPieceJointe(id, fichier);
        await soumettreRapportAction({
          actionId: id,
          texte: texte.trim(),
          avancement,
          fichier: piece
            ? { path: piece.path, nom: piece.nom, type: piece.type, taille: piece.taille }
            : undefined,
        });
        toast.success(
          avancement >= 100
            ? "Rapport transmis — clôture en attente du secrétariat"
            : "Rapport transmis",
        );
        setFormOuvert(null);
        setTexte("");
        setFichier(null);
        await chargerRapports(id);
        setOuvert(id);
      } catch (e: any) {
        toast.error("Envoi du rapport impossible", { description: e?.message });
      } finally {
        setBusy(null);
      }
    };

    const ouvrirPiece = async (path: string) => {
      const url = await lienPieceJointe(path);
      if (url) window.open(url, "_blank");
      else toast.error("Pièce jointe indisponible");
    };

    return (
      <div className="bg-[#F8FAFC] min-h-full">
        <TopBar title="Suivi des actions" onBack={() => nav({ tab: "profile" })} />

        {total === 0 ? (
          <div className="py-16 flex flex-col items-center text-center gap-3 px-8">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <ListChecks className="h-6 w-6 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-navy">Aucune action</div>
            <div className="text-xs text-slate-500 max-w-[240px]">
              Les actions confiées par le Conseil apparaîtront ici.
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* Avancement global de l'exécution des décisions */}
            <div className="rounded-2xl bg-navy text-white p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-gold font-semibold">
                Exécution des décisions
              </div>
              <div className="flex items-end gap-2 mt-1">
                <div className="text-3xl font-bold leading-none">{moyen}%</div>
                <div className="text-[11px] text-white/60 mb-0.5">
                  avancement moyen · {total} action{total > 1 ? "s" : ""}
                </div>
              </div>
              <div className="mt-2.5 h-2 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-gold transition-all duration-500"
                  style={{ width: `${moyen}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { v: enCours, l: "En cours", c: "bg-white text-navy border border-slate-100" },
                { v: aValider, l: "À confirmer", c: "bg-amber-500 text-white" },
                { v: enRetard, l: "En retard", c: "bg-rose-500 text-white" },
                { v: terminees, l: "Terminées", c: "bg-emerald-500 text-white" },
              ].map((t) => (
                <div key={t.l} className={`rounded-2xl p-3 text-center shadow-sm ${t.c}`}>
                  <div className="text-2xl font-bold leading-none">{t.v}</div>
                  <div className="text-[10px] opacity-80 mt-1.5">{t.l}</div>
                </div>
              ))}
            </div>

            {/* Actions groupées par responsable */}
            {groupes.map((g) => (
              <div key={g.id} className="space-y-2.5">
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="h-9 w-9 rounded-full bg-navy text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    {g.user?.initiales ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-navy truncate">
                      {g.user?.nom ?? "Responsable inconnu"}
                      {g.id === profile?.id && (
                        <span className="ml-1.5 text-[9px] uppercase font-semibold text-gold">
                          Vous
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {g.acts.length} action{g.acts.length > 1 ? "s" : ""} · {g.moy}% avancement
                      {g.retards > 0 && (
                        <span className="text-rose-600 font-semibold">
                          {" "}
                          · {g.retards} en retard
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {g.acts.map((a) => {
                  const e = etat(a);
                  const meta = META[e];
                  const reunion = a.reunionId
                    ? realReunions.find((r) => r.id === a.reunionId)
                    : null;
                  const enCoursDeMaj = busy === a.id;
                  const estMien = a.responsableId === profile?.id;
                  return (
                    <div
                      key={a.id}
                      className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm text-navy flex-1 min-w-0">{a.titre}</div>
                        <span
                          className={`text-[9px] uppercase font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                        {a.echeance && (
                          <span
                            className={`flex items-center gap-1 ${e === "en_retard" ? "text-rose-600 font-semibold" : ""}`}
                          >
                            <CalendarClock className="h-3 w-3" />
                            {new Date(a.echeance).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                        {a.priorite === "haute" && (
                          <span className="flex items-center gap-1 text-rose-600 font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Priorité haute
                          </span>
                        )}
                        {reunion && <span className="truncate max-w-[150px]">{reunion.titre}</span>}
                      </div>

                      <div className="mt-3 flex items-center gap-2.5">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full ${meta.barre} transition-all duration-500`}
                            style={{ width: `${a.avancement}%` }}
                          />
                        </div>
                        <div className="text-[11px] font-bold tabular-nums text-navy w-9 text-right">
                          {enCoursDeMaj ? (
                            <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                          ) : (
                            `${a.avancement}%`
                          )}
                        </div>
                      </div>

                      {/* À 100 % déclaré : en attente de confirmation du secrétariat. */}
                      {e === "a_valider" && (
                        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          Clôture à 100 % soumise — en attente de confirmation du secrétariat.
                        </div>
                      )}

                      {/* Le responsable fait avancer SON action en rédigeant un
                          rapport (texte requis + pièce jointe facultative) ; il ne
                          peut plus déplacer la barre en direct. Lecture seule sinon. */}
                      {estMien && e !== "terminee" && (
                        <button
                          onClick={() => ouvrirForm(a)}
                          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy text-white py-2 text-[12px] font-semibold active:scale-[0.98]"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {formOuvert === a.id ? "Fermer" : "Rédiger un rapport d'avancement"}
                        </button>
                      )}

                      {estMien && formOuvert === a.id && (
                        <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2.5">
                          <textarea
                            value={texte}
                            onChange={(ev) => setTexte(ev.target.value)}
                            rows={3}
                            placeholder="Décrivez l'avancement, les difficultés, les prochaines étapes…"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-gold"
                          />
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                              Avancement déclaré · {avancement}%
                            </div>
                            <div className="flex gap-1.5">
                              {[0, 25, 50, 75, 100].map((p) => (
                                <button
                                  key={p}
                                  onClick={() => setAvancement(p)}
                                  className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold border transition active:scale-95 ${
                                    avancement === p
                                      ? "bg-navy text-white border-navy"
                                      : "bg-white text-slate-500 border-slate-200"
                                  }`}
                                >
                                  {p === 100 ? "100" : p}
                                </button>
                              ))}
                            </div>
                          </div>

                          <input
                            ref={fileRef}
                            type="file"
                            hidden
                            onChange={(ev) => {
                              choisirFichier(ev.target.files?.[0] ?? null);
                              ev.currentTarget.value = "";
                            }}
                          />
                          {fichier ? (
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]">
                              <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="flex-1 truncate text-navy">{fichier.name}</span>
                              <button onClick={() => setFichier(null)} aria-label="Retirer">
                                <X className="h-3.5 w-3.5 text-slate-400" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => fileRef.current?.click()}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] text-slate-500"
                            >
                              <Paperclip className="h-3.5 w-3.5" /> Joindre une pièce (facultatif)
                            </button>
                          )}

                          {avancement >= 100 && (
                            <div className="text-[10px] text-amber-700">
                              À 100 %, l'action passera « à confirmer » : le secrétariat validera la
                              clôture.
                            </div>
                          )}
                          <button
                            onClick={() => soumettre(a.id)}
                            disabled={enCoursDeMaj || !texte.trim()}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold text-gold-foreground py-2 text-[12px] font-semibold disabled:opacity-40 active:scale-[0.98]"
                          >
                            {enCoursDeMaj ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Transmettre le rapport
                          </button>
                        </div>
                      )}

                      {/* Fil des rapports — visible de tous (responsable, CA, secrétariat). */}
                      <button
                        onClick={() => {
                          const o = ouvert === a.id ? null : a.id;
                          setOuvert(o);
                          if (o && !rapports[a.id]) chargerRapports(a.id);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-slate-500"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Rapports d'avancement
                        <ChevronRight
                          className={`h-3.5 w-3.5 transition-transform ${ouvert === a.id ? "rotate-90" : ""}`}
                        />
                      </button>

                      {ouvert === a.id && (
                        <div className="mt-2.5 space-y-2.5 border-l-2 border-slate-100 pl-3">
                          {(rapports[a.id] ?? []).map((r) => (
                            <div key={r.id} className="text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-navy">
                                  {realUsers.find((u) => u.id === r.auteurId)?.nom ?? "—"}
                                </span>
                                <span className="rounded-full bg-navy/10 px-1.5 py-px text-[9px] font-bold text-navy">
                                  {r.avancement}%
                                </span>
                                <span className="text-slate-400">
                                  {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                              <div className="text-slate-600 mt-0.5 whitespace-pre-wrap">
                                {r.texte}
                              </div>
                              {r.fichierPath && (
                                <button
                                  onClick={() => ouvrirPiece(r.fichierPath!)}
                                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-navy underline underline-offset-2"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  {r.fichierNom ?? "Pièce jointe"}
                                </button>
                              )}
                            </div>
                          ))}
                          {(rapports[a.id]?.length ?? 0) === 0 && (
                            <div className="text-[11px] text-slate-400">
                              Aucun rapport pour l'instant.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }


  function ProfileScreen({ nav }: { nav: (v: View) => void }) {
    const rows = [
      { icon: Fingerprint, label: "Biométrie Touch ID", value: "Activée" },
      { icon: Shield, label: "2FA authentificateur", value: "Activée" },
      { icon: Bell, label: "Notifications push", value: "Toutes" },
      {
        icon: Download,
        label: "Documents hors-ligne",
        value: downloaded ? "Board Book · 5,8 MB" : "Aucun",
      },
    ];
    return (
      <div>
        <TopBar title="Profil" />
        <div className="px-5 py-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gold to-yellow-600 text-white mx-auto flex items-center justify-center text-2xl font-bold">
              {currentUser?.avatar}
            </div>
            <div className="mt-3 font-bold text-navy">{currentUser?.name}</div>
            <div className="text-xs text-slate-500">{currentUser?.email}</div>
            <div className="mt-2 inline-block text-[10px] uppercase tracking-widest bg-gold/20 text-gold px-2 py-1 rounded-full font-semibold">
              Membre du CA · Comité {currentUser?.committee}
            </div>
          </div>

          {isPCA && (
            <button
              onClick={() => nav({ tab: "home", sub: "pca-hub" })}
              className="mt-4 w-full text-left rounded-2xl bg-gradient-to-br from-navy to-navy-light text-white p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
            >
              <div className="h-10 w-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                <Crown className="h-5 w-5 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">Espace PCA</div>
                <div className="text-[11px] text-white/70 mt-0.5">
                  Discussions, présidence de séance, sceau du PV
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/50 shrink-0" />
            </button>
          )}

          <button
            onClick={() => nav({ tab: "profile", sub: "jetons" })}
            className="mt-4 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl bg-[#16C784]/10 border border-[#16C784]/30 flex items-center justify-center shrink-0">
              <Coins className="h-5 w-5 text-[#16C784]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-navy">Mes jetons de présence</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Historique, cumul et paiements de vos séances
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
          </button>

          <button
            onClick={() => nav({ tab: "profile", sub: "consultations" })}
            className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <MailCheck className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-navy">Consultation écrite</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {consultationsATraiter > 0
                  ? `${consultationsATraiter} décision${consultationsATraiter > 1 ? "s" : ""} en attente de votre voix`
                  : "Les décisions du Conseil hors séance"}
              </div>
            </div>
            {consultationsATraiter > 0 && (
              <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {consultationsATraiter}
              </span>
            )}
            <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
          </button>

          <button
            onClick={() => nav({ tab: "profile", sub: "actions" })}
            className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
              <ListChecks className="h-5 w-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-navy">Suivi des actions</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {actionsEnRetardGlobal > 0
                  ? `${actionsEnRetardGlobal} action${actionsEnRetardGlobal > 1 ? "s" : ""} en retard à surveiller`
                  : "Avancement des actions confiées aux responsables"}
              </div>
            </div>
            {actionsEnRetardGlobal > 0 && (
              <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {actionsEnRetardGlobal}
              </span>
            )}
            <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
          </button>

          <button
            onClick={() => nav({ tab: "profile", sub: "pv-archives" })}
            className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
              <FileSignature className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-navy">Procès-verbal</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Les PV signés en définitive par le PCA
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
          </button>

          <button
            onClick={() => nav({ tab: "profile", sub: "convocations" })}
            className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Send className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-navy">Mes convocations</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Vos réponses aux convocations du Conseil
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
          </button>

          <button
            onClick={() => nav({ tab: "profile", sub: "calendrier" })}
            className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5 text-sky-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-navy">Mon Calendrier</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Les séances du Conseil mois par mois
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
          </button>

          <button
            onClick={() => nav({ tab: "profile", sub: "seances" })}
            className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl bg-navy/10 border border-navy/20 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-navy" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-navy">Séance Conseil administratif</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Toutes les séances du Conseil et leur statut
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
          </button>

          <div className="mt-4 bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {rows.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-slate-100" : ""}`}
              >
                <div className="h-8 w-8 rounded-lg bg-navy/5 text-navy flex items-center justify-center">
                  <r.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 text-sm text-navy">{r.label}</div>
                <div className="text-xs text-emerald-600 font-semibold">{r.value}</div>
              </div>
            ))}
          </div>
          <button className="mt-5 w-full bg-white border border-red-200 text-red-600 rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2">
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  function PVSignScreen({ nav }: { nav: (v: View) => void }) {
    const [saving, setSaving] = useState(false);
    const sealing = canSeal;
    const finalize = async (methode: Signature["methode"], imageBase64?: string) => {
      if (!profile || !realPv || saving) return;
      if (!requireOnline("Signature du PV")) return;
      const domainMethode = ({ tracé: "trace", otp: "otp", biométrie: "biometrie" } as const)[
        methode
      ];
      setSaving(true);
      try {
        // Un invité signe AU NOM du membre représenté (même ligne signatures
        // que si le membre avait signé lui-même — voir policy sig_insert_by_guest
        // et `pvIdentiteEffective` plus haut).
        await signPV(realPv.id, pvIdentiteEffective ?? profile.id, domainMethode, imageBase64);
        toast.success(sealing ? "PV scellé" : "Signature enregistrée", {
          description: sealing
            ? `Sceau final apposé par ${isPCA ? "le PCA" : "le président de séance délégué"} — PV archivé.`
            : "Conforme eIDAS · horodatée et scellée.",
        });
        nav({ tab: "home", sub: "pv" });
      } catch {
        toast.error("Échec de l'enregistrement de la signature");
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="bg-[#F8FAFC] min-h-full pb-6">
        <TopBar
          title={sealing ? "Sceller le PV" : "Signer le PV"}
          onBack={() => nav({ tab: "home", sub: "pv" })}
        />
        <div className="px-5 py-4">
          {sealing && (
            <div className="mb-3 rounded-lg bg-gold/10 border border-gold/30 px-3 py-2 text-[11px] text-navy flex items-start gap-2">
              <Crown className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              Tous les autres membres présents ont signé. Votre signature,{" "}
              {isPCA ? "en tant que PCA" : "en tant que président de séance délégué"}, scelle
              définitivement le PV.
            </div>
          )}
          <div className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-widest text-gold font-bold">
              Apposer ma signature certifiée
            </div>
            <div className="mt-1 text-navy font-semibold text-[14px] flex items-center gap-1.5">
              {isGuest
                ? (realUsersById[pvIdentiteEffective ?? ""]?.nom ?? profile?.nom)
                : profile?.nom}
              {isEffectiveSealer && <Crown className="h-3.5 w-3.5 text-gold" />}
            </div>
            <div className="text-[11px] text-slate-500">
              {isGuest
                ? `Représenté par ${profile?.nom} (procuration)`
                : isPCA
                  ? "Président du Conseil d'Administration"
                  : isEffectiveSealer
                    ? "Président de séance délégué"
                    : (profile?.qualite ?? "Membre du CA")}
            </div>
          </div>

          {/* Signature manuscrite tracée à l'écran — seule méthode retenue. */}
          <div className="mt-4">
            <CanvasSignPad onValidate={(img) => finalize("tracé", img)} />
          </div>

          <div className="mt-4 text-[10px] text-slate-500 flex items-start gap-2 bg-white border border-slate-100 rounded-lg p-3">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              La signature sera horodatée GMT et scellée par un hash SHA-256 conforme au règlement
              eIDAS. Elle est définitive.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Espace PCA : consolide les actions propres au Président, en plus de celles
  // d'un membre du CA ordinaire (discussions du CA, présidence de séance,
  // signature finale du PV). Renvoie vers les écrans existants plutôt que de
  // dupliquer leur logique.
  function PCAScreen({ nav }: { nav: (v: View) => void }) {
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

