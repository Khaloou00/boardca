// Convertit les Row Supabase (snake_case, générées dans database.types.ts)
// vers les types domaine front (camelCase, relations imbriquées) de src/types/domain.ts.
import type { Tables } from "./database.types";
import { normaliserDocType } from "./doc-types";
import type {
  User,
  Comite,
  PointOJ,
  Reunion,
  Document,
  BoardBook,
  Convocation,
  Presence,
  Procuration,
  Bulletin,
  Vote,
  Resolution,
  Signature,
  PV,
  ActionCommentaire,
  Action,
  AuditEntry,
} from "@/types/domain";

export function mapUser(row: Tables<"profiles">, comiteIds: string[] = []): User {
  return {
    id: row.id,
    nom: row.nom,
    email: row.email,
    telephone: row.telephone ?? undefined,
    role: row.role,
    qualite: row.qualite ?? undefined,
    statut: row.statut as User["statut"],
    initiales: row.avatar_initiales ?? row.nom.slice(0, 2).toUpperCase(),
    comiteIds,
    derniereConnexion: row.derniere_connexion ?? undefined,
    estPresidentCA: row.est_president_ca,
    mustChangePassword: row.must_change_password,
  };
}

export function mapComite(row: Tables<"comites">, membreIds: string[] = []): Comite {
  return {
    id: row.id,
    nom: row.nom,
    description: row.description ?? undefined,
    presidentId: row.president_id ?? undefined,
    membreIds,
  };
}

export function mapPointOJ(row: Tables<"ordre_du_jour">): PointOJ {
  return {
    id: row.id,
    position: row.position,
    titre: row.titre,
    dureeMin: row.duree_min ?? undefined,
    obligatoire: row.obligatoire,
  };
}

export function mapReunion(row: Tables<"reunions">, ordreDuJour: PointOJ[] = []): Reunion {
  return {
    id: row.id,
    type: row.type as Reunion["type"],
    titre: row.titre,
    date: row.date_reunion,
    // Postgres `time` se sérialise en "HH:MM:SS" ; le domaine attend "HH:MM".
    heure: row.heure?.slice(0, 5) ?? undefined,
    dureeMin: row.duree_min ?? undefined,
    lieu: row.lieu ?? undefined,
    lienVisio: row.lien_visio ?? undefined,
    statut: row.statut as Reunion["statut"],
    quorumRequis: row.quorum_requis,
    comiteId: row.comite_id ?? undefined,
    ordreDuJour: [...ordreDuJour].sort((a, b) => a.position - b.position),
    createdBy: row.created_by ?? undefined,
    presidentSeanceId: row.president_seance_id ?? undefined,
    cloutureeAt: row.cloturee_at ?? undefined,
  };
}

export function mapDocument(row: Tables<"documents">): Document {
  return {
    id: row.id,
    reunionId: row.reunion_id,
    pointOjId: row.point_oj_id,
    nom: row.nom,
    // `documents.type` est du texte libre : on ramène toute valeur inattendue
    // sur `autre` plutôt que de la caster aveuglément en DocType.
    type: normaliserDocType(row.type),
    tailleBytes: row.taille_bytes ?? 0,
    pages: row.pages ?? undefined,
    storagePath: row.storage_path ?? undefined,
    contenu: row.contenu ?? undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapBoardBook(row: Tables<"board_books">): BoardBook {
  return {
    id: row.id,
    reunionId: row.reunion_id,
    pages: row.pages ?? undefined,
    tailleBytes: row.taille_bytes ?? undefined,
    storagePath: row.storage_path ?? undefined,
    hash: row.hash_sha256 ?? undefined,
    genereePar: row.genere_par ?? undefined,
    genereeAt: row.genere_at ?? new Date().toISOString(),
  };
}

export function mapConvocation(row: Tables<"convocations">): Convocation {
  return {
    id: row.id,
    reunionId: row.reunion_id,
    userId: row.user_id,
    statut: row.statut as Convocation["statut"],
    sentAt: row.sent_at ?? undefined,
    openedAt: row.opened_at ?? undefined,
  };
}

export function mapPresence(row: Tables<"presences">): Presence {
  return {
    id: row.id,
    reunionId: row.reunion_id,
    userId: row.user_id,
    mode: row.mode as Presence["mode"],
    scannedAt: row.scanned_at ?? new Date().toISOString(),
  };
}

export function mapProcuration(row: Tables<"procurations">): Procuration {
  return {
    id: row.id,
    reunionId: row.reunion_id,
    deUserId: row.de_user_id,
    versUserId: row.vers_user_id,
    statut: row.statut as Procuration["statut"],
    createdAt: row.created_at,
  };
}

export function mapBulletin(row: Tables<"bulletins">): Bulletin {
  return {
    id: row.id,
    voteId: row.vote_id,
    userId: row.user_id,
    choix: row.choix as Bulletin["choix"],
    votedAt: row.voted_at ?? new Date().toISOString(),
  };
}

export function mapVote(row: Tables<"votes"> & { bulletins?: Tables<"bulletins">[] }): Vote {
  return {
    id: row.id,
    reunionId: row.reunion_id,
    resolutionCode: row.resolution_code ?? undefined,
    intitule: row.intitule,
    statut: row.statut as Vote["statut"],
    ouvertAt: row.ouvert_at ?? new Date().toISOString(),
    closAt: row.clos_at ?? undefined,
    cloturePrevue: row.cloture_prevue ?? undefined,
    bulletins: (row.bulletins ?? []).map(mapBulletin),
  };
}

export function mapResolution(row: Tables<"resolutions">): Resolution {
  return {
    id: row.id,
    reunionId: row.reunion_id,
    code: row.code,
    texte: row.texte,
    voteId: row.vote_id ?? undefined,
    resultat: (row.resultat ?? "en_attente") as Resolution["resultat"],
  };
}

export function mapSignature(row: Tables<"signatures">): Signature {
  return {
    id: row.id,
    pvId: row.pv_id,
    userId: row.user_id,
    methode: row.methode as Signature["methode"],
    imageBase64: row.image_base64 ?? undefined,
    hash: row.hash_sha256 ?? undefined,
    signedAt: row.signed_at ?? new Date().toISOString(),
    pvVersion: row.pv_version,
  };
}

export function mapPV(row: Tables<"pv"> & { signatures?: Tables<"signatures">[] }): PV {
  return {
    id: row.id,
    reunionId: row.reunion_id,
    contenu: row.contenu ?? "",
    statut: row.statut as PV["statut"],
    hashDocument: row.hash_document ?? undefined,
    archiveAt: row.archive_at ?? undefined,
    signatures: (row.signatures ?? []).map(mapSignature),
    version: row.version,
  };
}

export function mapActionComment(row: Tables<"action_commentaires">): ActionCommentaire {
  return {
    id: row.id,
    actionId: row.action_id,
    auteurId: row.auteur_id,
    texte: row.texte,
    createdAt: row.created_at,
  };
}

export function mapAction(
  row: Tables<"actions"> & { action_commentaires?: Tables<"action_commentaires">[] },
): Action {
  return {
    id: row.id,
    resolutionId: row.resolution_id ?? undefined,
    reunionId: row.reunion_id ?? undefined,
    titre: row.titre,
    description: row.description ?? undefined,
    responsableId: row.responsable_id,
    assignePar: row.assigne_par ?? undefined,
    echeance: row.echeance ?? undefined,
    priorite: (row.priorite ?? "normale") as Action["priorite"],
    avancement: row.avancement,
    statut: row.statut as Action["statut"],
    commentaires: (row.action_commentaires ?? []).map(mapActionComment),
    createdAt: row.created_at,
  };
}

export function mapAuditEntry(row: Tables<"audit_log">): AuditEntry {
  return {
    id: String(row.id),
    userId: row.user_id ?? undefined,
    action: row.action,
    ressource: row.ressource ?? undefined,
    ip: row.ip ? String(row.ip) : undefined,
    hash: row.hash_sha256 ?? undefined,
    createdAt: row.created_at,
  };
}
