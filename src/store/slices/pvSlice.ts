import type { StateCreator } from "zustand";
import { sha256 } from "js-sha256";
import { supabase } from "@/lib/supabase";
import { mapPV } from "@/lib/mappers";
import type { PvStatut } from "@/types/domain";
import type { BoardStore, PvSlice } from "../types";

export const createPvSlice: StateCreator<BoardStore, [], [], PvSlice> = (set, get) => ({
  pvs: [],
  pvLoading: false,
  pvStatuts: {},

  // Léger : juste de quoi classer chaque réunion "En cours"/"Archives" dans la
  // grille du Procès-verbal (voir `SectionBrowser`), sans charger le contenu ni
  // les signatures de tous les PV.
  fetchPvStatuts: async () => {
    const { data } = await supabase.from("pv").select("reunion_id, statut");
    set({
      pvStatuts: Object.fromEntries((data ?? []).map((r) => [r.reunion_id, r.statut as PvStatut])),
    });
  },

  fetchPV: async (reunionId) => {
    set({ pvLoading: true });
    const { data } = await supabase
      .from("pv")
      .select("*, signatures(*)")
      .eq("reunion_id", reunionId)
      .maybeSingle();
    set((s) => ({
      pvs: [...s.pvs.filter((p) => p.reunionId !== reunionId), ...(data ? [mapPV(data)] : [])],
      pvLoading: false,
      // Tient `pvStatuts` synchro sans attendre un `fetchPvStatuts` complet — la
      // grille reflète immédiatement l'envoi pour signature / le scellement.
      pvStatuts: data ? { ...s.pvStatuts, [reunionId]: data.statut as PvStatut } : s.pvStatuts,
    }));
  },

  ensurePV: async (reunionId) => {
    const existing = get().pvs.find((p) => p.reunionId === reunionId);
    if (existing) return existing.id;

    const { data: found } = await supabase.from("pv").select("id").eq("reunion_id", reunionId).maybeSingle();
    if (found) {
      await get().fetchPV(reunionId);
      return found.id;
    }

    const { data, error } = await supabase
      .from("pv")
      .insert({ reunion_id: reunionId, contenu: "", statut: "brouillon" })
      .select("id")
      .single();
    if (error || !data) throw error;
    await get().fetchPV(reunionId);
    return data.id;
  },

  updatePVContent: async (pvId, contenu) => {
    const pv = get().pvs.find((p) => p.id === pvId);
    const { error } = await supabase.from("pv").update({ contenu }).eq("id", pvId);
    if (error) throw error;
    if (pv) await get().fetchPV(pv.reunionId);
  },

  // RPC `renvoyer_pv` : 1er envoi (brouillon→en_signature, version inchangée)
  // OU renvoi d'une manche déjà en cours (version += 1) — dans les deux cas le
  // trigger `notify_pv` notifie tous les membres, et une version incrémentée
  // fait repartir les signatures à zéro (les anciennes restent en base, voir
  // `Signature.pvVersion`) sans jamais les effacer (immuables).
  sendForSignature: async (pvId) => {
    const pv = get().pvs.find((p) => p.id === pvId);
    const { error } = await supabase.rpc("renvoyer_pv", { p_pv_id: pvId });
    if (error) throw error;
    await get().logEvent("Envoi PV pour signature", pvId);
    if (pv) await get().fetchPV(pv.reunionId);
  },

  signPV: async (pvId, userId, methode, imageBase64) => {
    const pv = get().pvs.find((p) => p.id === pvId);
    const hash = sha256(`${pvId}|${userId}|${methode}|${new Date().toISOString()}`);
    const { error } = await supabase.from("signatures").insert({
      pv_id: pvId,
      user_id: userId,
      methode,
      image_base64: imageBase64,
      hash_sha256: hash,
      pv_version: pv?.version ?? 1,
    });
    if (error) throw error;
    await get().logEvent("signature certifiée PV", pvId);
    if (pv) await get().fetchPV(pv.reunionId); // le trigger DB passe le PV en 'signe' si complet
  },
});
