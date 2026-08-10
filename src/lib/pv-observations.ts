import { supabase } from "@/lib/supabase";

// Observations partagées sur un PV (migration 036). Signer vaut approbation ; une
// observation — surtout une désapprobation — est la voix du membre qui ne signe pas.
// Elle est visible de tous les membres du CA et du secrétariat, et immuable.

export type TypeObservation = "observation" | "desapprobation";

export type PvObservation = {
  id: string;
  pvId: string;
  userId: string;
  texte: string;
  type: TypeObservation;
  createdAt: string;
  auteurNom?: string;
  // Manche de signature (voir pv.version) sur laquelle cette position a été
  // prise — permanente comme le reste (jamais supprimée), mais ne doit
  // bloquer la signature/réémission que pour CETTE manche : un renvoi après
  // correction ouvre une nouvelle manche où chacun peut à nouveau se
  // prononcer, sans rester coincé par une désapprobation d'une version révolue.
  pvVersion: number;
};

type Ligne = {
  id: string;
  pv_id: string;
  user_id: string;
  texte: string;
  type: string;
  created_at: string;
  pv_version: number;
  profiles?: { nom: string } | null;
};

const mapper = (r: Ligne): PvObservation => ({
  id: r.id,
  pvId: r.pv_id,
  userId: r.user_id,
  texte: r.texte,
  type: r.type as TypeObservation,
  createdAt: r.created_at,
  auteurNom: r.profiles?.nom,
  pvVersion: r.pv_version,
});

export async function fetchPvObservations(pvId: string): Promise<PvObservation[]> {
  const { data, error } = await supabase
    .from("pv_observations")
    .select(
      "id, pv_id, user_id, texte, type, created_at, pv_version, profiles!pv_observations_user_id_fkey(nom)",
    )
    .eq("pv_id", pvId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Ligne[]).map(mapper);
}

export async function ajouterPvObservation(
  pvId: string,
  userId: string,
  texte: string,
  type: TypeObservation,
  pvVersion: number,
): Promise<void> {
  const { error } = await supabase
    .from("pv_observations")
    .insert({ pv_id: pvId, user_id: userId, texte: texte.trim(), type, pv_version: pvVersion });
  if (error) throw error;
}
