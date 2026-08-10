import {
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { Download, Trophy, Loader2, Medal } from "lucide-react";
import { useKpisGouvernance } from "@/hooks/useKpisGouvernance";
import { ErreurStats } from "./ReunionStatsPanel";
import { StatStrip, StatTile } from "./StatTile";
import { formatFCFA, formatFCFACompact } from "@/lib/utils";

// Palette de la charte, unique à toute la page. Les nuances d'un même camaïeu
// (navy → gold → gris) portent les états, jamais un arc-en-ciel.
const NAVY = "#0D1B3E";
const GOLD = "#C9A84C";
const GRIS = "#94A3B8";

const moisLabel = (ym: string) => {
  const [, m] = ym.split("-");
  return (
    ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"][
      Number(m)
    ] ?? ym
  );
};

// Bloc analytique de la page « Gestion des jetons » : distribution, assiduité,
// classement et exécution des actions pour l'année choisie. L'année est pilotée
// par le parent (le sélecteur vit dans l'en-tête de page).
export function JetonsGouvernanceSection({ annee }: { annee: number }) {
  const { data, loading, error } = useKpisGouvernance(annee);

  const assiduiteMoy =
    data && data.tauxPresenceMensuel.length
      ? Math.round(
          data.tauxPresenceMensuel.reduce((a, m) => a + m.taux_presence_pct, 0) /
            data.tauxPresenceMensuel.length,
        )
      : 0;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-bold text-navy">Vue d'ensemble {annee}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Jetons distribués, assiduité et exécution des décisions sur l'exercice.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      ) : error ? (
        <ErreurStats error={error} />
      ) : !data ? null : (
        <>
          {/* KPIs de l'exercice — mêmes tuiles animées que le reste de la page.
              Les montants « à payer / en attente » ne sont PAS ici : ils vivent
              une seule fois, dans le bloc paiements plus bas. */}
          <StatStrip className="sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              rang={0}
              label="Jetons distribués"
              valeur={data.totaux.jetonsDistribuesTotal}
              format={(n) => formatFCFACompact(n)}
              detail={`Sur l'exercice ${annee}`}
              ton="gold"
            />
            <StatTile
              rang={1}
              label="Sessions tenues"
              valeur={data.totaux.sessionsTotal}
              detail={`${data.totaux.adminsActifs} administrateur(s) actif(s)`}
              ton="navy"
            />
            <StatTile
              rang={2}
              label="Quorum atteint"
              valeur={data.quorum.quorumAtteintPct ?? 0}
              format={(n) => `${n}%`}
              detail={`${data.quorum.reunionsTotal} réunion(s)`}
              jauge={data.quorum.quorumAtteintPct ?? 0}
              ton="emerald"
            />
            <StatTile
              rang={3}
              label="Assiduité moyenne"
              valeur={assiduiteMoy}
              format={(n) => `${n}%`}
              detail="Présence moyenne du Conseil"
              jauge={assiduiteMoy}
              ton="sky"
            />
          </StatStrip>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Distribution mensuelle + cumul — l'unique série temporelle des
                jetons (l'ancienne courbe par séance a été fusionnée ici). */}
            <Carte titre="Jetons distribués — mensuel & cumul">
              {data.evolutionJetonsMensuelle.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={data.evolutionJetonsMensuelle.map((d) => ({
                      ...d,
                      mois: moisLabel(d.mois),
                    }))}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="aire-cumul" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NAVY} stopOpacity={0.14} />
                        <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="mois"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                      tickFormatter={(v) => formatFCFACompact(v).replace(" FCFA", "")}
                    />
                    <Tooltip
                      formatter={(v: number, n: string) => [
                        formatFCFA(Number(v)),
                        n === "cumule" ? "Cumul" : "Distribué",
                      ]}
                      contentStyle={{
                        borderRadius: 10,
                        fontSize: 12,
                        border: "1px solid var(--border)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumule"
                      stroke={NAVY}
                      strokeWidth={2}
                      fill="url(#aire-cumul)"
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="jetons_distribues"
                      stroke={GOLD}
                      strokeWidth={2}
                      fill="none"
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              <Legende
                items={[
                  ["Cumul", NAVY],
                  ["Distribué / mois", GOLD],
                ]}
              />
            </Carte>

            {/* Assiduité mensuelle */}
            <Carte titre="Taux de présence mensuel">
              {data.tauxPresenceMensuel.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={data.tauxPresenceMensuel.map((d) => ({ ...d, mois: moisLabel(d.mois) }))}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="aire-presence" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={NAVY} stopOpacity={0.14} />
                        <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="mois"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, "Présence"]}
                      contentStyle={{
                        borderRadius: 10,
                        fontSize: 12,
                        border: "1px solid var(--border)",
                      }}
                    />
                    {/* Seuil de quorum indicatif, en or discret. */}
                    <ReferenceLine
                      y={70}
                      stroke={GOLD}
                      strokeDasharray="4 4"
                      label={{
                        value: "Seuil 70 %",
                        fontSize: 10,
                        fill: GOLD,
                        position: "insideTopRight",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="taux_presence_pct"
                      stroke={NAVY}
                      strokeWidth={2}
                      fill="url(#aire-presence)"
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Carte>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Classement */}
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-navy">
                  <Trophy className="h-4 w-4 text-gold" /> Classement des jetons perçus
                </h3>
                <button
                  onClick={() => exportLeaderboardCsv(data.leaderboard, annee)}
                  disabled={data.leaderboard.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-navy transition hover:bg-muted disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" /> Exporter CSV
                </button>
              </div>
              {data.leaderboard.length === 0 ? (
                <EmptyChart />
              ) : (
                <div className="space-y-2">
                  {data.leaderboard.map((l, i) => {
                    const max = data.leaderboard[0]?.total_jetons_percus || 1;
                    const pct = Math.round((l.total_jetons_percus / max) * 100);
                    return (
                      <div
                        key={l.nom}
                        className="relative overflow-hidden rounded-xl border border-border"
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-gold/10"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative flex items-center gap-3 px-3 py-2.5">
                          <span className="flex w-6 justify-center">
                            {i < 3 ? (
                              <Medal
                                className="h-4 w-4"
                                style={{ color: ["#C9A84C", "#9CA3AF", "#B45309"][i] }}
                              />
                            ) : (
                              <span className="text-sm text-muted-foreground">{i + 1}</span>
                            )}
                          </span>
                          <span className="flex-1 truncate text-sm font-semibold text-navy">
                            {l.nom}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Présence {l.taux_presence_pct ?? 0}%
                          </span>
                          <span className="w-32 text-right font-mono text-sm font-semibold tabular-nums text-navy">
                            {formatFCFA(l.total_jetons_percus)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Exécution des actions */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-2 text-sm font-bold text-navy">Exécution des actions</h3>
              <ActionsDonut actions={data.actions} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 text-sm font-bold text-navy">{titre}</div>
      {children}
    </div>
  );
}

function Legende({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
      {items.map(([label, couleur]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: couleur }}
            aria-hidden="true"
          />
          {label}
        </span>
      ))}
    </div>
  );
}

// Donut d'exécution : navy = terminé, or = en cours, gris = en retard. L'état est
// aussi porté par le libellé et le pourcentage central — jamais par la couleur seule.
function ActionsDonut({
  actions,
}: {
  actions: {
    terminees: number;
    enCours: number;
    enRetard: number;
    total: number;
    tauxExecutionPct: number;
  };
}) {
  const data = [
    { name: "Terminées", value: actions.terminees, color: NAVY },
    { name: "En cours", value: actions.enCours, color: GOLD },
    { name: "En retard", value: actions.enRetard, color: GRIS },
  ].filter((d) => d.value > 0);

  if (actions.total === 0) return <EmptyChart />;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid var(--border)" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-navy">{actions.tauxExecutionPct ?? 0}%</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            clôturées
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px]">
        {data.map((d) => (
          <span key={d.name} className="inline-flex items-center gap-1 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.name} (
            {d.value})
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
      Aucune donnée pour cette année.
    </div>
  );
}

function exportLeaderboardCsv(
  rows: {
    nom: string;
    total_jetons_percus: number;
    taux_presence_pct: number;
    procurations_donnees: number;
  }[],
  annee: number,
) {
  const header = [
    "Rang",
    "Nom",
    "Jetons percus (FCFA)",
    "Taux presence (%)",
    "Procurations donnees",
  ];
  const lines = rows.map((r, i) =>
    [i + 1, r.nom, r.total_jetons_percus, r.taux_presence_pct ?? 0, r.procurations_donnees].join(
      ";",
    ),
  );
  const csv = "﻿" + [header.join(";"), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leaderboard-jetons-${annee}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
