import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ReunionStats } from "@/types/stats";

// Statistiques agrégées d'une réunion. Garde serveur : secrétaire/super_admin/PCA.
export function useReunionStats(reunionId: string | null) {
  const [data, setData] = useState<ReunionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reunionId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.rpc("get_reunion_stats", { p_reunion_id: reunionId }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error.message);
      else setData(data as unknown as ReunionStats);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reunionId]);

  return { data, loading, error };
}
