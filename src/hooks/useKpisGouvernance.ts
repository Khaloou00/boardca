import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { KpisGouvernanceResponse } from "@/types/jetons";

// KPIs gouvernance agrégés pour une année. La RPC lève « Accès refusé » pour un
// administrateur/responsable_action : la vraie barrière est côté serveur.
export function useKpisGouvernance(annee: number) {
  const [data, setData] = useState<KpisGouvernanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .rpc("get_kpis_gouvernance", { p_annee: annee })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setData(data as unknown as KpisGouvernanceResponse);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [annee]);

  return { data, loading, error };
}
