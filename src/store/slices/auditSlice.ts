import type { StateCreator } from "zustand";
import { supabase } from "@/lib/supabase";
import { mapAuditEntry } from "@/lib/mappers";
import type { BoardStore, AuditSlice } from "../types";

export const createAuditSlice: StateCreator<BoardStore, [], [], AuditSlice> = (set, get) => ({
  auditLog: [],
  auditLoading: false,

  fetchAuditLog: async () => {
    set({ auditLoading: true });
    // RLS : réservé au super_admin, renvoie [] silencieusement pour les autres rôles.
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    set({ auditLog: (data ?? []).map(mapAuditEntry), auditLoading: false });
  },

  logEvent: async (action, ressource) => {
    await supabase.rpc("log_event", { p_action: action, p_ressource: ressource });
    if (get().auditLog.length > 0) await get().fetchAuditLog();
  },
});
