import type { StateCreator } from "zustand";
import { supabase } from "@/lib/supabase";
import { mapVote, mapResolution } from "@/lib/mappers";
import type { BoardStore, VotesSlice } from "../types";

export const createVotesSlice: StateCreator<BoardStore, [], [], VotesSlice> = (set, get) => ({
  votes: [],
  resolutions: [],
  votesLoading: false,

  fetchVotes: async (reunionId) => {
    set({ votesLoading: true });
    const { data } = await supabase
      .from("votes")
      .select("*, bulletins(*)")
      .eq("reunion_id", reunionId)
      .order("ouvert_at", { ascending: true });
    set((s) => ({
      votes: [...s.votes.filter((v) => v.reunionId !== reunionId), ...(data ?? []).map(mapVote)],
      votesLoading: false,
    }));
  },

  fetchResolutions: async (reunionId) => {
    const { data } = await supabase.from("resolutions").select("*").eq("reunion_id", reunionId);
    set((s) => ({
      resolutions: [...s.resolutions.filter((r) => r.reunionId !== reunionId), ...(data ?? []).map(mapResolution)],
    }));
  },

  openVote: async (reunionId, intitule, resolutionCode) => {
    const { data, error } = await supabase
      .from("votes")
      .insert({ reunion_id: reunionId, intitule, resolution_code: resolutionCode })
      .select("id")
      .single();
    if (error || !data) throw error;
    await get().logEvent("Ouverture vote", intitule);
    await get().fetchVotes(reunionId);
    return data.id;
  },

  castBulletin: async (voteId, userId, choix) => {
    const { error } = await supabase.from("bulletins").insert({ vote_id: voteId, user_id: userId, choix });
    if (error) throw error;
    await get().logEvent("Vote électronique", `${voteId} → ${choix.toUpperCase()}`);
    const vote = get().votes.find((v) => v.id === voteId);
    if (vote) await get().fetchVotes(vote.reunionId);
  },

  closeVote: async (voteId) => {
    const vote = get().votes.find((v) => v.id === voteId);
    const { error } = await supabase
      .from("votes")
      .update({ statut: "clos", clos_at: new Date().toISOString() })
      .eq("id", voteId);
    if (error) throw error;
    await get().logEvent("Clôture vote", voteId);
    // Le résultat (adopté/rejeté) se calcule côté client depuis les bulletins
    // réels via `voteTally` (voir `src/store/selectors.ts`) — pas besoin de
    // relire `resolutions`, une table que rien dans l'application n'alimente.
    if (vote) await get().fetchVotes(vote.reunionId);
  },
});
