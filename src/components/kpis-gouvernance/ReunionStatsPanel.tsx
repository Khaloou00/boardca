import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Coins,
  FileSignature,
  Gavel,
  ListChecks,
  Loader2,
  Lock,
  CalendarDays,
} from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { useReunionStats } from "@/hooks/useReunionStats";
import type { ReunionStats } from "@/types/stats";
import { formatFCFA, formatFCFACompact } from "@/lib/utils";

const MODE_COLOR = {
  presentiel: "#059669",
  distance: "#0284c7",
  procuration: "#d97706",
  absent: "#94a3b8",
} as const;

const TYPE_LABEL: Record<string, string> = {
  ca_ordinaire: "Ordinaire",
  ca_extraordinaire: "Extraordinaire",
  comite: "Comité",
};

export function ReunionStatsPanel() {
  const reunions = useBoardStore(useShallow((s) => s.reunions));
  // La plus récente d'abord. À date égale — plusieurs séances tenues le même
  // jour, cas courant — on départage sur l'heure puis le titre : sans ce tri
  // secondaire, `sort` conserve l'ordre d'arrivée du store et « la dernière
  // réunion » désignerait une séance différente d'un chargement à l'autre.
  const sorted = useMemo(
    () =>
      [...reunions].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        const ha = a.heure ?? "";
        const hb = b.heure ?? "";
        if (ha !== hb) return ha < hb ? 1 : -1;
        return a.titre.localeCompare(b.titre);
      }),
    [reunions],
  );
  const [reunionId, setReunionId] = useState<string | null>(null);

  // Défaut : la DERNIÈRE séance, quel que soit son statut. On privilégiait
  // auparavant la dernière séance « terminée » (données plus riches), ce qui
  // ouvrait le tableau de bord sur une séance passée alors qu'une séance
  // planifiée ou en cours plus récente existait — l'inverse de ce qu'on attend
  // en arrivant sur le tableau de bord.
  useEffect(() => {
    if (reunionId || sorted.length === 0) return;
    setReunionId(sorted[0].id);
  }, [sorted, reunionId]);

  const { data, loading, error } = useReunionStats(reunionId);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-bold text-navy flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-gold" /> Statistiques de séance
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Sélectionnez une réunion pour visualiser participation, quorum, jetons et signatures.
          </div>
        </div>
        <select
          value={reunionId ?? ""}
          onChange={(e) => setReunionId(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-navy focus:outline-none focus:ring-2 focus:ring-gold max-w-full"
        >
          {sorted.map((r) => (
            <option key={r.id} value={r.id}>
              {new Date(r.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} ·{" "}
              {r.titre}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      ) : error ? (
        <ErreurStats error={error} />
      ) : !data ? null : (
        <>
          {/* Méta séance */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(data.reunion.date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <Badge>{TYPE_LABEL[data.reunion.type] ?? data.reunion.type}</Badge>
            <Badge tone={data.reunion.statut === "terminee" ? "emerald" : "gold"}>
              {data.reunion.statut}
            </Badge>
          </div>

          {/* Tuiles synthèse */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Tile
              icon={Users}
              label="Participation"
              value={`${data.participation.presents}/${data.participation.invites}`}
              sub={`${data.participation.tauxPresencePct}% présents`}
              tone="navy"
            />
            <Tile
              icon={data.quorum.atteint ? ShieldCheck : ShieldAlert}
              label="Quorum"
              value={data.quorum.atteint ? "Atteint" : "Non atteint"}
              sub={`${data.quorum.presents} / ${data.quorum.requis} requis`}
              tone={data.quorum.atteint ? "emerald" : "red"}
            />
            <Tile
              icon={Coins}
              label="Jetons versés"
              value={formatFCFACompact(data.jetons.total)}
              sub={`${formatFCFACompact(data.jetons.enAttente)} en attente`}
              tone="gold"
            />
            <Tile
              icon={FileSignature}
              label="Signatures PV"
              value={`${data.signatures.signe}/${data.signatures.attendu}`}
              sub={data.signatures.pvStatut}
              tone="sky"
            />
            <Tile
              icon={Gavel}
              label="Résolutions"
              value={`${data.resolutions.adoptees}/${data.resolutions.total}`}
              sub="adoptées"
              tone="navy"
            />
            <Tile
              icon={ListChecks}
              label="Ordre du jour"
              value={String(data.ordreDuJour.points)}
              sub="points"
              tone="slate"
            />
          </div>

          {/* Diagrammes */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Participation donut */}
            <Card title="Répartition de la participation">
              <ParticipationDonut p={data.participation} />
            </Card>

            {/* Jetons par mode */}
            <Card title="Jetons versés par mode de présence">
              <JetonsBar j={data.jetons} />
            </Card>

            {/* Quorum jauge */}
            <Card title="Quorum">
              <QuorumGauge
                presents={data.quorum.presents}
                requis={data.quorum.requis}
                atteint={data.quorum.atteint}
              />
            </Card>

            {/* Signatures donut */}
            <Card title="Signatures du procès-verbal">
              <SignaturesDonut s={data.signatures} />
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

function ParticipationDonut({ p }: { p: ReunionStats["participation"] }) {
  const slices = [
    { name: "Présentiel", value: p.presentiel, color: MODE_COLOR.presentiel },
    { name: "À distance", value: p.distance, color: MODE_COLOR.distance },
    { name: "Procuration", value: p.procuration, color: MODE_COLOR.procuration },
    { name: "Absent", value: p.absent, color: MODE_COLOR.absent },
  ].filter((s) => s.value > 0);
  if (slices.length === 0) return <Empty />;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              innerRadius={60}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-navy">{p.presents}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">présents</div>
        </div>
      </div>
      <Legend items={slices} />
    </div>
  );
}

function JetonsBar({ j }: { j: ReunionStats["jetons"] }) {
  const data = [
    { mode: "Présentiel", montant: j.presentiel },
    { mode: "À distance", montant: j.distance },
    { mode: "Procuration", montant: j.procuration },
  ];
  if (j.total === 0) return <Empty label="Aucun jeton versé pour cette séance." />;
  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <XAxis dataKey="mode" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => formatFCFACompact(v).replace(" FCFA", "")}
          />
          <Tooltip
            formatter={(v: any) => [formatFCFA(Number(v)), "Montant"]}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="montant" radius={[4, 4, 0, 0]} barSize={40}>
            {data.map((d) => (
              <Cell
                key={d.mode}
                fill={
                  d.mode === "Présentiel"
                    ? MODE_COLOR.presentiel
                    : d.mode === "À distance"
                      ? MODE_COLOR.distance
                      : MODE_COLOR.procuration
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5 text-emerald-600">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Payé {formatFCFA(j.paye)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> En attente{" "}
          {formatFCFA(j.enAttente)}
        </span>
      </div>
    </div>
  );
}

function QuorumGauge({
  presents,
  requis,
  atteint,
}: {
  presents: number;
  requis: number;
  atteint: boolean;
}) {
  const max = Math.max(presents, requis, 1);
  const pct = Math.round((presents / max) * 100);
  const reqPct = Math.round((requis / max) * 100);
  return (
    <div className="py-4">
      <div className="flex items-end justify-between mb-2">
        <div className="text-3xl font-bold text-navy">
          {presents} <span className="text-sm font-medium text-muted-foreground">présents</span>
        </div>
        <div
          className={`text-xs font-semibold px-2 py-1 rounded-full ${atteint ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
        >
          {atteint ? "Quorum atteint" : "Quorum non atteint"}
        </div>
      </div>
      <div className="relative h-4 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${atteint ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
        {/* Repère du quorum requis */}
        <div
          className="absolute inset-y-0 w-0.5 bg-navy"
          style={{ left: `${reqPct}%` }}
          title={`Quorum requis : ${requis}`}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>0</span>
        <span className="font-medium text-navy">Requis : {requis}</span>
      </div>
    </div>
  );
}

function SignaturesDonut({ s }: { s: ReunionStats["signatures"] }) {
  const restant = Math.max(s.attendu - s.signe, 0);
  const slices = [
    { name: "Signé", value: s.signe, color: "#059669" },
    { name: "En attente", value: restant, color: "#e2e8f0" },
  ].filter((x) => x.value > 0);
  if (s.attendu === 0) return <Empty label="Pas encore de PV à signer." />;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              innerRadius={60}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((x) => (
                <Cell key={x.name} fill={x.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-navy">{s.tauxPct}%</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">signé</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {s.signe}/{s.attendu} signatures · PV{" "}
        <span className="font-medium text-navy">{s.pvStatut}</span>
      </div>
    </div>
  );
}

// ── petits composants ──────────────────────────────────────────────
const tooltipStyle = { borderRadius: 12, fontSize: 12, border: "1px solid #e5e7eb" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="font-bold text-navy text-sm mb-4">{title}</div>
      {children}
    </div>
  );
}

// Chaque tuile porte une couleur de contexte : fond teinté, filet latéral et
// valeur colorés selon le sens (vert = quorum atteint, rouge = manqué, or = jetons…).
const TILE_TONS: Record<string, { carte: string; barre: string; label: string; valeur: string }> = {
  navy: {
    carte: "bg-navy/5 border-navy/15",
    barre: "bg-navy",
    label: "text-navy",
    valeur: "text-navy",
  },
  gold: {
    carte: "bg-gold/10 border-gold/30",
    barre: "bg-gold",
    label: "text-[#8A6A00]",
    valeur: "text-[#8A6A00]",
  },
  emerald: {
    carte: "bg-emerald-50 border-emerald-200",
    barre: "bg-emerald-500",
    label: "text-emerald-700",
    valeur: "text-emerald-700",
  },
  red: {
    carte: "bg-red-50 border-red-200",
    barre: "bg-red-500",
    label: "text-red-700",
    valeur: "text-red-700",
  },
  sky: {
    carte: "bg-sky-50 border-sky-200",
    barre: "bg-sky-500",
    label: "text-sky-700",
    valeur: "text-sky-700",
  },
  slate: {
    carte: "bg-slate-50 border-slate-200",
    barre: "bg-slate-400",
    label: "text-slate-600",
    valeur: "text-slate-700",
  },
};

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  tone: "navy" | "gold" | "emerald" | "red" | "sky" | "slate";
}) {
  const t = TILE_TONS[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${t.carte}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${t.barre}`} aria-hidden="true" />
      <div
        className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${t.label}`}
      >
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`mt-2 text-xl font-bold font-mono tabular-nums ${t.valeur}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function Legend({ items }: { items: { name: string; value: number; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px]">
      {items.map((s) => (
        <span key={s.name} className="inline-flex items-center gap-1 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.name} (
          {s.value})
        </span>
      ))}
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "emerald" | "gold";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-100 text-emerald-700",
    gold: "bg-gold/15 text-gold",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Empty({ label = "Aucune donnée." }: { label?: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
      {label}
    </div>
  );
}

// Le garde serveur de `get_reunion_stats` lève « Accès refusé » ; toute autre
// erreur (réunion supprimée, réseau) mérite d'être dite telle quelle plutôt que
// déguisée en problème de permission.
export function ErreurStats({ error }: { error: string }) {
  const refus = /acc[eè]s refus/i.test(error);
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
      {refus ? <Lock className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
      {refus ? (
        "Accès réservé au Super Admin, à la Secrétaire et au PCA."
      ) : (
        <>
          <span>Statistiques indisponibles.</span>
          <span className="text-xs opacity-70">{error}</span>
        </>
      )}
    </div>
  );
}
