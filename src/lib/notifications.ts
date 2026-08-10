// Notifications réelles — produites côté Postgres par des triggers sur les
// événements métier (convocation, scrutin, PV, action, document, board book,
// discussion). Aucune donnée de démo : rien n'apparaît tant qu'aucune action
// n'a été effectuée dans l'application.
import { supabase } from "@/lib/supabase";

export type NotificationType =
  | "convocation"
  | "vote"
  | "pv"
  | "action"
  | "document"
  | "discussion"
  | "board_book"
  | "jeton"
  | "delegation"
  | "consultation";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  titre: string;
  message?: string;
  ressourceType?: string;
  ressourceId?: string;
  lu: boolean;
  createdAt: string;
}

type Row = {
  id: string;
  user_id: string;
  type: string;
  titre: string;
  message: string | null;
  ressource_type: string | null;
  ressource_id: string | null;
  lu: boolean;
  created_at: string;
};

export function mapNotification(row: Row): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as NotificationType,
    titre: row.titre,
    message: row.message ?? undefined,
    ressourceType: row.ressource_type ?? undefined,
    ressourceId: row.ressource_id ?? undefined,
    lu: row.lu,
    createdAt: row.created_at,
  };
}

// La RLS limite déjà la lecture aux notifications de l'utilisateur courant.
export async function fetchNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => mapNotification(r as unknown as Row));
}

// p_ids omis => marque tout comme lu (RPC, garde `user_id = auth.uid()` interne).
export async function markNotificationsRead(ids?: string[]) {
  const { error } = await supabase.rpc("mark_notifications_read", {
    p_ids: ids && ids.length > 0 ? ids : undefined,
  });
  if (error) throw error;
}

// Realtime : Supabase applique la RLS, on ne reçoit que ses propres lignes.
// Le tenant Realtime du projet (free tier) se coupe puis se réinitialise après
// une période d'inactivité : un événement survenu pendant ce trou n'est jamais
// rediffusé. On resynchronise donc aussi à chaque (re)connexion du canal, pas
// seulement sur les événements poussés.
export function subscribeNotifications(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onChange();
    });
  return () => {
    supabase.removeChannel(channel);
  };
}
