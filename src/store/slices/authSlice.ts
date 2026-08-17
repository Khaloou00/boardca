import type { StateCreator } from "zustand";
import { supabase } from "@/lib/supabase";
import { nettoyerPushALaDeconnexion } from "@/lib/push";
import { clearOfflineDocuments } from "@/lib/offline-storage";
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
    // Cet appareil ne doit plus recevoir les notifications du compte qui
    // s'en va : sinon le suivant qui l'utilise verrait passer ses
    // convocations et ses PV. Même raisonnement pour les documents
    // téléchargés pour le hors-ligne (IndexedDB, non chiffré, non scopé par
    // utilisateur) : sur un appareil partagé, le suivant à se connecter
    // pourrait sinon relire les Board Books du précédent.
    await nettoyerPushALaDeconnexion();
    await clearOfflineDocuments().catch(() => {});
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
    let {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Sur iOS, un PWA installée relancée après avoir été balayée (le
      // processus WKWebView est tué puis recréé, pas juste mis en pause)
      // peut lire un localStorage pas encore totalement rattaché au disque
      // au tout premier accès : la session existe réellement en local mais
      // ce premier getUser() la rate (bug WebKit connu, pas un problème
      // côté Supabase — https://bugs.webkit.org, "storage empty on cold
      // launch of installed web app"). Un seul nouvel essai après une
      // courte pause suffit ; coût négligeable pour une vraie déconnexion
      // (délai d'affichage d'environ 300ms).
      await new Promise((resolve) => setTimeout(resolve, 300));
      ({
        data: { user },
      } = await supabase.auth.getUser());
    }
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
