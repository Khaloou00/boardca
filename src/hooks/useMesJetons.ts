import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { MesJetonsResponse } from "@/types/jetons";

// Jetons de présence de l'utilisateur courant (p_user_id null → auth.uid()).
// La RPC logge déjà l'accès en audit ; ne pas re-logger côté client.
export function useMesJetons() {
  const [data, setData] = useState<MesJetonsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("get_mes_jetons", { p_user_id: undefined })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setData(data as unknown as MesJetonsResponse);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
