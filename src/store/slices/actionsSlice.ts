import type { StateCreator } from "zustand";
import { supabase } from "@/lib/supabase";
import { mapAction } from "@/lib/mappers";
import {
  soumettreRapport,
  confirmerCloture,
  renvoyerAction as renvoyerActionRpc,
} from "@/lib/action-rapports";
import type { BoardStore, ActionsSlice } from "../types";

export const createActionsSlice: StateCreator<BoardStore, [], [], ActionsSlice> = (set, get) => ({
  actions: [],
  actionsLoading: false,

  fetchActions: async () => {
    set({ actionsLoading: true });
    // Les RLS restreignent déjà la portée (responsable OU secrétaire/super_admin).
    const { data } = await supabase
      .from("actions")
      .select("*, action_commentaires(*)")
      .order("created_at", { ascending: false });
    set({ actions: (data ?? []).map(mapAction), actionsLoading: false });
  },

  assignAction: async (a) => {
    const { data, error } = await supabase
      .from("actions")
      .insert({
        titre: a.titre,
        description: a.description,
        responsable_id: a.responsableId,
        reunion_id: a.reunionId,
        resolution_id: a.resolutionId,
        echeance: a.echeance,
        priorite: a.priorite ?? "normale",
        assigne_par: get().profile?.id,
      })
      .select("id")
      .single();
    if (error || !data) throw error;
    await get().logEvent("Attribution action", `${data.id} → ${a.responsableId}`);
    await get().fetchActions();
    return data.id;
  },

  updateAvancement: async (actionId, avancement, commentaire) => {
    const statut = avancement >= 100 ? "terminee" : "en_cours";
    const { error } = await supabase
      .from("actions")
      .update({ avancement, statut })
      .eq("id", actionId);
    if (error) throw error;
    if (commentaire) await get().addActionComment(actionId, commentaire);
    await get().logEvent("Mise à jour avancement action", `${actionId} → ${avancement}%`);
    await get().fetchActions();
  },

  addActionComment: async (actionId, texte) => {
    const auteurId = get().profile?.id;
    if (!auteurId) throw new Error("Non authentifié");
    const { error } = await supabase
      .from("action_commentaires")
      .insert({ action_id: actionId, auteur_id: auteurId, texte });
    if (error) throw error;
    await get().fetchActions();
  },

  soumettreRapportAction: async (params) => {
    await soumettreRapport(params);
    await get().fetchActions();
  },

  confirmerClotureAction: async (actionId) => {
    await confirmerCloture(actionId);
    await get().logEvent("Confirmation clôture action", actionId);
    await get().fetchActions();
  },

  renvoyerAction: async (actionId, motif) => {
    await renvoyerActionRpc(actionId, motif);
    await get().logEvent("Renvoi action pour compléments", actionId);
    await get().fetchActions();
  },
});
