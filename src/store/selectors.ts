// Valeurs dérivées calculées à la volée à partir du store. Rien n'est dupliqué :
// Postgres reste la source, ces sélecteurs ne font que recalculer une vue.
import { useBoardStore } from "./useBoardStore";
import type { Reunion, Vote, Procuration } from "@/types/domain";

// ─── QUORUM ───────────────────────────────────────────────────
export function useQuorum(reunionId: string) {
  return useBoardStore((s) => {
    const reunion = s.reunions.find((r) => r.id === reunionId);
    if (!reunion) return { presents: 0, requis: 0, atteint: false };
    const presents = s.presences.filter((p) => p.reunionId === reunionId).length;
    return { presents, requis: reunion.quorumRequis, atteint: presents >= reunion.quorumRequis };
  });
}

// ─── RÉSULTAT VOTE EN DIRECT ──────────────────────────────────
// Un membre du CA mandataire d'un ou plusieurs autres (procuration active,
// PAS un compte 'invite' — celui-là vote déjà sous l'identité du mandant, cf.
// `mandantPour` dans admin-app.tsx) voit son bulletin compter double, triple…
// Miroir du calcul serveur `private.recalc_resolution()` (scellé à la clôture) :
// diverger reviendrait à afficher un résultat différent de celui officiel.
export function voteTally(vote: Vote, procurations: Procuration[]) {
  const poids = (userId: string) =>
    1 +
    procurations.filter(
      (p) => p.statut === "active" && p.reunionId === vote.reunionId && p.versUserId === userId,
    ).length;

  let oui = 0;
  let non = 0;
  let abs = 0;
  for (const b of vote.bulletins) {
    const w = poids(b.userId);
    if (b.choix === "oui") oui += w;
    else if (b.choix === "non") non += w;
    else abs += w;
  }
  const total = oui + non + abs;
  return {
    oui,
    non,
    abs,
    total,
    pourcentages: total
      ? { oui: (oui / total) * 100, non: (non / total) * 100, abs: (abs / total) * 100 }
      : { oui: 0, non: 0, abs: 0 },
    verdict: oui > non ? "adoptee" : total > 0 ? "rejetee" : "en_attente",
  } as const;
}

// ─── COUVERTURE DOCUMENTAIRE D'UNE RÉUNION (Board Book) ────────
export function useDocCoverage(reunionId: string) {
  return useBoardStore((s) => {
    const reunion = s.reunions.find((r) => r.id === reunionId);
    if (!reunion)
      return {
        total: 0,
        couverts: 0,
        complet: false,
        points: [] as { point: Reunion["ordreDuJour"][number]; hasDoc: boolean }[],
      };
    const docs = s.documents.filter((d) => d.reunionId === reunionId && d.pointOjId);
    const points = reunion.ordreDuJour.map((point) => ({
      point,
      hasDoc: docs.some((d) => d.pointOjId === point.id),
    }));
    const obligatoires = points.filter((p) => p.point.obligatoire);
    const couverts = obligatoires.filter((p) => p.hasDoc).length;
    return {
      total: obligatoires.length,
      couverts,
      complet: obligatoires.length > 0 && obligatoires.every((p) => p.hasDoc),
      points,
    };
  });
}

// ─── TAUX D'EXÉCUTION DES ACTIONS ─────────────────────────────
export function useActionStats() {
  return useBoardStore((s) => {
    const total = s.actions.length;
    const terminees = s.actions.filter((a) => a.statut === "terminee").length;
    const enCours = s.actions.filter((a) => a.statut === "en_cours").length;
    const enRetard = s.actions.filter((a) => a.statut === "en_retard").length;
    const avancementMoyen = total
      ? Math.round(s.actions.reduce((acc, a) => acc + a.avancement, 0) / total)
      : 0;
    return {
      total,
      terminees,
      enCours,
      enRetard,
      avancementMoyen,
      tauxExecution: total ? Math.round((terminees / total) * 100) : 0,
    };
  });
}

// ─── RÉUNION ACTIVE (sélecteur partagé) ───────────────────────
export function useReunionActive() {
  return useBoardStore((s) => s.reunions.find((r) => r.id === s.reunionActiveId) ?? null);
}

// ─── UTILISATEUR COURANT (profil, rôle inclus) ────────────────
export function useCurrentUser() {
  return useBoardStore((s) => s.profile);
}

// ─── SIGNATURES D'UN PV (progression) ─────────────────────────
export function usePvProgress(reunionId: string) {
  return useBoardStore((s) => {
    const pv = s.pvs.find((p) => p.reunionId === reunionId);
    if (!pv) return { signes: 0, requis: 0, complet: false, pv: null };
    const presents = s.presences.filter(
      (p) => p.reunionId === reunionId && (p.mode === "presentiel" || p.mode === "distance"),
    ).length;
    return {
      signes: pv.signatures.filter((sig) => sig.pvVersion === pv.version).length,
      requis: presents,
      complet: pv.statut === "signe",
      pv,
    };
  });
}
