import type { StateCreator } from "zustand";
import { supabase } from "@/lib/supabase";
import { mapUser, mapComite } from "@/lib/mappers";
import type { BoardStore, UsersSlice } from "../types";

// Traduit les messages d'erreur techniques de l'edge function en français lisible.
const TRAD_ERREUR: [RegExp, string][] = [
  [/already been registered|already exists/i, "Un compte existe déjà avec cet email."],
  [/at least .* characters|password/i, "Le mot de passe doit faire au moins 8 caractères."],
  [/invalid.*email|email.*invalid/i, "Adresse email invalide."],
  [/Réservé au Super/i, "Action réservée au Super Administrateur."],
];

// `functions.invoke` n'expose pas le corps d'un 4xx : on le lit sur la Response
// portée par `error.context` (FunctionsHttpError), puis on traduit le motif.
export async function messageErreurEdge(error: unknown, defaut: string): Promise<string> {
  let brut = "";
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.clone().json();
      brut = typeof body?.error === "string" ? body.error : "";
    } catch {
      /* corps non-JSON : on garde le message par défaut */
    }
  }
  if (!brut) return defaut;
  const trad = TRAD_ERREUR.find(([re]) => re.test(brut));
  return trad ? trad[1] : brut;
}

// Regroupe les lignes comite_membres en deux index : userId -> comiteIds[], comiteId -> userIds[].
function groupMembres(rows: { comite_id: string; user_id: string }[]) {
  const byUser = new Map<string, string[]>();
  const byComite = new Map<string, string[]>();
  for (const r of rows) {
    byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.comite_id]);
    byComite.set(r.comite_id, [...(byComite.get(r.comite_id) ?? []), r.user_id]);
  }
  return { byUser, byComite };
}

export const createUsersSlice: StateCreator<BoardStore, [], [], UsersSlice> = (set, get) => ({
  users: [],
  comites: [],
  usersLoading: false,

  fetchUsers: async () => {
    set({ usersLoading: true });
    const [{ data: rows }, { data: membres }] = await Promise.all([
      supabase.from("profiles").select("*").order("nom"),
      supabase.from("comite_membres").select("comite_id, user_id"),
    ]);
    const { byUser } = groupMembres(membres ?? []);
    set({
      users: (rows ?? []).map((r) => mapUser(r, byUser.get(r.id) ?? [])),
      usersLoading: false,
    });
  },

  fetchComites: async () => {
    const [{ data: rows }, { data: membres }] = await Promise.all([
      supabase.from("comites").select("*").order("nom"),
      supabase.from("comite_membres").select("comite_id, user_id"),
    ]);
    const { byComite } = groupMembres(membres ?? []);
    set({ comites: (rows ?? []).map((c) => mapComite(c, byComite.get(c.id) ?? [])) });
  },

  addUser: async (u) => {
    // Aucun mot de passe transmis : l'edge function crée le compte sans mot de
    // passe et envoie un lien d'activation par email (voir admin-users).
    const { data, error } = await supabase.functions.invoke<{
      id: string;
      emailSent: boolean;
      emailError?: string;
      lien?: string;
    }>("admin-users", {
      body: { action: "create", ...u },
    });
    // Sur un 4xx, `functions.invoke` ne remonte qu'un message générique : le vrai
    // motif ("email déjà enregistré"…) est dans le corps de la réponse. On le lit
    // pour l'afficher à l'utilisateur, sinon il ne saurait pas pourquoi ça échoue.
    if (error || !data) {
      throw new Error(await messageErreurEdge(error, "Échec de la création du compte"));
    }
    // À partir d'ici le COMPTE EXISTE. Les étapes suivantes (journal, rechargement)
    // ne doivent JAMAIS faire échouer la création : sinon on afficherait « échec »
    // alors que le compte est créé, et la relance échouerait en doublon.
    try {
      await get().logEvent("Création utilisateur", `${u.nom} (${u.role})`);
      await get().fetchUsers();
    } catch (e) {
      console.error("Compte créé, mais post-traitement en échec", e);
    }
    return data;
  },

  updateUser: async (id, patch) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        nom: patch.nom,
        telephone: patch.telephone,
        qualite: patch.qualite,
        statut: patch.statut,
        role: patch.role,
      })
      .eq("id", id);
    if (error) throw error;
    await get().logEvent("Modification utilisateur", id);
    await get().fetchUsers();
  },

  removeUser: async (id) => {
    const { error } = await supabase.functions.invoke("admin-users", {
      body: { action: "delete", id },
    });
    if (error) throw error;
    await get().logEvent("Suppression utilisateur", id);
    await get().fetchUsers();
  },

  setPresidentCA: async (userId) => {
    const { error } = await supabase.rpc("set_president_ca", { p_user_id: userId ?? undefined });
    if (error) throw error;
    await get().logEvent("Désignation PCA", userId ?? "retrait");
    await get().fetchUsers();
  },

  addComite: async (c) => {
    const { data, error } = await supabase
      .from("comites")
      .insert({ nom: c.nom, description: c.description, president_id: c.presidentId })
      .select("id")
      .single();
    if (error || !data) throw error;
    await get().logEvent("Création comité", c.nom);
    await get().fetchComites();
    return data.id;
  },

  updateComite: async (id, patch) => {
    const { error } = await supabase
      .from("comites")
      .update({ nom: patch.nom, description: patch.description, president_id: patch.presidentId })
      .eq("id", id);
    if (error) throw error;
    await get().logEvent("Modification comité", id);
    await get().fetchComites();
  },

  removeComite: async (id) => {
    const { error } = await supabase.from("comites").delete().eq("id", id);
    if (error) throw error;
    await get().logEvent("Suppression comité", id);
    await get().fetchComites();
  },

  addComiteMembre: async (comiteId, userId) => {
    const { error } = await supabase.from("comite_membres").insert({ comite_id: comiteId, user_id: userId });
    if (error) throw error;
    await get().fetchComites();
    await get().fetchUsers();
  },

  removeComiteMembre: async (comiteId, userId) => {
    const { error } = await supabase
      .from("comite_membres")
      .delete()
      .eq("comite_id", comiteId)
      .eq("user_id", userId);
    if (error) throw error;
    await get().fetchComites();
    await get().fetchUsers();
  },
});
