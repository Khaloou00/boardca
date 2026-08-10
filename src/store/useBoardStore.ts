import { create } from "zustand";
import type { BoardStore } from "./types";

import { createAuthSlice } from "./slices/authSlice";
import { createUsersSlice } from "./slices/usersSlice";
import { createReunionsSlice } from "./slices/reunionsSlice";
import { createDocumentsSlice } from "./slices/documentsSlice";
import { createPresencesSlice } from "./slices/presencesSlice";
import { createVotesSlice } from "./slices/votesSlice";
import { createPvSlice } from "./slices/pvSlice";
import { createActionsSlice } from "./slices/actionsSlice";
import { createAuditSlice } from "./slices/auditSlice";

// Source unique de vérité du front. Aucune persistance locale (localStorage) :
// Postgres est la seule vérité, et Supabase Realtime (voir useBootstrap) pousse
// les mises à jour à tous les clients — multi-appareils, pas seulement multi-onglets.
export const useBoardStore = create<BoardStore>()((set, get, api) => ({
  ...createAuthSlice(set, get, api),
  ...createUsersSlice(set, get, api),
  ...createReunionsSlice(set, get, api),
  ...createDocumentsSlice(set, get, api),
  ...createPresencesSlice(set, get, api),
  ...createVotesSlice(set, get, api),
  ...createPvSlice(set, get, api),
  ...createActionsSlice(set, get, api),
  ...createAuditSlice(set, get, api),
}));

// ─── DONNÉES "CŒUR" (indépendantes de la réunion active) ──────
// À charger une fois après authentification (voir useBootstrap).
export async function fetchCoreData() {
  const s = useBoardStore.getState();
  await Promise.all([
    s.fetchUsers(),
    s.fetchComites(),
    s.fetchReunions(),
    s.fetchActions(),
  ]);
}

// ─── DONNÉES SCOPÉES À UNE RÉUNION ─────────────────────────────
// À appeler quand `reunionActiveId` change (le sélecteur de réunion est partagé
// globalement : changer la réunion sur une page la change partout).
export async function fetchReunionScopedData(reunionId: string) {
  const s = useBoardStore.getState();
  await Promise.all([
    s.fetchDocuments(reunionId),
    s.fetchBoardBook(reunionId),
    s.fetchPresences(reunionId),
    s.fetchProcurations(reunionId),
    s.fetchConvocations(reunionId),
    s.fetchVotes(reunionId),
    s.fetchResolutions(reunionId),
    s.fetchPV(reunionId),
  ]);
}
