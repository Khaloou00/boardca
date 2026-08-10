// NotifsScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { TopBar } from "../shared/ui-components";
import { relativeTimeShort } from "../shared/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { type Notification as NotificationItem } from "@/lib/notifications";
import { type PV } from "@/types/domain";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
import { metaDe } from "../shared/constants";
export function NotifsScreen({ nav }: { nav: (v: View) => void }) {
  const {
    consultations,
    profile,
    realVotes,
  } = useMobileSession();

  // Abonnement propre à cet écran (pas via une closure sur l'app mobile
  // entière) : seul NotifsScreen se re-rend au fil des notifications, voir
  // l'avertissement dans `useNotifications.tsx`.
  const { items, unread, loading, markRead } = useNotifications();

  const open = (n: NotificationItem) => {
    if (!n.lu) markRead([n.id]);
    switch (n.type) {
      case "pv":
        nav({ tab: "home", sub: "pv" });
        break;
      case "vote": {
        // Un scrutin clos n'apparaît plus dans la liste des scrutins ouverts
        // (« Aucun scrutin ouvert ») : la notification de clôture doit mener
        // directement au résultat de CE scrutin, pas à une liste vide.
        const vote = n.ressourceId ? realVotes.find((v) => v.id === n.ressourceId) : undefined;
        if (vote?.statut === "clos") {
          nav({ tab: "vote", sub: "result", data: { id: vote.id } });
        } else {
          nav({ tab: "vote" });
        }
        break;
      }
      case "convocation":
        nav({ tab: "home", sub: "convocation" });
        break;
      case "document":
      case "board_book":
        nav({ tab: "boardbook" });
        break;
      case "discussion":
        nav({ tab: "discussions" });
        break;
      case "jeton":
        nav({ tab: "profile", sub: "jetons" });
        break;
      case "delegation":
        nav({ tab: "home", sub: "convocation" });
        break;
      case "consultation":
        nav({ tab: "profile", sub: "consultations" });
        break;
      default:
        break;
    }
  };

  return (
    <div>
      <TopBar
        title="Notifications"
        right={
          unread > 0 ? (
            <button
              onClick={() => markRead()}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold active:scale-95 active:bg-gold/20 transition"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Tout lire
            </button>
          ) : undefined
        }
      />
      {loading ? (
        <div className="px-5 py-16 flex justify-center">
          <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="px-8 py-20 flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Bell className="h-6 w-6 text-slate-400" />
          </div>
          <div className="text-sm font-semibold text-navy">Aucune notification</div>
          <div className="text-xs text-slate-500 max-w-[250px]">
            Convocations, scrutins, PV à signer et actions assignées apparaîtront ici.
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-2">
          {items.map((n) => {
            const meta = metaDe(n.type);
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`w-full text-left rounded-xl p-3 border flex gap-3 active:scale-[0.98] transition ${
                  n.lu ? "bg-white border-slate-100" : "bg-gold/5 border-gold/30"
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}
                >
                  <meta.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-navy flex items-center gap-1.5">
                    {n.titre}
                    {!n.lu && <span className="h-1.5 w-1.5 rounded-full bg-gold shrink-0" />}
                  </div>
                  {n.message && (
                    <div className="text-xs text-slate-500 truncate">{n.message}</div>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 shrink-0">
                  {relativeTimeShort(n.createdAt)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
