// Dossier d'archive d'UNE séance : tout ce que la séance a produit, réuni sous son
// identifiant — convocations, émargement, votes, procès-verbal, actions.
// Lecture seule : aucun écran d'archive n'écrit jamais en base.
import { supabase } from "@/lib/supabase";
import { mapVote, mapProcuration } from "@/lib/mappers";
import { voteTally } from "@/store/selectors";

export type ArchiveConvocation = { userId: string; nom: string; statut: string };
export type ArchivePresence = { userId: string; nom: string; mode: string; procurationA?: string };
export type ArchiveBulletin = { choix: string };
export type ArchiveVote = {
  id: string;
  intitule: string;
  resolutionCode: string | null;
  statut: string;
  resultat: string | null;
  closAt: string | null;
  oui: number;
  non: number;
  abstention: number;
  bulletins: number;
};
export type ArchiveSignature = {
  nom: string;
  estPresidentCA: boolean;
  methode: string;
  signedAt: string | null;
  /** Signature manuscrite tracée à l'écran (data URL) — absente si OTP ou biométrie. */
  imageBase64: string | null;
  hash: string | null;
};
export type ArchivePv = {
  id: string;
  statut: string;
  hash: string | null;
  archiveAt: string | null;
  contenu: string | null;
  signatures: ArchiveSignature[];
};
export type ArchiveAction = {
  id: string;
  titre: string;
  responsable: string | null;
  echeance: string | null;
  priorite: string | null;
  avancement: number;
  statut: string;
};

export type DossierReunion = {
  id: string;
  titre: string;
  type: string;
  date: string;
  heure: string | null;
  lieu: string | null;
  quorumRequis: number;
  ordreDuJour: { id: string; position: number; titre: string }[];
  convocations: ArchiveConvocation[];
  presences: ArchivePresence[];
  votes: ArchiveVote[];
  pv: ArchivePv | null;
  actions: ArchiveAction[];
};

type Profil = { nom: string; est_president_ca?: boolean } | null;

/** Liste des séances terminées, avec juste ce qu'il faut pour la grille. */
export type CarteReunion = {
  id: string;
  titre: string;
  type: string;
  date: string;
  lieu: string | null;
  quorumRequis: number;
  presents: number;
  pointsOJ: number;
  votes: number;
  actions: number;
  pvScelle: boolean;
};

export async function fetchCartesReunions(): Promise<CarteReunion[]> {
  const { data, error } = await supabase
    .from("reunions")
    .select(
      "id, titre, type, date_reunion, lieu, quorum_requis, presences(id), ordre_du_jour(id), votes(id), actions(id), pv(statut)",
    )
    .eq("statut", "terminee")
    .order("date_reunion", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    // `pv` remonte en tableau (relation 1-n côté PostgREST) même si une séance n'en a qu'un.
    const pv = (Array.isArray(r.pv) ? r.pv[0] : r.pv) as { statut: string } | undefined;
    return {
      id: r.id,
      titre: r.titre,
      type: r.type,
      date: r.date_reunion,
      lieu: r.lieu,
      quorumRequis: r.quorum_requis,
      presents: r.presences?.length ?? 0,
      pointsOJ: r.ordre_du_jour?.length ?? 0,
      votes: r.votes?.length ?? 0,
      actions: r.actions?.length ?? 0,
      pvScelle: pv?.statut === "signe" || pv?.statut === "archive",
    };
  });
}

export async function fetchDossierReunion(reunionId: string): Promise<DossierReunion | null> {
  const [reunionRes, convRes, presRes, procRes, votesRes, pvRes, actionsRes] = await Promise.all([
    supabase
      .from("reunions")
      .select(
        "id, titre, type, date_reunion, heure, lieu, quorum_requis, ordre_du_jour(id, position, titre)",
      )
      .eq("id", reunionId)
      .maybeSingle(),
    supabase
      .from("convocations")
      .select("user_id, statut, profiles(nom)")
      .eq("reunion_id", reunionId),
    supabase.from("presences").select("user_id, mode, profiles(nom)").eq("reunion_id", reunionId),
    supabase
      .from("procurations")
      .select("*, profiles!procurations_vers_user_id_fkey(nom)")
      .eq("reunion_id", reunionId),
    supabase.from("votes").select("*, bulletins(*)").eq("reunion_id", reunionId),
    supabase
      .from("pv")
      .select(
        "id, statut, hash_document, archive_at, contenu, version, signatures(methode, signed_at, image_base64, hash_sha256, pv_version, profiles(nom, est_president_ca))",
      )
      .eq("reunion_id", reunionId)
      .maybeSingle(),
    supabase
      .from("actions")
      .select(
        "id, titre, echeance, priorite, avancement, statut, profiles!actions_responsable_id_fkey(nom)",
      )
      .eq("reunion_id", reunionId),
  ]);

  const r = reunionRes.data;
  if (!r) return null;

  const versParDe = Object.fromEntries(
    (procRes.data ?? []).map((p) => [p.de_user_id, (p.profiles as Profil)?.nom ?? "—"]),
  );

  // Le résultat d'un scrutin se calcule directement depuis les bulletins réels
  // (pondérés par les procurations actives), pas depuis la table `resolutions`
  // — celle-ci n'est jamais alimentée par l'application (aucun `insert` nulle
  // part) : la lire donnait systématiquement `resultat: null`, affiché comme
  // « En cours » même pour un scrutin clos depuis longtemps. `voteTally` est
  // l'unique source de vérité pour ce calcul (voir `src/store/selectors.ts`,
  // même règle que le décompte secrétariat et mobile).
  const procurations = (procRes.data ?? []).map(mapProcuration);
  const votes: ArchiveVote[] = (votesRes.data ?? [])
    .map((v) => {
      const vote = mapVote(v);
      const t = voteTally(vote, procurations);
      return {
        id: v.id,
        intitule: v.intitule,
        resolutionCode: v.resolution_code,
        statut: v.statut,
        resultat: v.statut === "clos" && t.verdict !== "en_attente" ? t.verdict : null,
        closAt: v.clos_at,
        oui: t.oui,
        non: t.non,
        abstention: t.abs,
        bulletins: vote.bulletins.length,
      };
    })
    .sort((a, b) => (a.resolutionCode ?? "").localeCompare(b.resolutionCode ?? ""));

  const pvRow = pvRes.data;
  const pv: ArchivePv | null = pvRow
    ? {
        id: pvRow.id,
        statut: pvRow.statut,
        hash: pvRow.hash_document,
        archiveAt: pvRow.archive_at,
        contenu: pvRow.contenu,
        // Ne garder que les signatures de la version qui a scellé le PV — une
        // manche antérieure à un renvoi (RPC `renvoyer_pv`) reste en base
        // (immuable) mais ne doit jamais apparaître sur l'archive finale.
        signatures: (pvRow.signatures ?? [])
          .filter((s) => s.pv_version === pvRow.version)
          .map((s) => ({
            nom: (s.profiles as Profil)?.nom ?? "—",
            estPresidentCA: !!(s.profiles as Profil)?.est_president_ca,
            methode: s.methode,
            signedAt: s.signed_at,
            imageBase64: s.image_base64,
            hash: s.hash_sha256,
          }))
          .sort((a, b) => Number(b.estPresidentCA) - Number(a.estPresidentCA)),
      }
    : null;

  return {
    id: r.id,
    titre: r.titre,
    type: r.type,
    date: r.date_reunion,
    heure: r.heure,
    lieu: r.lieu,
    quorumRequis: r.quorum_requis,
    ordreDuJour: (r.ordre_du_jour ?? [])
      .map((p) => ({ id: p.id, position: p.position, titre: p.titre }))
      .sort((a, b) => a.position - b.position),
    convocations: (convRes.data ?? []).map((c) => ({
      userId: c.user_id,
      nom: (c.profiles as Profil)?.nom ?? "—",
      statut: c.statut,
    })),
    presences: (presRes.data ?? []).map((p) => ({
      userId: p.user_id,
      nom: (p.profiles as Profil)?.nom ?? "—",
      mode: p.mode,
      procurationA: p.mode === "procuration" ? versParDe[p.user_id] : undefined,
    })),
    votes,
    pv,
    actions: (actionsRes.data ?? []).map((a) => ({
      id: a.id,
      titre: a.titre,
      responsable: (a.profiles as Profil)?.nom ?? null,
      echeance: a.echeance,
      priorite: a.priorite,
      avancement: a.avancement,
      statut: a.statut,
    })),
  };
}
