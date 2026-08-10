// NotifBadge — extrait de `admin-app.tsx`.
import { useNotifications } from "@/hooks/useNotifications";

export function NotifBadge() {
  const { unread } = useNotifications();
  if (unread <= 0) return null;
  return (
    <span
      aria-label={`${unread} notification(s) non lue(s)`}
      className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
    >
      {unread > 9 ? "9+" : unread}
    </span>
  );
}
