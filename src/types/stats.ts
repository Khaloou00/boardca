// Contrat de la RPC get_reunion_stats (migration 022) — statistiques d'une séance.

export interface ReunionStats {
  reunion: {
    id: string;
    titre: string;
    type: string;
    date: string;
    statut: string;
    quorumRequis: number;
  };
  participation: {
    presentiel: number;
    distance: number;
    procuration: number;
    absent: number;
    presents: number;
    invites: number;
    tauxPresencePct: number;
  };
  quorum: { requis: number; presents: number; atteint: boolean; margePct: number | null };
  jetons: {
    total: number;
    paye: number;
    enAttente: number;
    presentiel: number;
    distance: number;
    procuration: number;
  };
  signatures: { signe: number; attendu: number; pvStatut: string; tauxPct: number };
  convocations: {
    total: number;
    confirmees: number;
    excusees: number;
    envoyees: number;
    ouvertes: number;
  };
  ordreDuJour: { points: number; dureeTotaleMin: number };
  resolutions: { total: number; adoptees: number; rejetees: number; autres: number };
  procurations: number;
}
