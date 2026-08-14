// Interfaces des slices du store. Toute mutation qui touche la base est async
// (appel Supabase) ; le Realtime (voir useBootstrap) pousse les mises à jour aux
// autres clients — les actions n'ont donc pas besoin de retourner l'état à jour.
import type {
  User,
  Comite,
  Reunion,
  PointOJ,
  Document,
  BoardBook,
  Presence,
  Procuration,
  Convocation,
  Vote,
  Resolution,
  PV,
  PvStatut,
  Action,
  ActionCommentaire,
  AuditEntry,
  UserRole,
  Choix,
  PresenceMode,
  SignatureMethode,
  ConvocationStatut,
} from "@/types/domain";

// ─── AUTH SLICE ───────────────────────────────────────────────
// Le rôle vient TOUJOURS de `profile.role` (lu en base) — jamais choisi côté client.
export interface AuthSlice {
  profile: User | null;
  authLoading: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  // Changement de mot de passe imposé à la 1re connexion : met à jour l'auth,
  // efface le drapeau `must_change_password`, puis recharge le profil.
  completePasswordChange: (newPassword: string) => Promise<void>;
}

// ─── USERS SLICE ──────────────────────────────────────────────
export interface UsersSlice {
  users: User[];
  comites: Comite[];
  usersLoading: boolean;
  fetchUsers: () => Promise<void>;
  fetchComites: () => Promise<void>;
  // Crée un vrai compte auth + profil via edge function (super_admin only).
  // Aucun mot de passe posé ici : un lien d'activation à usage unique part par
  // email, le nouvel utilisateur crée son propre mot de passe sur /auth/invite.
  addUser: (u: {
    nom: string;
    email: string;
    role: UserRole;
    telephone?: string;
    qualite?: string;
  }) => Promise<{ id: string; emailSent: boolean; emailError?: string; lien?: string }>;
  updateUser: (
    id: string,
    patch: Partial<Pick<User, "nom" | "telephone" | "qualite" | "statut" | "role">>,
  ) => Promise<void>;
  removeUser: (id: string) => Promise<void>; // supprime le compte auth (cascade profil/comités/réunions)
  // Désigne (ou retire avec null) le PCA — atomique côté DB, un seul actif à la fois.
  setPresidentCA: (userId: string | null) => Promise<void>;
  addComite: (c: { nom: string; description?: string; presidentId?: string }) => Promise<string>;
  updateComite: (
    id: string,
    patch: Partial<Pick<Comite, "nom" | "description" | "presidentId">>,
  ) => Promise<void>;
  removeComite: (id: string) => Promise<void>;
  addComiteMembre: (comiteId: string, userId: string) => Promise<void>;
  removeComiteMembre: (comiteId: string, userId: string) => Promise<void>;
}

// ─── REUNIONS SLICE ───────────────────────────────────────────
export interface ReunionsSlice {
  reunions: Reunion[];
  reunionActiveId: string | null; // sélecteur partagé global (local, pas persisté en base)
  reunionsLoading: boolean;
  setReunionActive: (id: string | null) => void;
  fetchReunions: () => Promise<void>;
  addReunion: (r: {
    type: Reunion["type"];
    titre: string;
    date: string;
    heure?: string;
    dureeMin?: number;
    lieu?: string;
    lienVisio?: string;
    quorumRequis?: number;
    comiteId?: string;
  }) => Promise<string>;
  updateReunion: (
    id: string,
    patch: Partial<
      Pick<
        Reunion,
        "titre" | "date" | "heure" | "dureeMin" | "lieu" | "lienVisio" | "statut" | "quorumRequis"
      >
    >,
  ) => Promise<void>;
  removeReunion: (id: string) => Promise<void>;
  reorderOJ: (reunionId: string, orderedPointIds: string[]) => Promise<void>;
  addPointOJ: (reunionId: string, p: Omit<PointOJ, "id" | "position">) => Promise<void>;
  addPointsOJ: (reunionId: string, points: Omit<PointOJ, "id" | "position">[]) => Promise<void>;
  removePointOJ: (reunionId: string, pointId: string) => Promise<void>;
  // Délégation de présidence de séance — PCA titulaire only (vérifié côté RPC).
  // Fallback ponctuel pour cette réunion ; n'affecte jamais le titre global.
  delegatePresidentSeance: (reunionId: string, delegateId: string) => Promise<void>;
  // Report de séance faute de quorum (RPC `reporter_seance`, secrétariat only) :
  // lève la séance, la replanifie à la nouvelle date, archive puis remet à zéro
  // l'émargement, et reconvoque tous les administrateurs.
  reporterSeance: (
    reunionId: string,
    r: { date: string; heure?: string; lieu?: string; motif?: string },
  ) => Promise<void>;
}

// ─── DOCUMENTS SLICE ──────────────────────────────────────────
export interface DocumentsSlice {
  documents: Document[];
  boardBooks: BoardBook[];
  documentsLoading: boolean;
  fetchDocuments: (reunionId: string) => Promise<void>;
  fetchBoardBook: (reunionId: string) => Promise<void>;
  addDocument: (d: {
    reunionId: string;
    nom: string;
    type: Document["type"];
    tailleBytes: number;
    pages?: number;
    contenu?: string;
    storagePath?: string;
    pointOjId?: string | null;
  }) => Promise<string>;
  assignDocToPoint: (docId: string, pointOjId: string | null) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  generateBoardBook: (reunionId: string) => Promise<BoardBook | null>;
  // Ajout : compile un PDF unique (couverture + sommaire dynamique + points et
  // leurs fichiers) et l'enregistre dans board_books.storage_path. N'altère pas
  // la publication « format » ci-dessus.
  generateBoardBookPdf: (
    reunionId: string,
  ) => Promise<{ boardBook: BoardBook; storagePath: string } | null>;
}

// ─── PRESENCES SLICE ──────────────────────────────────────────
export interface PresencesSlice {
  presences: Presence[];
  procurations: Procuration[];
  convocations: Convocation[];
  presencesLoading: boolean;
  fetchPresences: (reunionId: string) => Promise<void>;
  fetchProcurations: (reunionId: string) => Promise<void>;
  fetchConvocations: (reunionId: string) => Promise<void>;
  scanPresence: (reunionId: string, userId: string, mode?: PresenceMode) => Promise<void>;
  setPresence: (reunionId: string, userId: string, mode: PresenceMode) => Promise<void>;
  removePresence: (reunionId: string, userId: string) => Promise<void>;
  // Désigne directement une personne déjà présente dans le système (membre du
  // CA, Secrétaire, invité déjà validé) comme mandataire — pas de nouveau
  // compte, simple ligne `procurations` (RLS `proc_write_self`), puis alerte
  // par email cette personne (edge fn `procuration-notify`, non bloquant :
  // la procuration existe déjà même si l'email échoue).
  addProcuration: (
    reunionId: string,
    de: string,
    vers: string,
  ) => Promise<{ emailSent: boolean; emailError?: string }>;
  // Un membre désigne un invité externe (email inconnu du système) : création
  // DIRECTE du compte + de la procuration via l'edge function `invite-guest`
  // (aucune validation de la Secrétaire — un membre du CA choisit seul son
  // mandataire), qui envoie aussi l'email d'invitation réel (EmailJS) avec un
  // lien d'accès à usage unique (`lien`, à communiquer manuellement si l'email
  // échoue) — aucun mot de passe généré par le système, l'invité crée le sien
  // à sa 1re connexion.
  inviterExterne: (
    reunionId: string,
    d: { nom: string; prenom: string; email: string; motif?: string },
  ) => Promise<{
    guestId: string;
    emailSent: boolean;
    emailError?: string;
    lien?: string;
  }>;
  revoquerProcuration: (reunionId: string) => Promise<void>;
  sendConvocations: (reunionId: string, userIds: string[]) => Promise<void>;
  confirmConvocation: (
    reunionId: string,
    userId: string,
    statut: Extract<ConvocationStatut, "confirmed" | "excused">,
  ) => Promise<void>;
}

// ─── VOTES SLICE ──────────────────────────────────────────────
export interface VotesSlice {
  votes: Vote[];
  resolutions: Resolution[];
  votesLoading: boolean;
  fetchVotes: (reunionId: string) => Promise<void>;
  fetchResolutions: (reunionId: string) => Promise<void>;
  openVote: (reunionId: string, intitule: string, resolutionCode?: string) => Promise<string>;
  castBulletin: (voteId: string, userId: string, choix: Choix) => Promise<void>; // immuable
  closeVote: (voteId: string) => Promise<void>; // le résultat est recalculé par un trigger DB
}

// ─── PV SLICE ─────────────────────────────────────────────────
export interface PvSlice {
  pvs: PV[];
  pvLoading: boolean;
  // Statut du PV de CHAQUE réunion (reunionId -> statut), léger — pas le contenu
  // ni les signatures. Sert à classer les réunions "En cours"/"Archives" dans la
  // grille du Procès-verbal indépendamment du statut de la réunion elle-même :
  // un PV non scellé doit rester visible même une fois la séance terminée.
  pvStatuts: Record<string, PvStatut>;
  fetchPvStatuts: () => Promise<void>;
  fetchPV: (reunionId: string) => Promise<void>;
  ensurePV: (reunionId: string) => Promise<string>;
  updatePVContent: (pvId: string, contenu: string) => Promise<void>;
  sendForSignature: (pvId: string) => Promise<void>;
  signPV: (
    pvId: string,
    userId: string,
    methode: SignatureMethode,
    imageBase64?: string,
  ) => Promise<void>;
  // le passage en statut 'signe' est automatique (trigger DB) une fois tous les présents signés
}

// ─── ACTIONS SLICE ────────────────────────────────────────────
export interface ActionsSlice {
  actions: Action[];
  actionsLoading: boolean;
  fetchActions: () => Promise<void>;
  assignAction: (a: {
    titre: string;
    description?: string;
    responsableId: string;
    reunionId?: string;
    resolutionId?: string;
    echeance?: string;
    priorite?: Action["priorite"];
  }) => Promise<string>;
  // Édition directe de l'avancement — réservée au secrétariat/super admin (le
  // responsable, lui, passe par un rapport ; sa policy UPDATE a été retirée).
  updateAvancement: (actionId: string, avancement: number, commentaire?: string) => Promise<void>;
  addActionComment: (actionId: string, texte: string) => Promise<void>;
  // Nouveau flux : le responsable soumet un rapport d'avancement (RPC serveur),
  // le secrétariat confirme la clôture à 100 % ou renvoie pour compléments.
  soumettreRapportAction: (params: {
    actionId: string;
    texte: string;
    avancement: number;
    fichier?: { path: string; nom: string; type: string; taille: number };
  }) => Promise<void>;
  confirmerClotureAction: (actionId: string) => Promise<void>;
  renvoyerAction: (actionId: string, motif?: string) => Promise<void>;
}

// ─── AUDIT SLICE ──────────────────────────────────────────────
export interface AuditSlice {
  auditLog: AuditEntry[];
  auditLoading: boolean;
  fetchAuditLog: () => Promise<void>; // super_admin only (RLS)
  logEvent: (action: string, ressource?: string) => Promise<void>;
}

export type BoardStore = AuthSlice &
  UsersSlice &
  ReunionsSlice &
  DocumentsSlice &
  PresencesSlice &
  VotesSlice &
  PvSlice &
  ActionsSlice &
  AuditSlice;

export type { ActionCommentaire };
