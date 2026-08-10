import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useBoardStore, fetchCoreData, fetchReunionScopedData } from "@/store/useBoardStore";

// À appeler une fois au montage racine (RootComponent) :
// - hydrate le profil (session Supabase existante) et les données "cœur"
// - se ré-hydrate à chaque login/logout (onAuthStateChange)
// - ouvre les canaux Realtime : partage entre TOUS les clients/appareils connectés,
//   pas seulement entre onglets (contrairement à un mécanisme localStorage).
export function useBootstrap() {
  useEffect(() => {
    async function bootAuthed() {
      await useBoardStore.getState().loadProfile();
      if (useBoardStore.getState().profile) {
        await fetchCoreData();
      }
    }
    bootAuthed();

    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      bootAuthed();
    });

    // Tables "cœur", indépendantes de la réunion active.
    const coreChannel = supabase
      .channel("boardca:core")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () =>
        useBoardStore.getState().fetchUsers(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "comites" }, () =>
        useBoardStore.getState().fetchComites(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "comite_membres" }, () => {
        useBoardStore.getState().fetchUsers();
        useBoardStore.getState().fetchComites();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reunions" }, () =>
        useBoardStore.getState().fetchReunions(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "ordre_du_jour" }, () =>
        useBoardStore.getState().fetchReunions(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "actions" }, () =>
        useBoardStore.getState().fetchActions(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "action_commentaires" }, () =>
        useBoardStore.getState().fetchActions(),
      )
      // bulletins/signatures n'ont pas de colonne reunion_id : on ne peut pas les filtrer
      // côté Realtime, donc on se contente de rafraîchir la réunion actuellement active.
      .on("postgres_changes", { event: "*", schema: "public", table: "bulletins" }, () => {
        const id = useBoardStore.getState().reunionActiveId;
        if (id) useBoardStore.getState().fetchVotes(id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "signatures" }, () => {
        const id = useBoardStore.getState().reunionActiveId;
        if (id) useBoardStore.getState().fetchPV(id);
      })
      // Resynchro à chaque (re)connexion : le tenant Realtime (free tier) se coupe
      // après inactivité et ne rejoue pas les événements manqués pendant la
      // coupure (voir src/lib/notifications.ts) — on recharge donc tout le cœur.
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        const store = useBoardStore.getState();
        store.fetchUsers();
        store.fetchComites();
        store.fetchReunions();
        store.fetchActions();
        const id = store.reunionActiveId;
        if (id) {
          store.fetchVotes(id);
          store.fetchPV(id);
        }
      });

    // Canal scopé à la réunion active — recréé à chaque changement de sélection.
    let reunionChannelCleanup: (() => void) | undefined;
    const subscribeReunion = (reunionId: string) => {
      reunionChannelCleanup?.();
      const channel = supabase
        .channel(`boardca:reunion:${reunionId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "documents", filter: `reunion_id=eq.${reunionId}` },
          () => useBoardStore.getState().fetchDocuments(reunionId),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "board_books", filter: `reunion_id=eq.${reunionId}` },
          () => useBoardStore.getState().fetchBoardBook(reunionId),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "presences", filter: `reunion_id=eq.${reunionId}` },
          () => useBoardStore.getState().fetchPresences(reunionId),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "procurations", filter: `reunion_id=eq.${reunionId}` },
          () => useBoardStore.getState().fetchProcurations(reunionId),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "convocations", filter: `reunion_id=eq.${reunionId}` },
          () => useBoardStore.getState().fetchConvocations(reunionId),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "votes", filter: `reunion_id=eq.${reunionId}` },
          () => useBoardStore.getState().fetchVotes(reunionId),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "resolutions", filter: `reunion_id=eq.${reunionId}` },
          () => useBoardStore.getState().fetchResolutions(reunionId),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pv", filter: `reunion_id=eq.${reunionId}` },
          () => useBoardStore.getState().fetchPV(reunionId),
        )
        // Resynchro à chaque (re)connexion : voir le canal cœur ci-dessus.
        .subscribe((status) => {
          if (status === "SUBSCRIBED") fetchReunionScopedData(reunionId);
        });
      reunionChannelCleanup = () => supabase.removeChannel(channel);
    };

    const initialReunionId = useBoardStore.getState().reunionActiveId;
    if (initialReunionId) {
      subscribeReunion(initialReunionId);
      fetchReunionScopedData(initialReunionId);
    }

    const unsubscribeStore = useBoardStore.subscribe((state, prev) => {
      if (state.reunionActiveId && state.reunionActiveId !== prev.reunionActiveId) {
        subscribeReunion(state.reunionActiveId);
        fetchReunionScopedData(state.reunionActiveId);
      }
    });

    return () => {
      authSub.subscription.unsubscribe();
      supabase.removeChannel(coreChannel);
      reunionChannelCleanup?.();
      unsubscribeStore();
    };
  }, []);
}
