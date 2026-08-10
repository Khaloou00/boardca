// Types métier "vue front" (camelCase, relations imbriquées).
// Couche au-dessus du schéma Postgres brut (src/lib/database.types.ts, généré, snake_case) :
// les mappers (src/lib/mappers.ts) convertissent Row Supabase → ces types.
// Le Postgres reste la seule source de vérité ; ceci est juste la forme consommée par l'UI.

export type UserRole = 'super_admin' | 'secretaire' | 'administrateur' | 'responsable_action' | 'invite';
export type UserStatut = 'actif' | 'inactif' | 'suspendu';

export interface User {
  id: string;
  nom: string;
  email: string;
  telephone?: string;
  role: UserRole;
  qualite?: string;
  statut: UserStatut;
  initiales: string;
  comiteIds: string[]; // dérivé de comite_membres, pas une colonne
  derniereConnexion?: string;
  // PCA (Président du Conseil d'Administration) : attribut sur un compte
  // administrateur, pas un rôle distinct — un seul actif à la fois (contrainte
  // unique en base). Sa signature du PV agit comme sceau final, pas comme une
  // signature de plus dans le décompte des présents.
  estPresidentCA: boolean;
  // Créé par le Super Admin : la première connexion impose un nouveau mot de passe.
  mustChangePassword: boolean;
}

export interface Comite {
  id: string;
  nom: string;
  description?: string;
  presidentId?: string;
  membreIds: string[]; // dérivé de comite_membres
}

export type ReunionType = 'ca_ordinaire' | 'ca_extraordinaire' | 'comite';
export type ReunionStatut = 'planifiee' | 'en_cours' | 'terminee';

export interface PointOJ {
  id: string;
  position: number;
  titre: string;
  dureeMin?: number;
  obligatoire: boolean;
}

export interface Reunion {
  id: string;
  type: ReunionType;
  titre: string;
  date: string; // ISO "2026-07-15"
  heure?: string; // "09:00"
  dureeMin?: number;
  lieu?: string;
  /** URL de visioconférence (Google Meet). Absente = séance en présentiel seul. */
  lienVisio?: string;
  statut: ReunionStatut;
  quorumRequis: number;
  comiteId?: string;
  ordreDuJour: PointOJ[]; // dérivé de ordre_du_jour, trié par position
  createdBy?: string;
  // Présidence de séance : fallback par réunion, distinct du titre institutionnel
  // (User.estPresidentCA). Posé uniquement quand le PCA titulaire s'excuse pour
  // cette réunion précise ; n'affecte jamais le titre global.
  presidentSeanceId?: string;
  // Posée par trigger à la transition vers 'terminee'. Sert à calculer la
  // fenêtre d'accès d'un mandataire invité (clôture + 2 jours) côté client.
  cloutureeAt?: string;
}

// `documents.type` est du texte libre en base (aucune contrainte CHECK) : on
// accepte n'importe quel fichier à l'upload et on le range dans l'une de ces
// familles. `autre` est le fourre-tout des formats sans traitement spécifique.
export type DocType = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'image' | 'autre';

export interface Document {
  id: string;
  reunionId: string;
  pointOjId: string | null;
  nom: string;
  type: DocType;
  tailleBytes: number;
  pages?: number;
  storagePath?: string;
  contenu?: string; // texte démo pour le viewer, tant qu'il n'y a pas d'upload réel
  uploadedBy?: string;
  createdAt: string;
}

export interface BoardBook {
  id: string;
  reunionId: string;
  pages?: number;
  tailleBytes?: number;
  storagePath?: string;
  hash?: string;
  genereePar?: string;
  genereeAt: string;
}

export type ConvocationStatut = 'pending' | 'sending' | 'sent' | 'opened' | 'confirmed' | 'excused';

export interface Convocation {
  id: string;
  reunionId: string;
  userId: string;
  statut: ConvocationStatut;
  sentAt?: string;
  openedAt?: string;
}

export type PresenceMode = 'presentiel' | 'distance' | 'procuration';

export interface Presence {
  id: string;
  reunionId: string;
  userId: string;
  mode: PresenceMode;
  scannedAt: string;
}

export type ProcurationStatut = 'active' | 'revoquee';

export interface Procuration {
  id: string;
  reunionId: string;
  deUserId: string;
  versUserId: string;
  statut: ProcurationStatut;
  createdAt: string;
}

export type DemandeInviteStatut = 'en_attente' | 'validee' | 'rejetee';

// Demande de nouvel invité externe (mandataire hors système) créée par un
// membre du CA — le compte n'existe pas tant que la Secrétaire ne l'a pas
// validée (versUserId reste vide jusque-là).
export interface DemandeInvite {
  id: string;
  reunionId: string;
  deUserId: string;
  nom: string;
  prenom: string;
  email: string;
  motif?: string;
  statut: DemandeInviteStatut;
  versUserId?: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export type VoteStatut = 'ouvert' | 'clos';
export type Choix = 'oui' | 'non' | 'abstention';

export interface Bulletin {
  id: string;
  voteId: string;
  userId: string;
  choix: Choix;
  votedAt: string;
}

export interface Vote {
  id: string;
  reunionId: string;
  resolutionCode?: string;
  intitule: string;
  statut: VoteStatut;
  ouvertAt: string;
  closAt?: string;
  cloturePrevue?: string;
  bulletins: Bulletin[];
}

export type ResolutionResultat = 'adoptee' | 'rejetee' | 'en_attente';

export interface Resolution {
  id: string;
  reunionId: string;
  code: string;
  texte: string;
  voteId?: string;
  resultat: ResolutionResultat;
}

export type PvStatut = 'brouillon' | 'en_signature' | 'signe' | 'archive';
export type SignatureMethode = 'trace' | 'otp' | 'biometrie';

export interface Signature {
  id: string;
  pvId: string;
  userId: string;
  methode: SignatureMethode;
  imageBase64?: string;
  hash?: string;
  signedAt: string;
  // Manche de signature à laquelle cette signature appartient (voir PV.version) —
  // une nouvelle manche (renvoi après correction) ne fait jamais disparaître les
  // signatures des manches précédentes, elle les rend juste non comptantes.
  pvVersion: number;
}

export interface PV {
  id: string;
  reunionId: string;
  contenu: string;
  statut: PvStatut;
  hashDocument?: string;
  archiveAt?: string;
  signatures: Signature[];
  // Incrémentée à chaque renvoi pour signature d'un PV déjà en cours (après
  // correction suite à une désapprobation/observation) : les signatures d'une
  // version antérieure ne comptent plus pour la complétude, et tous les
  // membres peuvent (re)signer la nouvelle version — voir RPC `renvoyer_pv`.
  version: number;
}

export type ActionPriorite = 'haute' | 'normale' | 'faible';
// `a_valider` : le responsable a déclaré 100 % ; en attente de confirmation par le
// secrétariat (qui seul peut faire passer l'action à `terminee`).
export type ActionStatut = 'en_cours' | 'en_retard' | 'a_valider' | 'terminee';

export interface ActionCommentaire {
  id: string;
  actionId: string;
  auteurId: string;
  texte: string;
  createdAt: string;
}

// Rapport d'avancement : rédigé par le responsable à chaque mise à jour, avec une
// pièce jointe facultative. Visible du responsable, du CA et du secrétariat.
export interface ActionRapport {
  id: string;
  actionId: string;
  auteurId: string;
  texte: string;
  avancement: number; // 0-100 déclaré par ce rapport
  fichierPath?: string;
  fichierNom?: string;
  fichierType?: string;
  fichierTaille?: number;
  createdAt: string;
}

export interface Action {
  id: string;
  resolutionId?: string;
  reunionId?: string;
  titre: string;
  description?: string;
  responsableId: string;
  assignePar?: string;
  echeance?: string;
  priorite: ActionPriorite;
  avancement: number; // 0-100
  statut: ActionStatut;
  commentaires: ActionCommentaire[];
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  userId?: string;
  action: string;
  ressource?: string;
  ip?: string;
  hash?: string;
  createdAt: string;
}
