import type { StateCreator } from "zustand";
import { supabase } from "@/lib/supabase";
import { mapReunion, mapPointOJ } from "@/lib/mappers";
import type { BoardStore, ReunionsSlice } from "../types";
import type { Reunion } from "@/types/domain";

// Le journal d'audit doit nommer l'ACTE de gouvernance, pas l'appel technique.
// `updateReunion` sert surtout à ouvrir et clôturer une séance : consigner
// « Modification réunion » sur un UUID ne disait rien de ce qui s'était passé.
const LIBELLE_STATUT: Record<string, string> = {
  en_cours: "Ouverture de séance",
  terminee: "Clôture de séance",
  planifiee: "Réouverture de la planification",
};

const CHAMPS: Record<string, string> = {
  titre: "intitulé",
  date: "date",
  heure: "horaire",
  dureeMin: "durée",
  lieu: "lieu",
  quorumRequis: "quorum",
};

function traceModification(
  patch: Partial<Reunion>,
  reunion?: Reunion,
): [action: string, ressource: string] {
  const nom = reunion?.titre ?? "Réunion";

  // Un changement de statut est l'acte marquant : il prime sur le reste.
  if (patch.statut && patch.statut !== reunion?.statut) {
    return [LIBELLE_STATUT[patch.statut] ?? `Changement de statut → ${patch.statut}`, nom];
  }

  // Sinon on nomme les champs réellement touchés (`undefined` = non modifié).
  const modifies = Object.keys(CHAMPS)
    .filter((c) => patch[c as keyof Reunion] !== undefined)
    .map((c) => CHAMPS[c]);

  return modifies.length > 0
    ? [`Modification de séance (${modifies.join(", ")})`, nom]
    : ["Modification de séance", nom];
}

export const createReunionsSlice: StateCreator<BoardStore, [], [], ReunionsSlice> = (set, get) => ({
  reunions: [],
  reunionActiveId: null,
  reunionsLoading: false,

  setReunionActive: (id) => set({ reunionActiveId: id }),

  fetchReunions: async () => {
    set({ reunionsLoading: true });
    const [{ data: rows }, { data: ojRows }] = await Promise.all([
      supabase.from("reunions").select("*").order("date_reunion", { ascending: false }),
      supabase.from("ordre_du_jour").select("*"),
    ]);
    const ojByReunion = new Map<string, typeof ojRows>();
    for (const oj of ojRows ?? []) {
      ojByReunion.set(oj.reunion_id, [...(ojByReunion.get(oj.reunion_id) ?? []), oj]);
    }
    const reunions = (rows ?? []).map((r) =>
      mapReunion(r, (ojByReunion.get(r.id) ?? []).map(mapPointOJ)),
    );
    set((s) => ({
      reunions,
      reunionActiveId: s.reunionActiveId ?? reunions[0]?.id ?? null,
      reunionsLoading: false,
    }));
  },

  addReunion: async (r) => {
    const { data, error } = await supabase
      .from("reunions")
      .insert({
        type: r.type,
        titre: r.titre,
        date_reunion: r.date,
        heure: r.heure,
        duree_min: r.dureeMin,
        lieu: r.lieu,
        // Chaîne vide = pas de visio : la contrainte SQL n'accepte qu'une URL ou NULL.
        lien_visio: r.lienVisio?.trim() || null,
        quorum_requis: r.quorumRequis ?? 7,
        comite_id: r.comiteId,
        created_by: get().profile?.id,
      })
      .select("id")
      .single();
    if (error || !data) throw error;
    await get().logEvent("Création réunion", r.titre);
    await get().fetchReunions();
    get().setReunionActive(data.id);
    return data.id;
  },

  updateReunion: async (id, patch) => {
    const { error } = await supabase
      .from("reunions")
      .update({
        titre: patch.titre,
        date_reunion: patch.date,
        heure: patch.heure,
        duree_min: patch.dureeMin,
        lieu: patch.lieu,
        lien_visio: patch.lienVisio === undefined ? undefined : patch.lienVisio.trim() || null,
        statut: patch.statut,
        quorum_requis: patch.quorumRequis,
      })
      .eq("id", id);
    if (error) throw error;
    // Lu AVANT `fetchReunions()` : le store porte encore l'état d'avant, sans quoi
    // la comparaison de statut serait toujours fausse et l'acte jamais nommé.
    const [action, ressource] = traceModification(
      patch,
      get().reunions.find((r) => r.id === id),
    );
    await get().logEvent(action, ressource);
    await get().fetchReunions();
  },

  removeReunion: async (id) => {
    const reunion = get().reunions.find((r) => r.id === id);
    const { error } = await supabase.from("reunions").delete().eq("id", id);
    if (error) throw error;
    await get().logEvent("Suppression réunion", reunion?.titre ?? id);
    if (get().reunionActiveId === id) set({ reunionActiveId: null });
    await get().fetchReunions();
  },

  reorderOJ: async (reunionId, orderedPointIds) => {
    await Promise.all(
      orderedPointIds.map((pointId, i) =>
        supabase
          .from("ordre_du_jour")
          .update({ position: i + 1 })
          .eq("id", pointId)
          .eq("reunion_id", reunionId),
      ),
    );
    await get().fetchReunions();
  },

  addPointOJ: async (reunionId, p) => {
    const reunion = get().reunions.find((r) => r.id === reunionId);
    const nextPosition = (reunion?.ordreDuJour.length ?? 0) + 1;
    const { error } = await supabase.from("ordre_du_jour").insert({
      reunion_id: reunionId,
      position: nextPosition,
      titre: p.titre,
      duree_min: p.dureeMin,
      obligatoire: p.obligatoire,
    });
    if (error) throw error;
    await get().fetchReunions();
  },

  // Insertion en lot de l'ordre du jour : un seul aller-retour + un seul refetch
  // (vs addPointOJ qui refetch après chaque point — trop lent à la création).
  addPointsOJ: async (reunionId, points) => {
    if (points.length === 0) return;
    const rows = points.map((p, i) => ({
      reunion_id: reunionId,
      position: i + 1,
      titre: p.titre,
      duree_min: p.dureeMin,
      obligatoire: p.obligatoire,
    }));
    const { error } = await supabase.from("ordre_du_jour").insert(rows);
    if (error) throw error;
    await get().fetchReunions();
  },

  removePointOJ: async (reunionId, pointId) => {
    const { error } = await supabase.from("ordre_du_jour").delete().eq("id", pointId);
    if (error) throw error;
    await get().fetchReunions();
    await get().fetchDocuments(reunionId); // point_oj_id des docs associés repasse à null
  },

  delegatePresidentSeance: async (reunionId, delegateId) => {
    const { error } = await supabase.rpc("delegate_president_seance", {
      p_reunion_id: reunionId,
      p_delegate_id: delegateId,
    });
    if (error) throw error; // message FR déjà utilisateur-final (raise exception côté RPC)
    await get().logEvent("Délégation de présidence de séance", `${reunionId} → ${delegateId}`);
    await get().fetchReunions();
    await get().fetchConvocations(reunionId);
  },

  reporterSeance: async (reunionId, r) => {
    const reunion = get().reunions.find((x) => x.id === reunionId);
    const { error } = await supabase.rpc("reporter_seance", {
      p_reunion_id: reunionId,
      p_nouvelle_date: r.date,
      p_nouvelle_heure: r.heure || undefined,
      p_nouveau_lieu: r.lieu || undefined,
      p_motif: r.motif || undefined,
    });
    if (error) throw error; // message FR déjà utilisateur-final (raise exception côté RPC)
    await get().logEvent(
      "Report de séance (quorum non atteint)",
      `${reunion?.titre ?? reunionId} → ${r.date}`,
    );
    // La RPC touche la réunion, l'émargement, les procurations et les convocations :
    // on resynchronise les quatre, sinon le panneau afficherait encore le quorum levé.
    await Promise.all([
      get().fetchReunions(),
      get().fetchPresences(reunionId),
      get().fetchProcurations(reunionId),
      get().fetchConvocations(reunionId),
    ]);
  },
});
