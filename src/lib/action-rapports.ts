import { supabase } from "@/lib/supabase";
import type { ActionRapport } from "@/types/domain";
import type { Tables } from "@/lib/database.types";

export const MAX_RAPPORT_BYTES = 25 * 1024 * 1024;

function mapRapport(row: Tables<"action_rapports">): ActionRapport {
  return {
    id: row.id,
    actionId: row.action_id,
    auteurId: row.auteur_id,
    texte: row.texte,
    avancement: row.avancement,
    fichierPath: row.fichier_path ?? undefined,
    fichierNom: row.fichier_nom ?? undefined,
    fichierType: row.fichier_type ?? undefined,
    fichierTaille: row.fichier_taille ?? undefined,
    createdAt: row.created_at,
  };
}

// Rapports d'une action, du plus récent au plus ancien. La RLS filtre déjà la
// portée (responsable / membre du CA / secrétariat).
export async function fetchRapportsAction(actionId: string): Promise<ActionRapport[]> {
  const { data, error } = await supabase
    .from("action_rapports")
    .select("*")
    .eq("action_id", actionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRapport);
}

// Envoi de la pièce jointe (facultative) dans le bucket privé, sous un dossier
// portant l'id de l'action — la policy Storage autorise le responsable de cette
// action à écrire là. Renvoie les métadonnées à joindre au rapport.
export async function uploadPieceJointe(actionId: string, file: File) {
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const path = `action-rapports/${actionId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage
    .from("boardca-docs")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return { path, nom: file.name, type: file.type || "application/octet-stream", taille: file.size };
}

// Soumission d'un rapport d'avancement (RPC : le serveur vérifie le responsable,
// enregistre le rapport, met à jour l'avancement/le statut et notifie le CA).
export async function soumettreRapport(params: {
  actionId: string;
  texte: string;
  avancement: number;
  fichier?: { path: string; nom: string; type: string; taille: number };
}) {
  const { error } = await supabase.rpc("soumettre_rapport_action", {
    p_action_id: params.actionId,
    p_texte: params.texte,
    p_avancement: params.avancement,
    p_fichier_path: params.fichier?.path,
    p_fichier_nom: params.fichier?.nom,
    p_fichier_type: params.fichier?.type,
    p_fichier_taille: params.fichier?.taille,
  });
  if (error) throw error;
}

// Confirmation de clôture par le secrétariat : l'action passe à « terminée ».
export async function confirmerCloture(actionId: string) {
  const { error } = await supabase.rpc("confirmer_cloture_action", { p_action_id: actionId });
  if (error) throw error;
}

// Renvoi pour compléments : le secrétariat repasse l'action « en cours ».
export async function renvoyerAction(actionId: string, motif?: string) {
  const { error } = await supabase.rpc("renvoyer_action", {
    p_action_id: actionId,
    p_motif: motif,
  });
  if (error) throw error;
}

// Lien signé pour consulter une pièce jointe.
export async function lienPieceJointe(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("boardca-docs").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
