import type { StateCreator } from "zustand";
import { supabase } from "@/lib/supabase";
import { mapUser } from "@/lib/mappers";
import type { BoardStore, AuthSlice } from "../types";

export const createAuthSlice: StateCreator<BoardStore, [], [], AuthSlice> = (set, get) => ({
  profile: null,
  authLoading: false,
  // Passe à true une fois la 1re résolution de session terminée : distingue
  // « pas encore chargé » de « chargé et non connecté » pour les gardes d'accès.
  authReady: false,

  login: async (email, password) => {
    set({ authLoading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ authLoading: false });
      throw error;
    }
    await get().loadProfile();
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ profile: null });
  },

  completePasswordChange: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    // Efface le drapeau (RPC restreint à auth.uid()) puis recharge le profil.
    await supabase.rpc("clear_password_change_flag");
    await get().loadProfile();
  },

  loadProfile: async () => {
    set({ authLoading: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      set({ profile: null, authLoading: false, authReady: true });
      return;
    }
    const [{ data: row }, { data: membres }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("comite_membres").select("comite_id").eq("user_id", user.id),
    ]);
    if (!row) {
      set({ profile: null, authLoading: false, authReady: true });
      return;
    }
    set({
      profile: mapUser(row, (membres ?? []).map((m) => m.comite_id)),
      authLoading: false,
      authReady: true,
    });
  },
});
