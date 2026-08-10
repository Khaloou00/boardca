import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabase";
import { useBoardStore } from "@/store/useBoardStore";
import {
  ShieldCheck,
  Loader2,
  Crown,
  CheckCircle2,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  PenLine,
} from "lucide-react";

/**
 * Suivi des signatures d'un PV — widget flottant, et non plus fenêtre modale.
 *
 * Un PV envoyé en signature n'est pas signé dans la minute : les administrateurs
 * signent depuis leur mobile, parfois sur plusieurs jours. Bloquer l'écran de la
 * Secrétaire derrière une modale pendant ce temps n'avait aucun sens — elle doit
 * pouvoir continuer à travailler (convocations, actions, autre séance…) pendant que
 * les signatures arrivent.
 *
 * Le suivi est donc :
 *  — flottant, ancré en bas à droite, au-dessus de n'importe quel onglet ;
 *  — réductible en pastille, pour ne jamais gêner ;
 *  — PERSISTANT (localStorage) : il survit à un changement d'onglet et à un
 *    rechargement de page, tant que le PV n'est pas scellé ;
 *  — vivant : il écoute lui-même la table `signatures` pour SA réunion, sans
 *    dépendre de la réunion active du store (qui change quand on navigue).
 */
type EtatSuivi = {
  reunionId: string | null;
  reduit: boolean;
  suivre: (reunionId: string) => void;
  arreter: () => void;
  basculer: () => void;
};

export const useSuiviSignature = create<EtatSuivi>()(
  persist(
    (set) => ({
      reunionId: null,
      reduit: false,
      suivre: (reunionId) => set({ reunionId, reduit: false }),
      arreter: () => set({ reunionId: null }),
      basculer: () => set((s) => ({ reduit: !s.reduit })),
    }),
    { name: "boardca:suivi-signature" },
  ),
);

export function SignatureTracker() {
  const { reunionId, reduit, arreter, basculer } = useSuiviSignature();
  const { reunions, pvs, presences, users } = useBoardStore(
    useShallow((s) => ({
      reunions: s.reunions,
      pvs: s.pvs,
      presences: s.presences,
      users: s.users,
    })),
  );

  // Le suivi vit sa propre vie : il recharge SA réunion, même si la Secrétaire est
  // partie travailler sur une autre séance (le canal Realtime global ne rafraîchit
  // que la réunion active).
  useEffect(() => {
    if (!reunionId) return;
    const store = useBoardStore.getState();
    store.fetchPV(reunionId);
    store.fetchPresences(reunionId);

    const canal = supabase
      .channel(`boardca:suivi-signature:${reunionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "signatures" }, () =>
        useBoardStore.getState().fetchPV(reunionId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pv", filter: `reunion_id=eq.${reunionId}` },
        () => useBoardStore.getState().fetchPV(reunionId),
      )
      // Resynchro à chaque (re)connexion du canal : le tenant Realtime (free tier)
      // se coupe après inactivité et ne rejoue pas les événements manqués pendant
      // la coupure (voir src/lib/notifications.ts).
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          useBoardStore.getState().fetchPV(reunionId);
          useBoardStore.getState().fetchPresences(reunionId);
        }
      });
    return () => {
      supabase.removeChannel(canal);
    };
  }, [reunionId]);

  if (!reunionId) return null;

  const reunion = reunions.find((r) => r.id === reunionId);
  const pv = pvs.find((p) => p.reunionId === reunionId);
  if (!reunion || !pv) return null;

  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const presentIds = presences.filter((p) => p.reunionId === reunionId).map((p) => p.userId);
  // Un renvoi (RPC `renvoyer_pv`) incrémente `pv.version` : les signatures d'une
  // version antérieure restent en base mais ne comptent plus pour le suivi.
  const signes = new Set(
    pv.signatures.filter((s) => s.pvVersion === pv.version).map((s) => s.userId),
  );
  const total = presentIds.length;
  const signe = presentIds.filter((id) => signes.has(id)).length;
  const pct = total ? Math.round((signe / total) * 100) : 0;
  const scelle = pv.statut === "signe";
  const pca = users.find((u) => u.estPresidentCA);
  const manquants = presentIds.filter((id) => !signes.has(id)).map((id) => usersById[id]);
  // Le PCA scelle en dernier : tant que les autres n'ont pas signé, son tour n'est pas venu.
  const attendPca = !scelle && manquants.length === 1 && manquants[0]?.id === pca?.id;

  // Réduit : une simple pastille, qui continue de vivre.
  if (reduit) {
    return (
      <button
        onClick={basculer}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2.5 rounded-full border border-border bg-navy px-4 py-2.5 text-white shadow-2xl transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {scelle ? (
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-gold" />
        )}
        <span className="text-xs font-semibold">
          {scelle ? "PV scellé" : `Signatures ${signe}/${total}`}
        </span>
        <ChevronUp className="h-3.5 w-3.5 text-white/60" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 fade-in-0 duration-300">
      <div className="flex items-start gap-2 bg-navy px-4 py-3 text-white">
        <div className="mt-0.5">
          {scelle ? (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <PenLine className="h-4 w-4 text-gold" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
            {scelle ? "Procès-verbal scellé" : "Signatures en cours"}
          </div>
          <div className="truncate text-sm font-semibold">{reunion.titre}</div>
        </div>
        <button
          onClick={basculer}
          aria-label="Réduire le suivi"
          className="rounded p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          onClick={() => arreter()}
          aria-label="Fermer le suivi"
          className="rounded p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-navy">Signatures reçues</span>
          <span className="font-mono font-bold tabular-nums text-navy" aria-live="polite">
            {signe} / {total}
          </span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={signe}
        >
          <div
            className={`h-full transition-all duration-500 ${scelle ? "bg-emerald-500" : "bg-gold"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {scelle ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[15px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> PV scellé
              {pca ? ` par ${pca.nom}` : ""}
            </div>
            <div className="mt-0.5 text-[13px] text-emerald-700">
              Le procès-verbal est définitif et archivé. Vous pouvez l'exporter en PDF chiffré.
            </div>
            <button
              onClick={arreter}
              className="mt-2 w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              Très bien, fermer
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {manquants.length === 0 ? (
                <div className="text-[14px] text-muted-foreground">
                  Tous les présents ont signé — le sceau du Président est imminent.
                </div>
              ) : (
                manquants.map((u) => (
                  <div
                    key={u?.id}
                    className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[14px]"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-navy">{u?.nom ?? "—"}</span>
                    {u?.estPresidentCA && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold uppercase tracking-wide text-gold">
                        <Crown className="h-3 w-3" /> Sceau
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
              {attendPca
                ? "Tous les administrateurs présents ont signé. Le Président du Conseil doit maintenant apposer son sceau."
                : "Chaque membre signe depuis son mobile, à son rythme. Ce suivi reste actif pendant que vous travaillez ailleurs — vous pouvez le réduire."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
