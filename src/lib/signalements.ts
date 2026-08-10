import { supabase } from "./supabase";

// Signalement d'un problème (migration 033), en rapport avec une action.
// L'insertion déclenche un trigger Postgres qui RELAIE le signalement à la
// Secrétaire et à tous les membres du CA via des notifications temps réel.

export type SignalementCategorie = "anomalie" | "acces" | "suggestion" | "autre";

export const SIGNALEMENT_CATEGORIES: { key: SignalementCategorie; label: string }[] = [
  { key: "anomalie", label: "Anomalie" },
  { key: "acces", label: "Accès / connexion" },
  { key: "suggestion", label: "Suggestion" },
  { key: "autre", label: "Autre" },
];

export async function creerSignalement(input: {
  auteurId: string;
  categorie: SignalementCategorie;
  sujet: string;
  description: string;
  actionId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("signalements").insert({
    auteur_id: input.auteurId,
    categorie: input.categorie,
    sujet: input.sujet.trim(),
    description: input.description.trim(),
    action_id: input.actionId ?? null,
  });
  if (error) throw error;

  // Trace au journal d'audit — best-effort, ne fait pas échouer le signalement.
  const label = SIGNALEMENT_CATEGORIES.find((c) => c.key === input.categorie)?.label ?? input.categorie;
  supabase
    .rpc("log_event", { p_action: `Signalement (${label})`, p_ressource: input.sujet.trim() })
    .then(
      () => undefined,
      () => undefined,
    );
}
