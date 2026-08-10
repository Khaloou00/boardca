import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import {
  fetchNotifications,
  markNotificationsRead,
  subscribeNotifications,
  type Notification,
} from "@/lib/notifications";

type NotificationsState = {
  items: Notification[];
  unread: number;
  loading: boolean;
  markRead: (ids?: string[]) => Promise<void>;
  reload: () => Promise<void>;
};

// Le poll/Realtime tourne ICI, dans un provider isolé, et nulle part au sommet
// de `MobileAdminApp`. Tous les écrans mobiles sont des fonctions imbriquées
// DANS `MobileAdminApp` : si celle-ci elle-même consommait ce hook, chaque tick
// (poll 20s ou push Realtime) redéfinirait TOUTES ces fonctions imbriquées —
// React les traite alors comme de nouveaux types de composant et démonte/remonte
// l'écran affiché, effaçant au passage tout champ en cours de saisie (bug vécu :
// procuration "invité", nom en train d'être tapé, réinitialisé en plein milieu).
// En confinant l'état ici, seuls les composants qui appellent `useNotifications()`
// (le badge, l'écran Alertes) se re-rendent — jamais `MobileAdminApp`.
function useNotificationsState(): NotificationsState {
  const userId = useBoardStore((s) => s.profile?.id);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      setItems(await fetchNotifications());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!userId) return;
    return subscribeNotifications(userId, reload);
  }, [userId, reload]);

  // Filet de sécurité : le tenant Realtime (free tier) peut couper le flux sans
  // le signaler (voir subscribeNotifications) — un poll périodique borne le
  // retard maximal à 20s même si le WebSocket est resté silencieux.
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(reload, 20_000);
    return () => clearInterval(id);
  }, [userId, reload]);

  const unread = items.filter((n) => !n.lu).length;

  const markRead = useCallback(
    async (ids?: string[]) => {
      // Optimiste : la RLS/Realtime réconcilie derrière.
      setItems((prev) =>
        prev.map((n) => (!ids || ids.includes(n.id) ? { ...n, lu: true } : n)),
      );
      try {
        await markNotificationsRead(ids);
      } catch {
        reload();
      }
    },
    [reload],
  );

  return { items, unread, loading, markRead, reload };
}

const NotificationsContext = createContext<NotificationsState | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const value = useNotificationsState();
  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

// Consommateur : n'appeler que depuis un composant qui peut se re-rendre seul
// sans conséquence (badge, écran Alertes) — jamais depuis `MobileAdminApp`
// elle-même, voir l'avertissement au-dessus de `useNotificationsState`.
export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications doit être utilisé sous <NotificationsProvider>");
  return ctx;
}
