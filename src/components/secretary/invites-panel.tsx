import { useEffect, useMemo, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabase";
import { UserCheck, CalendarClock, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { KpiTiles } from "@/components/super-admin/kpi-tiles";

// Un membre du CA désigne désormais son mandataire DIRECTEMENT (edge function
// `invite-guest`, plus de validation par la Secrétaire — incohérent avec la
// hiérarchie : un membre du CA n'a pas à demander la permission de la
// Secrétaire pour choisir qui le représente). Cet écran devient donc un pur
// panneau d'observation : qui représente qui, pour quelle séance, et si le
// mandataire a effectivement scanné sa présence.
type ProcurationActive = {
  id: string;
  reunionId: string;
  deUserId: string;
  versUserId: string;
  createdAt: string;
};

export function InvitesPanel() {
  const { users, reunions } = useBoardStore(
    useShallow((s) => ({ users: s.users, reunions: s.reunions })),
  );
  const [procs, setProcs] = useState<ProcurationActive[]>([]);
  // clé `${reunionId}:${deUserId}` -> mode de présence du membre représenté
  const [presence, setPresence] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const charger = async () => {
      const { data: procData } = await supabase
        .from("procurations")
        .select("id, reunion_id, de_user_id, vers_user_id, created_at")
        .eq("statut", "active")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows: ProcurationActive[] = (procData ?? []).map((r) => ({
        id: r.id,
        reunionId: r.reunion_id,
        deUserId: r.de_user_id,
        versUserId: r.vers_user_id,
        createdAt: r.created_at,
      }));
      setProcs(rows);

      const reunionIds = [...new Set(rows.map((r) => r.reunionId))];
      if (reunionIds.length > 0) {
        const { data: presData } = await supabase
          .from("presences")
          .select("reunion_id, user_id, mode")
          .in("reunion_id", reunionIds);
        if (!cancelled) {
          setPresence(
            Object.fromEntries(
              (presData ?? []).map((p) => [`${p.reunion_id}:${p.user_id}`, p.mode]),
            ),
          );
        }
      } else if (!cancelled) {
        setPresence({});
      }
      if (!cancelled) setLoading(false);
    };
    charger();
    // Un nouveau mandataire (désignation mobile) ou un scan doit apparaître
    // sans recharger la page.
    const canal = supabase
      .channel("boardca:invites-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "procurations" }, charger)
      .on("postgres_changes", { event: "*", schema: "public", table: "presences" }, charger)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") charger();
      });
    return () => {
      cancelled = true;
      supabase.removeChannel(canal);
    };
  }, []);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const reunionsById = useMemo(() => Object.fromEntries(reunions.map((r) => [r.id, r])), [reunions]);

  const enCours = useMemo(
    () => procs.filter((p) => reunionsById[p.reunionId]?.statut !== "terminee"),
    [procs, reunionsById],
  );
  const terminees = useMemo(
    () => procs.filter((p) => reunionsById[p.reunionId]?.statut === "terminee"),
    [procs, reunionsById],
  );
  const presentsScannes = procs.filter(
    (p) => presence[`${p.reunionId}:${p.deUserId}`] === "procuration",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-gold">Procuration externe</div>
        <h1 className="mt-1 text-2xl font-bold text-navy">Invités</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Les membres du CA désignent eux-mêmes leur mandataire (aucune validation requise ici) :
          cette page recense qui représente qui, pour quelle séance, et si le mandataire a
          effectivement signalé sa présence.
        </p>
      </div>

      <KpiTiles
        tuiles={[
          { label: "Mandats actifs", valeur: procs.length, hint: "toutes séances", ton: "navy" },
          { label: "Séances en cours", valeur: enCours.length, hint: "à venir/en cours", ton: "gold" },
          {
            label: "Présences confirmées",
            valeur: presentsScannes,
            hint: "mandataire ayant scanné",
            ton: "emerald",
          },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : procs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <UserCheck className="h-6 w-6 text-slate-400" />
          </div>
          <div className="mt-4 text-sm font-semibold text-navy">Aucun mandataire désigné</div>
        </div>
      ) : (
        <div className="space-y-4">
          {[...enCours, ...terminees].map((p) => {
            const invite = usersById[p.versUserId];
            const mandant = usersById[p.deUserId];
            const reunion = reunionsById[p.reunionId];
            const modePresence = presence[`${p.reunionId}:${p.deUserId}`];
            const aScanne = modePresence === "procuration";
            const terminee = reunion?.statut === "terminee";
            return (
              <article
                key={p.id}
                className={`overflow-hidden rounded-2xl border bg-card shadow-sm p-6 ${
                  aScanne
                    ? "border-l-4 border-l-emerald-500 border-border"
                    : terminee
                      ? "border-l-4 border-l-slate-300 border-border"
                      : "border-l-4 border-l-gold border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[240px] flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px]">
                      {aScanne ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Présence confirmée
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200">
                          <Clock className="h-3 w-3" /> Pas encore scanné
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold leading-snug text-navy">
                      {mandant?.nom ?? "Membre inconnu"}
                    </h2>
                    <div className="mt-2 text-xs text-muted-foreground">
                      pour « {reunion?.titre ?? "réunion inconnue"} »
                      {terminee && " · terminée"}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Représenté par{" "}
                      <span className="font-medium text-navy">{invite?.nom ?? "Invité inconnu"}</span>
                      {invite?.email ? ` (${invite.email})` : ""}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
