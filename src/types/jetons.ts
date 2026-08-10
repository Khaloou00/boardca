// Types de la couche Jetons de présence — calés sur le contrat des RPC
// get_mes_jetons / get_kpis_gouvernance (migrations 017-019). Le calcul est fait
// côté Postgres ; le front ne fait que consommer ces formes.

export type ModeJeton = "presentiel" | "distance" | "procuration" | "absent";

export interface PointSerieJeton {
  reunionId: string;
  titre: string;
  type: string;
  date: string;
  mode: ModeJeton;
  montant: number;
  paye: boolean;
  cumule: number;
  seq: number;
}

export interface MesJetonsResponse {
  userId: string;
  serie: PointSerieJeton[];
  totaux: {
    nbSessions: number;
    totalDu: number;
    totalPaye: number;
    totalEnAttente: number;
    moyenneParSession: number;
    derniereSession: string | null;
  };
  variationDernierePct: number | null;
}

export interface KpisGouvernanceResponse {
  annee: number;
  totaux: { jetonsDistribuesTotal: number; sessionsTotal: number; adminsActifs: number };
  evolutionJetonsMensuelle: { mois: string; jetons_distribues: number; cumule: number }[];
  tauxPresenceMensuel: { mois: string; taux_presence_pct: number }[];
  leaderboard: {
    nom: string;
    total_jetons_percus: number;
    taux_presence_pct: number;
    procurations_donnees: number;
  }[];
  actions: {
    total: number;
    terminees: number;
    enCours: number;
    enRetard: number;
    tauxExecutionPct: number;
  };
  quorum: { reunionsTotal: number; quorumAtteintPct: number };
}
