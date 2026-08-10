import { useMemo, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { Header, Empty } from "./documents-panel";
import { toast } from "sonner";
import {
  Vote as VoteIcon,
  Play,
  StopCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  Gavel,
  Download,
  FileText,
} from "lucide-react";
import type { Choix, Procuration, Vote } from "@/types/domain";
import { KpiTiles } from "@/components/super-admin/kpi-tiles";
import { exporterCsv, exporterPdf, type TableauExport } from "@/lib/archive-export";
import { voteTally } from "@/store/selectors";

const CHOIX_META: Record<Choix, { label: string; icon: any; color: string; bar: string }> = {
  oui: { label: "Pour", icon: CheckCircle2, color: "text-emerald-600", bar: "bg-emerald-500" },
  non: { label: "Contre", icon: XCircle, color: "text-red-600", bar: "bg-red-500" },
  abstention: {
    label: "Abstention",
    icon: MinusCircle,
    color: "text-slate-500",
    bar: "bg-slate-400",
  },
};

// Votes réels : `votes` + `bulletins` (1 par membre, immuable). Le résultat de la
// résolution est recalculé par un trigger DB à la clôture.
export function VotePanel({ meetingId }: { meetingId: string | null }) {
  const { reunions, users, presences, votes, procurations } = useBoardStore(
    useShallow((s) => ({
      reunions: s.reunions,
      users: s.users,
      presences: s.presences,
      votes: s.votes,
      procurations: s.procurations,
    })),
  );
  const openVote = useBoardStore((s) => s.openVote);
  const closeVote = useBoardStore((s) => s.closeVote);

  const [intitule, setIntitule] = useState("");
  const [busy, setBusy] = useState(false);

  const reunion = reunions.find((r) => r.id === meetingId);
  const votants = useMemo(() => {
    const ids = new Set(presences.filter((p) => p.reunionId === meetingId).map((p) => p.userId));
    return users.filter((u) => u.role === "administrateur" && ids.has(u.id));
  }, [presences, users, meetingId]);
  const votesReunion = useMemo(
    () => votes.filter((v) => v.reunionId === meetingId),
    [votes, meetingId],
  );

  if (!reunion) return <Empty />;

  const ouverts = votesReunion.filter((v) => v.statut === "ouvert");
  const clos = votesReunion.filter((v) => v.statut === "clos");
  const cloturee = reunion.statut === "terminee";

  const resultatDe = (v: Vote) => {
    const t = voteTally(v, procurations);
    return { oui: t.oui, non: t.non, abstention: t.abs, adoptee: t.oui > t.non };
  };

  const tableau = (): TableauExport => ({
    titre: `Votes — ${reunion.titre}`,
    entetes: ["Intitulé", "Code", "Statut", "Pour", "Contre", "Abst.", "Résultat"],
    lignes: votesReunion.map((v) => {
      const r = resultatDe(v);
      return [
        v.intitule,
        v.resolutionCode ?? "—",
        v.statut === "clos" ? "Clos" : "En cours",
        String(r.oui),
        String(r.non),
        String(r.abstention),
        v.statut === "clos" ? (r.adoptee ? "Adoptée" : "Rejetée") : "—",
      ];
    }),
  });

  const ouvrir = async () => {
    if (!intitule.trim()) return toast.error("Formulez l'intitulé du scrutin");
    setBusy(true);
    try {
      await openVote(reunion.id, intitule.trim());
      setIntitule("");
      toast.success("Scrutin ouvert", { description: "Les membres présents peuvent voter." });
    } catch {
      toast.error("Impossible d'ouvrir le scrutin");
    } finally {
      setBusy(false);
    }
  };

  const clore = async (voteId: string) => {
    try {
      await closeVote(voteId);
      toast.success("Scrutin clos · résultat calculé");
    } catch {
      toast.error("Clôture impossible");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Header
          title="Votes électroniques"
          subtitle="Ouvrez un scrutin, recueillez les bulletins des membres présents, clôturez pour figer le résultat."
        />
        {votesReunion.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => exporterCsv(tableau())}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-muted transition"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              onClick={() => exporterPdf(tableau())}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-muted transition"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        )}
      </div>

      {votesReunion.length > 0 && (
        <KpiTiles
          tuiles={[
            { label: "Scrutins", valeur: votesReunion.length, ton: "navy" },
            { label: "En cours", valeur: ouverts.length, ton: "emerald" },
            {
              label: "Adoptées",
              valeur: clos.filter((v) => resultatDe(v).adoptee).length,
              ton: "gold",
            },
            {
              label: "Rejetées",
              valeur: clos.filter((v) => !resultatDe(v).adoptee).length,
              ton: "rose",
            },
          ]}
        />
      )}

      {votants.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[15px] text-amber-900">
          Aucun membre présent : enregistrez d'abord les présences dans{" "}
          <span className="font-medium">Émargement & Quorum</span>.
        </div>
      )}

      {/* Ouvrir un scrutin */}
      {!cloturee && (
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="font-semibold text-navy flex items-center gap-2 mb-3">
            <VoteIcon className="h-5 w-5 text-gold" /> Ouvrir un scrutin
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <label className="block">
              <span className="text-xs font-medium text-navy uppercase tracking-wider">
                Intitulé
              </span>
              <input
                value={intitule}
                onChange={(e) => setIntitule(e.target.value)}
                placeholder="Approbation du budget 2027"
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={ouvrir}
              disabled={busy || !intitule.trim() || votants.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-gold text-gold-foreground px-4 py-2.5 font-semibold hover:brightness-110 disabled:opacity-40 transition"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Ouvrir
            </button>
          </div>
        </div>
      )}

      {/* Scrutins ouverts */}
      {ouverts.map((v) => (
        <VoteCard
          key={v.id}
          vote={v}
          votantsCount={votants.length}
          procurations={procurations}
          onClose={() => clore(v.id)}
          readOnly={cloturee}
        />
      ))}

      {/* Scrutins clos */}
      {clos.length > 0 && (
        <div className="space-y-3">
          <div className="text-[13px] uppercase tracking-widest text-muted-foreground font-semibold">
            Scrutins clos
          </div>
          {clos.map((v) => (
            <VoteCard
              key={v.id}
              vote={v}
              votantsCount={votants.length}
              procurations={procurations}
              readOnly
              closed
            />
          ))}
        </div>
      )}

      {ouverts.length === 0 && clos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <VoteIcon className="h-8 w-8 text-muted-foreground mx-auto" />
          <div className="mt-2 text-sm text-muted-foreground">Aucun scrutin pour cette séance.</div>
        </div>
      )}
    </div>
  );
}

function VoteCard({
  vote,
  votantsCount,
  procurations,
  onClose,
  readOnly,
  closed,
}: {
  vote: Vote;
  votantsCount: number;
  procurations: Procuration[];
  onClose?: () => void;
  readOnly?: boolean;
  closed?: boolean;
}) {
  const t = voteTally(vote, procurations);
  const tally = { oui: t.oui, non: t.non, abstention: t.abs } as Record<Choix, number>;
  // Participation brute (nb de membres ayant voté) — distincte du total pondéré
  // utilisé pour les pourcentages des barres ci-dessous.
  const totalBulletins = vote.bulletins.length;
  const total = t.total;
  const adoptee = t.total > 0 && t.oui > t.non;

  return (
    <div
      className={`rounded-2xl border bg-white overflow-hidden ${closed ? "border-border" : "border-emerald-300"}`}
    >
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {vote.resolutionCode && (
              <span className="inline-flex items-center gap-1 text-[12px] font-mono px-1.5 py-0.5 rounded bg-navy/5 text-navy">
                <Gavel className="h-3 w-3" /> {vote.resolutionCode}
              </span>
            )}
            {closed ? (
              <span className="text-[12px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Clos
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> En cours
              </span>
            )}
          </div>
          <div className="font-semibold text-navy mt-1">{vote.intitule}</div>
        </div>
        {closed ? (
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full ${adoptee ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
          >
            {adoptee ? "Adoptée" : "Rejetée"}
          </span>
        ) : (
          !readOnly &&
          onClose && (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-navy hover:bg-muted"
            >
              <StopCircle className="h-4 w-4" /> Clôturer
            </button>
          )
        )}
      </div>

      {/* Décompte */}
      <div className="px-5 py-4 space-y-2">
        {(Object.keys(CHOIX_META) as Choix[]).map((c) => {
          const meta = CHOIX_META[c];
          const pct = total ? Math.round((tally[c] / total) * 100) : 0;
          return (
            <div key={c}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`inline-flex items-center gap-1 font-medium ${meta.color}`}>
                  <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                </span>
                <span className="text-muted-foreground">
                  {tally[c]} · {pct}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${meta.bar} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <div className="text-[13px] text-muted-foreground pt-1">
          {totalBulletins}/{votantsCount} membre(s) présent(s) ont voté
        </div>
      </div>
    </div>
  );
}
