import { supabase } from "@/lib/supabase";

// Historique des séances levées faute de quorum. L'écriture passe exclusivement par
// la RPC `reporter_seance` (voir le store) : ici, lecture seule.
export type ReportSeance = {
  id: string;
  reunionId: string;
  ancienneDate: string;
  ancienneHeure: string | null;
  nouvelleDate: string;
  nouvelleHeure: string | null;
  nouveauLieu: string | null;
  motif: string | null;
  presentsConstates: number;
  quorumRequis: number;
  reportePar: string | null;
  createdAt: string;
};

export async function fetchReportsSeance(reunionId: string): Promise<ReportSeance[]> {
  const { data, error } = await supabase
    .from("reports_seance")
    .select(
      "id, reunion_id, ancienne_date, ancienne_heure, nouvelle_date, nouvelle_heure, nouveau_lieu, motif, presents_constates, quorum_requis, reporte_par, created_at",
    )
    .eq("reunion_id", reunionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    reunionId: r.reunion_id,
    ancienneDate: r.ancienne_date,
    ancienneHeure: r.ancienne_heure,
    nouvelleDate: r.nouvelle_date,
    nouvelleHeure: r.nouvelle_heure,
    nouveauLieu: r.nouveau_lieu,
    motif: r.motif,
    presentsConstates: r.presents_constates,
    quorumRequis: r.quorum_requis,
    reportePar: r.reporte_par,
    createdAt: r.created_at,
  }));
}
