import type { StateCreator } from "zustand";
import { supabase } from "@/lib/supabase";
import { mapPresence, mapProcuration, mapConvocation } from "@/lib/mappers";
import { messageErreurEdge } from "./usersSlice";
import type { BoardStore, PresencesSlice } from "../types";

export const createPresencesSlice: StateCreator<BoardStore, [], [], PresencesSlice> = (set, get) => ({
  presences: [],
  procurations: [],
  convocations: [],
  presencesLoading: false,

  fetchPresences: async (reunionId) => {
    set({ presencesLoading: true });
    const { data } = await supabase.from("presences").select("*").eq("reunion_id", reunionId);
    set((s) => ({
      presences: [...s.presences.filter((p) => p.reunionId !== reunionId), ...(data ?? []).map(mapPresence)],
      presencesLoading: false,
    }));
  },

  fetchProcurations: async (reunionId) => {
    const { data } = await supabase.from("procurations").select("*").eq("reunion_id", reunionId);
    set((s) => ({
      procurations: [...s.procurations.filter((p) => p.reunionId !== reunionId), ...(data ?? []).map(mapProcuration)],
    }));
  },

  fetchConvocations: async (reunionId) => {
    const { data } = await supabase.from("convocations").select("*").eq("reunion_id", reunionId);
    set((s) => ({
      convocations: [...s.convocations.filter((c) => c.reunionId !== reunionId), ...(data ?? []).map(mapConvocation)],
    }));
  },

  scanPresence: async (reunionId, userId, mode = "presentiel") => {
    const { error } = await supabase
      .from("presences")
      .upsert({ reunion_id: reunionId, user_id: userId, mode }, { onConflict: "reunion_id,user_id" });
    if (error) throw error;
    await get().logEvent("Scan QR présence", reunionId);
    await get().fetchPresences(reunionId);
  },

  setPresence: async (reunionId, userId, mode) => {
    const { error } = await supabase
      .from("presences")
      .upsert({ reunion_id: reunionId, user_id: userId, mode }, { onConflict: "reunion_id,user_id" });
    if (error) throw error;
    await get().fetchPresences(reunionId);
  },

  removePresence: async (reunionId, userId) => {
    const { error } = await supabase
      .from("presences")
      .delete()
      .eq("reunion_id", reunionId)
      .eq("user_id", userId);
    if (error) throw error;
    await get().fetchPresences(reunionId);
  },

  addProcuration: async (reunionId, de, vers) => {
    const { error } = await supabase
      .from("procurations")
      .upsert(
        { reunion_id: reunionId, de_user_id: de, vers_user_id: vers },
        { onConflict: "reunion_id,de_user_id" },
      );
    if (error) throw error;
    await get().fetchProcurations(reunionId);

    // La procuration existe déjà : un échec d'envoi ne doit jamais faire
    // paraître la désignation elle-même en échec (même logique que l'email
    // non bloquant de `inviterExterne`).
    const { data, error: mailError } = await supabase.functions.invoke<{
      emailSent: boolean;
      emailError?: string;
    }>("procuration-notify", { body: { reunionId } });
    if (mailError || !data) {
      return { emailSent: false, emailError: await messageErreurEdge(mailError, "Échec de l'envoi") };
    }
    return data;
  },

  inviterExterne: async (reunionId, d) => {
    const { data, error } = await supabase.functions.invoke<{
      guestId: string;
      emailSent: boolean;
      emailError?: string;
      lien?: string;
    }>("invite-guest", {
      body: {
        reunionId,
        nom: d.nom,
        prenom: d.prenom,
        email: d.email.trim().toLowerCase(),
        motif: d.motif || undefined,
      },
    });
    if (error || !data) {
      throw new Error(await messageErreurEdge(error, "Échec de la désignation de l'invité"));
    }
    await get().fetchProcurations(reunionId);
    return data;
  },

  revoquerProcuration: async (reunionId) => {
    const { profile } = get();
    if (!profile) return;
    const { error } = await supabase
      .from("procurations")
      .update({ statut: "revoquee", revoked_at: new Date().toISOString() })
      .eq("reunion_id", reunionId)
      .eq("de_user_id", profile.id);
    if (error) throw error;
    await get().fetchProcurations(reunionId);
  },

  sendConvocations: async (reunionId, userIds) => {
    const rows = userIds.map((userId) => ({
      reunion_id: reunionId,
      user_id: userId,
      statut: "sent" as const,
      sent_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("convocations").upsert(rows, { onConflict: "reunion_id,user_id" });
    if (error) throw error;
    await get().logEvent("Envoi convocations", `${reunionId} → ${userIds.length} destinataires`);
    await get().fetchConvocations(reunionId);
  },

  confirmConvocation: async (reunionId, userId, statut) => {
    const { error } = await supabase
      .from("convocations")
      .update({ statut })
      .eq("reunion_id", reunionId)
      .eq("user_id", userId);
    if (error) throw error;
    await get().fetchConvocations(reunionId);
  },
});
