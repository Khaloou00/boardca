import { supabase } from "./supabase";

// Le type (surlignage / commentaire) et la visibilité (privée / partagée) sont
// deux axes indépendants : on peut surligner en privé ou en public, commenter
// en privé ou en public. Voir migration 028_annotations_documents.
export type AnnotationType = "highlight" | "comment";
export type AnnotationVisibility = "private" | "public";

/** Cible d'une annotation : un document, le Board Book fusionné, ou le procès-verbal.
 *  Toujours exactement une (contrainte `annotations_une_seule_cible`, migr. 029/037). */
export type AnnotationCible = { documentId: string } | { boardBookId: string } | { pvId: string };

const filtreCible = (c: AnnotationCible) =>
  "documentId" in c
    ? { colonne: "document_id" as const, valeur: c.documentId }
    : "boardBookId" in c
      ? { colonne: "board_book_id" as const, valeur: c.boardBookId }
      : { colonne: "pv_id" as const, valeur: c.pvId };

export interface DocAnnotation {
  id: string;
  documentId: string | null;
  boardBookId: string | null;
  pvId: string | null;
  userId: string;
  type: AnnotationType;
  visibility: AnnotationVisibility;
  /** Page 1-indexée. */
  page: number;
  /** Offset du 1er caractère dans le texte concaténé de la page. */
  debut: number;
  longueur: number;
  /** Passage sélectionné : repli d'affichage si l'ancrage ne résout plus. */
  texte: string;
  note?: string;
  createdAt: string;
  auteurNom?: string;
  /** Troisième axe de partage, indépendant de `visibility` (toujours privée/
   *  publique) : lisible en plus par UNE personne précise — le binôme
   *  mandant/mandataire d'une procuration active sur la réunion concernée
   *  (RLS `annotations_insert_self` refuse toute autre cible). */
  partageAvecUserId?: string;
  partageAvecNom?: string;
  /** Manche de signature du PV annoté (voir `PV.version`). Renseigné pour les
   *  seules annotations ciblant un PV : après un renvoi corrigé, celles des
   *  versions précédentes ne portent plus sur le texte affiché. `undefined`
   *  pour un document du Board Book ou le recueil fusionné (pas de version). */
  pvVersion?: number;
}

type Row = {
  id: string;
  document_id: string | null;
  board_book_id: string | null;
  pv_id: string | null;
  user_id: string;
  type: string;
  visibility: string;
  page: number;
  debut: number;
  longueur: number;
  texte: string;
  note: string | null;
  created_at: string;
  partage_avec_user_id: string | null;
  pv_version: number | null;
  profiles?: { nom: string } | null;
  partage?: { nom: string } | null;
};

const mapAnnotation = (r: Row): DocAnnotation => ({
  id: r.id,
  documentId: r.document_id,
  boardBookId: r.board_book_id,
  pvId: r.pv_id,
  userId: r.user_id,
  type: r.type as AnnotationType,
  visibility: r.visibility as AnnotationVisibility,
  page: r.page,
  debut: r.debut,
  longueur: r.longueur,
  texte: r.texte,
  note: r.note ?? undefined,
  createdAt: r.created_at,
  auteurNom: r.profiles?.nom,
  partageAvecUserId: r.partage_avec_user_id ?? undefined,
  partageAvecNom: r.partage?.nom ?? undefined,
  pvVersion: r.pv_version ?? undefined,
});

// La RLS ne renvoie que : mes annotations + celles marquées « partagées » +
// celles ciblant explicitement l'utilisateur courant via `partage_avec_user_id`.
const SELECT =
  "*, profiles!annotations_user_id_fkey(nom), partage:profiles!annotations_partage_avec_user_id_fkey(nom)";

export async function fetchAnnotations(cible: AnnotationCible): Promise<DocAnnotation[]> {
  const { colonne, valeur } = filtreCible(cible);
  const { data, error } = await supabase
    .from("annotations")
    .select(SELECT)
    .eq(colonne, valeur)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapAnnotation);
}

/** Toutes les annotations visibles d'une séance : ses documents ET son Board
 *  Book fusionné (écran « Mes annotations »). */
export async function fetchAnnotationsDeLaSeance(
  documentIds: string[],
  boardBookId?: string | null,
): Promise<DocAnnotation[]> {
  const clauses: string[] = [];
  if (documentIds.length > 0) clauses.push(`document_id.in.(${documentIds.join(",")})`);
  if (boardBookId) clauses.push(`board_book_id.eq.${boardBookId}`);
  if (clauses.length === 0) return [];
  const { data, error } = await supabase
    .from("annotations")
    .select(SELECT)
    .or(clauses.join(","))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapAnnotation);
}

export async function createAnnotation(input: {
  cible: AnnotationCible;
  userId: string;
  type: AnnotationType;
  visibility: AnnotationVisibility;
  page: number;
  debut: number;
  longueur: number;
  texte: string;
  note?: string;
  /** Personne précise pouvant lire cette annotation en plus de l'auteur —
   *  voir `DocAnnotation.partageAvecUserId`. */
  partageAvecUserId?: string;
  /** Manche courante du PV annoté — voir `DocAnnotation.pvVersion`. Ignoré
   *  (null en base) pour une cible document/Board Book. */
  pvVersion?: number;
}): Promise<DocAnnotation> {
  const { data, error } = await supabase
    .from("annotations")
    .insert({
      document_id: "documentId" in input.cible ? input.cible.documentId : null,
      board_book_id: "boardBookId" in input.cible ? input.cible.boardBookId : null,
      pv_id: "pvId" in input.cible ? input.cible.pvId : null,
      user_id: input.userId,
      type: input.type,
      visibility: input.visibility,
      page: input.page,
      debut: input.debut,
      longueur: input.longueur,
      texte: input.texte,
      note: input.note ?? null,
      partage_avec_user_id: input.partageAvecUserId ?? null,
      pv_version: "pvId" in input.cible ? (input.pvVersion ?? null) : null,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return mapAnnotation(data as unknown as Row);
}

/** La RLS interdit déjà de supprimer l'annotation d'autrui. */
export async function deleteAnnotation(id: string): Promise<void> {
  const { error } = await supabase.from("annotations").delete().eq("id", id);
  if (error) throw error;
}
