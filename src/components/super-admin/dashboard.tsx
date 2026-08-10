import { useEffect, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend as RLegend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  Building2,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  Activity,
  CalendarDays,
  Crown,
  ListChecks,
  Inbox,
  ArrowUpRight,
} from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { ROLE_LABELS } from "@/lib/role-labels";
import type { UserRole } from "@/types/domain";
import { Card } from "@/components/ui/card";
import { JetonsGouvernanceSection } from "@/components/kpis-gouvernance/JetonsGouvernanceSection";
import type { AdminSection } from "./layout";

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const ROLE_COLOR: Record<UserRole, string> = {
  super_admin: "#dc2626",
  secretaire: "#0D1B3E",
  administrateur: "#C9A84C",
  responsable_action: "#059669",
  invite: "#7c3aed",
};

const ACTION_COLOR: Record<string, string> = {
  terminee: "#059669",
  en_cours: "#3b82f6",
  en_retard: "#ef4444",
  a_faire: "#94a3b8",
};
const ACTION_LABEL: Record<string, string> = {
  terminee: "Terminées",
  en_cours: "En cours",
  en_retard: "En retard",
  a_faire: "À démarrer",
};

const tooltipStyle = { borderRadius: 12, fontSize: 12, border: "1px solid #e5e7eb" };
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Tableau de bord Super Admin — vue unique.
 *
 * Fusion de l'ancien « Tableau de bord » et de l'ancien « Pilotage & KPIs », qui
 * affichaient les mêmes chiffres sous deux formes (réunions par mois vs activité
 * mensuelle, donut des actions vs barres de statut, comptes/comités/audit comptés deux
 * fois). Règle appliquée ici : **chaque information n'apparaît qu'une seule fois**, sous
 * la forme la plus lisible pour elle.
 */
export function AdminDashboard({ onNav }: { onNav: (s: AdminSection) => void }) {
  const { users, comites, reunions, actions, auditLog, fetchAuditLog } = useBoardStore(
    useShallow((s) => ({
      users: s.users,
      comites: s.comites,
      reunions: s.reunions,
      actions: s.actions,
      auditLog: s.auditLog,
      fetchAuditLog: s.fetchAuditLog,
    })),
  );

  // Le journal d'audit n'est pas chargé par le bootstrap « cœur ».
  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const annee = new Date().getFullYear();
  const actifs = users.filter((u) => u.statut === "actif").length;
  const suspendus = users.filter((u) => u.statut === "suspendu").length;
  const membresCA = users.filter((u) => u.role === "administrateur").length;
  const pca = users.find((u) => u.estPresidentCA);
  const planifiees = reunions.filter((r) => r.statut !== "terminee").length;
  const tenues = reunions.filter((r) => r.statut === "terminee").length;
  const enRetard = actions.filter((a) => a.statut === "en_retard").length;
  const sieges = comites.reduce((s, c) => s + c.membreIds.length, 0);

  const parRole = useMemo(() => {
    const counts = new Map<UserRole, number>();
    for (const u of users) counts.set(u.role, (counts.get(u.role) ?? 0) + 1);
    return [...counts.entries()].map(([role, n]) => ({
      name: ROLE_LABELS[role].label,
      value: n,
      color: ROLE_COLOR[role],
    }));
  }, [users]);

  // Événements d'audit sur les 30 derniers jours.
  const auditSerie = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (29 - i));
      return d;
    });
    return days.map((d) => ({
      jour: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      n: auditLog.filter((a) => sameDay(new Date(a.createdAt), d)).length,
    }));
  }, [auditLog]);
  const auditTotal30j = auditSerie.reduce((s, d) => s + d.n, 0);

  // Activité mensuelle : réunions ET actions sur le même graphe — l'ancien tableau de
  // bord ne montrait que les réunions, le Pilotage refaisait le même avec les actions.
  const activiteMensuelle = useMemo(() => {
    const reuParMois = new Map<number, number>();
    for (const r of reunions) {
      const d = new Date(r.date);
      if (d.getFullYear() === annee)
        reuParMois.set(d.getMonth(), (reuParMois.get(d.getMonth()) ?? 0) + 1);
    }
    const actParMois = new Map<number, number>();
    for (const a of actions) {
      const d = new Date(a.createdAt);
      if (d.getFullYear() === annee)
        actParMois.set(d.getMonth(), (actParMois.get(d.getMonth()) ?? 0) + 1);
    }
    return [...new Set([...reuParMois.keys(), ...actParMois.keys()])]
      .sort((a, b) => a - b)
      .map((m) => ({
        mois: MOIS[m],
        reunions: reuParMois.get(m) ?? 0,
        actions: actParMois.get(m) ?? 0,
      }));
  }, [reunions, actions, annee]);

  const actionsParStatut = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of actions) counts.set(a.statut, (counts.get(a.statut) ?? 0) + 1);
    return [...counts.entries()].map(([statut, n]) => ({
      name: ACTION_LABEL[statut] ?? statut,
      value: n,
      color: ACTION_COLOR[statut] ?? "#94a3b8",
    }));
  }, [actions]);
  const tauxExecution = actions.length
    ? Math.round((actions.filter((a) => a.statut === "terminee").length / actions.length) * 100)
    : 0;
  const avancementMoyen = actions.length
    ? Math.round(actions.reduce((s, a) => s + a.avancement, 0) / actions.length)
    : 0;

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const maxMembres = Math.max(1, ...comites.map((c) => c.membreIds.length));

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-600">
          Super Administration
        </div>
        <h1 className="text-3xl font-bold text-navy">Tableau de bord</h1>
        <p className="mt-1 text-muted-foreground">
          Vision globale de la gouvernance, de l'activité et de la sécurité de la plateforme.
        </p>
      </div>

      {/* Chiffres clés — chacun cliquable vers l'écran qui le détaille. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Utilisateurs actifs"
          value={actifs}
          hint={
            suspendus > 0
              ? `${suspendus} suspendu(s) · ${membresCA} au CA`
              : `${membresCA} membre(s) du CA`
          }
          gradient="from-emerald-600 to-emerald-700"
          onClick={() => onNav("users")}
        />
        <KpiCard
          icon={Building2}
          label="Comités"
          value={comites.length}
          hint={comites.length ? `${sieges} siège(s) pourvu(s)` : "À créer"}
          gradient="from-navy to-navy-light"
          onClick={() => onNav("committees")}
        />
        <KpiCard
          icon={CalendarDays}
          label="Réunions"
          value={reunions.length}
          hint={`${planifiees} planifiée(s) · ${tenues} tenue(s)`}
          gradient="from-gold to-yellow-600"
          onClick={() => onNav("archives")}
        />
        <KpiCard
          icon={ScrollText}
          label="Événements d'audit"
          value={auditLog.length}
          hint={`${auditTotal30j} sur 30 jours`}
          gradient="from-slate-600 to-slate-800"
          onClick={() => onNav("audit")}
        />
      </div>

      {/* Activité mensuelle : réunions + actions, une seule fois. */}
      <Card className="p-6">
        <ChartHeader
          icon={TrendingUp}
          title="Activité mensuelle"
          sub={`Réunions tenues et actions créées — année ${annee}`}
          right={
            <div className="flex items-center gap-4 text-xs">
              <Legend color="bg-navy" label="Réunions" />
              <Legend color="bg-gold" label="Actions" />
            </div>
          }
        />
        {activiteMensuelle.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aucune activité cette année"
            sub="Les réunions et les actions créées apparaîtront ici, mois par mois."
          />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={activiteMensuelle} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <RLegend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="reunions"
                name="Réunions"
                fill="#0D1B3E"
                radius={[4, 4, 0, 0]}
                barSize={22}
              />
              <Bar
                dataKey="actions"
                name="Actions"
                fill="#C9A84C"
                radius={[4, 4, 0, 0]}
                barSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Journal d'audit (30 j) + répartition des rôles */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <ChartHeader
            icon={Activity}
            title="Activité de la plateforme"
            sub="Événements du journal d'audit sur 30 jours"
            right={
              auditTotal30j > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <ArrowUpRight className="h-3.5 w-3.5" /> {auditTotal30j} événements
                </span>
              ) : null
            }
          />
          {auditTotal30j === 0 ? (
            <EmptyState
              icon={Activity}
              title="Aucune activité enregistrée"
              sub="Les connexions, créations et signatures apparaîtront ici."
            />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={auditSerie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="audit-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A84C" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef1f5" vertical={false} />
                <XAxis
                  dataKey="jour"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Événements"]} />
                <Area
                  type="monotone"
                  dataKey="n"
                  stroke="#C9A84C"
                  strokeWidth={2}
                  fill="url(#audit-fill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <ChartHeader icon={Users} title="Répartition des rôles" sub={`${users.length} comptes`} />
          {users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun utilisateur"
              sub="Créez les comptes du Conseil."
            />
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={parRole}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {parRole.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-2xl font-bold text-navy">{users.length}</div>
                  <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
                    comptes
                  </div>
                </div>
              </div>
              <div className="mt-3 w-full space-y-1.5">
                {parRole.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: d.color }}
                    />
                    <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
                    <span className="font-semibold text-navy">{d.value}</span>
                  </div>
                ))}
              </div>
              {pca && (
                <div className="mt-3 flex w-full items-center gap-2 rounded-lg border border-gold/25 bg-gold/10 px-2.5 py-2 text-xs">
                  <Crown className="h-3.5 w-3.5 shrink-0 text-gold" />
                  <span className="text-muted-foreground">PCA</span>
                  <span className="ml-auto truncate font-semibold text-navy">{pca.nom}</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Exécution des actions + composition des comités */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <ChartHeader
            icon={ListChecks}
            title="Exécution des actions"
            sub={`${actions.length} action(s) · ${enRetard} en retard`}
          />
          {actions.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Aucune action assignée"
              sub="Les actions naîtront des résolutions votées."
            />
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={actionsParStatut}
                      dataKey="value"
                      innerRadius={62}
                      outerRadius={86}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {actionsParStatut.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-2xl font-bold text-navy">{tauxExecution}%</div>
                  <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
                    clôturées
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-3 text-[13px]">
                {actionsParStatut.map((d) => (
                  <span
                    key={d.name}
                    className="inline-flex items-center gap-1 text-muted-foreground"
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{" "}
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
              <div className="mt-4 w-full border-t border-border pt-3 text-center">
                <div className="text-xl font-bold text-navy">{avancementMoyen}%</div>
                <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
                  Avancement moyen
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <ChartHeader
            icon={Building2}
            title="Comités"
            sub={comites.length ? `${sieges} siège(s) pourvu(s)` : "Aucun comité"}
          />
          {comites.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Aucun comité"
              sub="Créez-les depuis Gouvernance · Comités."
            />
          ) : (
            <div className="space-y-3">
              {comites.map((c) => {
                const president = c.presidentId ? usersById[c.presidentId] : undefined;
                return (
                  <div key={c.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-navy">{c.nom}</div>
                      <div className="shrink-0 text-xs font-bold text-navy">
                        {c.membreIds.length} membre{c.membreIds.length > 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-gradient-to-r from-gold to-yellow-600"
                        style={{ width: `${(c.membreIds.length / maxMembres) * 100}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      {president ? (
                        <>
                          <Crown className="h-3 w-3 text-gold" /> Présidé par {president.nom}
                        </>
                      ) : (
                        "Aucun président désigné"
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Activité récente + protections réellement en vigueur */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <ChartHeader
            icon={Activity}
            title="Activité récente"
            sub="6 derniers événements d'audit"
            right={
              auditLog.length > 0 ? (
                <button
                  onClick={() => onNav("audit")}
                  className="text-xs font-semibold text-navy hover:text-gold"
                >
                  Voir le journal
                </button>
              ) : null
            }
          />
          {auditLog.length === 0 ? (
            <EmptyState icon={Inbox} title="Journal vide" sub="Aucun événement pour le moment." />
          ) : (
            <ul className="space-y-3">
              {auditLog.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <span className="font-medium text-navy">
                        {a.userId ? (usersById[a.userId]?.nom ?? "Compte supprimé") : "Système"}
                      </span>{" "}
                      — {a.action}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.ressource ? `${a.ressource} · ` : ""}
                      {new Date(a.createdAt).toLocaleString("fr-FR")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          {/* Ne lister ici QUE des protections réellement en vigueur. Les lignes
              « 2FA obligatoire » et « hébergement souverain » affirmées auparavant sont
              des cibles, pas des faits : voir Paramètres sécurité et EXPLICATION.md. */}
          <ChartHeader
            icon={ShieldCheck}
            title="Protections en vigueur"
            sub="Ce qui est réellement appliqué par le serveur"
          />
          <div className="space-y-4 text-sm">
            <Row label="Cloisonnement par rôle (RLS Postgres)" value="Appliqué en base" tone="ok" />
            <Row label="Chiffrement au repos" value="AES-256" tone="ok" />
            <Row label="Chiffrement en transit" value="TLS 1.3" tone="ok" />
            <Row
              label="Traçabilité"
              value={`${auditLog.length} événement(s)`}
              tone={auditLog.length > 0 ? "ok" : undefined}
            />
            <Row
              label="Comptes suspendus"
              value={String(suspendus)}
              tone={suspendus === 0 ? "ok" : "warn"}
            />
            <Row label="2FA · SSO · Hébergement souverain" value="Cible — non activé" tone="warn" />
          </div>
          <button
            onClick={() => onNav("settings")}
            className="mt-4 w-full rounded-lg border border-border py-2 text-xs font-semibold text-navy transition hover:bg-muted"
          >
            Paramètres sécurité
          </button>
        </Card>
      </div>

      {/* Jetons de présence & KPIs de gouvernance (RPC — données réelles) */}
      <JetonsGouvernanceSection annee={new Date().getFullYear()} />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  gradient,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="group text-left">
      <div
        className={`rounded-2xl bg-gradient-to-br p-5 ${gradient} text-white shadow-lg transition group-hover:-translate-y-0.5 group-hover:shadow-xl`}
      >
        <Icon className="h-6 w-6 opacity-80" />
        <div className="mt-3 font-mono text-3xl font-bold tabular-nums">{value}</div>
        <div className="mt-1 text-xs opacity-85">{label}</div>
        <div className="mt-1.5 text-[12px] opacity-60">{hint}</div>
      </div>
    </button>
  );
}

function ChartHeader({
  icon: Icon,
  title,
  sub,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 shrink-0 text-gold" />
        <div>
          <div className="font-semibold leading-tight text-navy">{title}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <div className={`h-3 w-3 rounded ${color}`} /> {label}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium text-navy">{title}</div>
      <div className="max-w-[260px] text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-semibold ${tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-navy"}`}
      >
        {value}
      </span>
    </div>
  );
}
