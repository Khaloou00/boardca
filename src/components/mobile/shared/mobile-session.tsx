// Contexte de session de l'app mobile.
//
// Toute la dérivation qui vivait dans `MobileAdminAppScreen` est ici : séance à
// venir, convocations, procurations, état du PV, présences, droits du PCA…
// Elle est calculée UNE SEULE FOIS par le provider, et les écrans la lisent via
// `useMobileSession()`.
//
// POURQUOI : ces valeurs étaient capturées par fermeture par des écrans définis
// À L'INTÉRIEUR du composant parent. React traite une fonction redéfinie à chaque
// rendu comme un NOUVEAU type de composant : il démontait puis remontait l'écran
// affiché à la moindre mise à jour (Realtime, notification…), effaçant les champs
// en cours de saisie et réinitialisant le lecteur PDF. Passer par un contexte
// permet aux écrans d'être des composants de premier niveau, donc stables.
//
// Un seul contexte pour ~120 valeurs fait re-rendre tous les consommateurs à
// chaque changement. C'est assumé : un re-render est peu coûteux, c'est le
// REMONTAGE qui détruisait l'état. Le découpage en contextes plus fins est une
// optimisation ultérieure, pas une correction de bug.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { DiscussionsScreen } from "../discussions-screen";
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
} from "./ui-components";
import { CanvasSignPad, SignatureRow, type Signature } from "./signature-pad";
import { NoMeetingScreen } from "./no-meeting-screen";
import { relativeTimeShort } from "./utils";
import { CLE_VUE, lireVueEnregistree, type Tab, type View } from "./view-state";
import { CalendrierScreen } from "../screens/calendrier-screen";
import { SeancesScreen } from "../screens/seances-screen";
import { PvArchivesScreen } from "../screens/pv-archives-screen";
import { ScanConfirmScreen } from "../screens/scan-confirm-screen";



// Composant à part (PAS imbriqué dans `MobileAdminApp`) : seul lui se re-rend
// au fil des notifications (poll/Realtime), jamais l'app mobile entière — voir
// l'avertissement dans `useNotifications.tsx`.

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

type MobileSessionValue = ReturnType<typeof useMobileSessionValue>;

function useMobileSessionValue() {
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

  return {
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
  };
}

const MobileSessionContext = createContext<MobileSessionValue | null>(null);

export function MobileSessionProvider({ children }: { children: ReactNode }) {
  const value = useMobileSessionValue();
  return <MobileSessionContext.Provider value={value}>{children}</MobileSessionContext.Provider>;
}

export function useMobileSession(): MobileSessionValue {
  const ctx = useContext(MobileSessionContext);
  if (!ctx) throw new Error("useMobileSession doit être utilisé sous <MobileSessionProvider>");
  return ctx;
}
