import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import {
  ListChecks,
  CalendarClock,
  FileText,
  Paperclip,
  X,
  Clock,
  Send,
  Loader2,
  Search,
  Filter,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  Monitor,
  Smartphone,
  User as UserIcon,
  LogOut,
  Bell,
  Shield,
  Fingerprint,
  Mail,
  Phone,
  ArrowLeft,
  Bug,
  LifeBuoy,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useSectionPersistante } from "@/lib/use-section-persistante";
import {
  creerSignalement,
  SIGNALEMENT_CATEGORIES,
  type SignalementCategorie,
} from "@/lib/signalements";
import {
  fetchRapportsAction,
  uploadPieceJointe,
  lienPieceJointe,
  MAX_RAPPORT_BYTES,
} from "@/lib/action-rapports";
import type { Action, ActionRapport } from "@/types/domain";

export const Route = createFileRoute("/actions")({
  ssr: false,
  component: ActionsPage,
  head: () => ({ meta: [{ title: "Suivi des actions — BoardCA" }] }),
});

// ─── Écrans (routes internes, partagés desktop / mobile) ──────
// Liste runtime ET type dérivés l'un de l'autre : l'écran est restauré après un
// rafraîchissement et doit être validé à l'exécution (voir `useSectionPersistante`).
const SCREEN_KEYS = [
  "taches",
  "completees",
  "profil", // hub du menu (mobile uniquement)
  "infos",
  "notifications",
  "securite",
  "aide",
  "signaler",
] as const;

type Screen = (typeof SCREEN_KEYS)[number];

const SCREENS: Record<
  Exclude<Screen, "profil">,
  { label: string; icon: any; group: "Activité" | "Compte" | "Support" }
> = {
  taches: { label: "Mes tâches", icon: Target, group: "Activité" },
  completees: { label: "Tâches complétées", icon: CheckCircle2, group: "Activité" },
  infos: { label: "Mon profil", icon: UserIcon, group: "Compte" },
  notifications: { label: "Notifications", icon: Bell, group: "Compte" },
  securite: { label: "Sécurité", icon: Shield, group: "Compte" },
  aide: { label: "Aide & support", icon: LifeBuoy, group: "Support" },
  signaler: { label: "Signaler un problème", icon: Bug, group: "Support" },
};

type Etat = "en_cours" | "en_retard" | "a_valider" | "terminee";
type Filtre = "toutes" | "a_faire" | Etat;
const today = () => new Date().toLocaleDateString("en-CA");

// `a_valider` : le responsable a déclaré 100 % via un rapport ; le secrétariat doit
// confirmer la clôture avant que l'action passe « terminée ». Le retard, lui, se
// déduit de l'échéance.
function etat(a: Action): Etat {
  if (a.statut === "terminee") return "terminee";
  if (a.statut === "a_valider") return "a_valider";
  if (a.echeance && a.echeance < today()) return "en_retard";
  return "en_cours";
}

function matchFiltre(a: Action, f: Filtre): boolean {
  if (f === "toutes") return true;
  if (f === "a_faire") return a.avancement === 0 && etat(a) !== "terminee";
  if (f === "en_cours") return etat(a) === "en_cours" || etat(a) === "a_valider";
  return etat(a) === f;
}

const META: Record<
  Etat,
  { label: string; chip: string; barre: string; dot: string; icon: any; iconBg: string }
> = {
  en_cours: {
    label: "En cours",
    chip: "bg-blue-50 text-blue-700",
    barre: "bg-blue-500",
    dot: "bg-amber-500",
    icon: Clock,
    iconBg: "bg-blue-500",
  },
  en_retard: {
    label: "En retard",
    chip: "bg-rose-50 text-rose-700",
    barre: "bg-rose-500",
    dot: "bg-rose-500",
    icon: AlertTriangle,
    iconBg: "bg-rose-500",
  },
  a_valider: {
    label: "À confirmer",
    chip: "bg-amber-50 text-amber-700",
    barre: "bg-amber-500",
    dot: "bg-amber-500",
    icon: Clock,
    iconBg: "bg-amber-500",
  },
  terminee: {
    label: "Terminée",
    chip: "bg-emerald-50 text-emerald-700",
    barre: "bg-emerald-500",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
    iconBg: "bg-emerald-500",
  },
};

function initiales(nom?: string): string {
  if (!nom) return "?";
  const parts = nom.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
const dateCourt = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

// ═════════════════════════════════════════════════════════════
function ActionsPage() {
  const { profile, actions, actionsLoading, users } = useBoardStore(
    useShallow((s) => ({
      profile: s.profile,
      actions: s.actions,
      actionsLoading: s.actionsLoading,
      users: s.users,
    })),
  );
  const fetchActions = useBoardStore((s) => s.fetchActions);
  const soumettreRapportAction = useBoardStore((s) => s.soumettreRapportAction);
  const logout = useBoardStore((s) => s.logout);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  // Écran et mode d'affichage conservés au rafraîchissement — sinon un F5
  // ramenait toujours à « Mes tâches » en vue desktop.
  const [view, setView] = useSectionPersistante<"desktop" | "mobile">(
    "actions-view",
    ["desktop", "mobile"],
    "desktop",
  );
  const [screen, setScreen] = useSectionPersistante<Screen>(
    "actions-screen",
    SCREEN_KEYS,
    "taches",
  );

  const mesActions = useMemo(
    () =>
      [...actions]
        .filter((a) => a.responsableId === profile?.id)
        .sort((a, b) => {
          const rang = { a_valider: 0, en_retard: 1, en_cours: 2, terminee: 3 };
          const d = rang[etat(a)] - rang[etat(b)];
          return d !== 0 ? d : (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999");
        }),
    [actions, profile?.id],
  );

  const stats = useMemo(() => {
    const c = {
      total: mesActions.length,
      en_cours: 0,
      en_retard: 0,
      a_valider: 0,
      terminee: 0,
      somme: 0,
    };
    for (const a of mesActions) {
      c[etat(a)]++;
      c.somme += a.avancement;
    }
    return { ...c, moyen: mesActions.length ? Math.round(c.somme / mesActions.length) : 0 };
  }, [mesActions]);

  const nomAuteur = (id: string) => users.find((u) => u.id === id)?.nom ?? "—";
  // Nouveau flux : le responsable soumet un RAPPORT (texte + avancement + pièce
  // jointe facultative), il ne déplace plus une barre. La RPC met à jour l'action
  // et notifie le secrétariat + le CA ; à 100 % elle passe « à confirmer ».
  const onRapport =
    (id: string) => async (r: { texte: string; avancement: number; fichier?: File }) => {
      let piece;
      if (r.fichier) piece = await uploadPieceJointe(id, r.fichier);
      await soumettreRapportAction({
        actionId: id,
        texte: r.texte,
        avancement: r.avancement,
        fichier: piece
          ? { path: piece.path, nom: piece.nom, type: piece.type, taille: piece.taille }
          : undefined,
      });
    };
  // Insère un signalement : un trigger Postgres le relaie à la Secrétaire et aux
  // membres du CA via des notifications (voir src/lib/signalements.ts + migration 033).
  const onSignaler = (input: {
    categorie: SignalementCategorie;
    sujet: string;
    description: string;
    actionId?: string | null;
  }) => {
    if (!profile?.id) return Promise.reject(new Error("Session expirée"));
    return creerSignalement({ ...input, auteurId: profile.id });
  };

  const shared = {
    mesActions,
    stats,
    actionsLoading,
    nomAuteur,
    onRapport,
    onSignaler,
    profile,
    logout,
    screen,
    setScreen,
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Bascule Desktop / Mobile (flottante, centrée) */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 rounded-full bg-white shadow-lg border border-border p-1">
          <ToggleBtn
            active={view === "desktop"}
            onClick={() => setView("desktop")}
            icon={Monitor}
            label="Desktop"
          />
          <ToggleBtn
            active={view === "mobile"}
            onClick={() => setView("mobile")}
            icon={Smartphone}
            label="Mobile"
          />
        </div>
      </div>

      {view === "desktop" ? (
        <DesktopView {...shared} />
      ) : (
        <div className="flex justify-center py-16 px-4">
          {/* Le cadre iPhone de démonstration a été retiré (app réellement
              responsive) : on borne simplement la largeur en vue « Mobile ». */}
          <div className="w-full max-w-[460px]">
            <MobileView {...shared} />
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? "bg-navy text-white shadow" : "text-slate-500 hover:text-navy"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// ═══════════════════════ DESKTOP ═══════════════════════
function DesktopView({
  mesActions,
  stats,
  actionsLoading,
  nomAuteur,
  onRapport,
  onSignaler,
  profile,
  logout,
  screen,
  setScreen,
}: any) {
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [q, setQ] = useState("");

  // Le hub "profil" est une notion mobile : sur desktop on retombe sur "Mon profil".
  const actif: Exclude<Screen, "profil"> = screen === "profil" ? "infos" : screen;

  const completees = mesActions.filter((a: Action) => etat(a) === "terminee");
  const visibles = useMemo(
    () =>
      mesActions.filter(
        (a: Action) =>
          matchFiltre(a, filtre) && a.titre.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [mesActions, filtre, q],
  );

  const chips: { key: Filtre; label: string }[] = [
    { key: "toutes", label: "Toutes" },
    { key: "a_faire", label: "À faire" },
    { key: "en_cours", label: "En cours" },
    { key: "en_retard", label: "En retard" },
    { key: "terminee", label: "Terminées" },
  ];

  const groupes: ("Activité" | "Compte" | "Support")[] = ["Activité", "Compte", "Support"];

  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("ra-nav-collapsed") === "1",
  );
  useEffect(() => {
    localStorage.setItem("ra-nav-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const compteur = (k: Exclude<Screen, "profil">) =>
    k === "taches"
      ? stats.en_cours + stats.en_retard
      : k === "completees"
        ? stats.terminee
        : undefined;

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* ── Sidebar navy (façon Secrétariat) ── */}
      <aside
        className={`${collapsed ? "w-[76px]" : "w-72"} bg-navy text-navy-foreground flex flex-col sticky top-0 h-screen transition-[width] duration-200`}
      >
        <div
          className={`p-4 border-b border-white/10 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}
        >
          {!collapsed && (
            <div className="flex flex-col items-start gap-2">
              <BrandLogo imgClassName="h-6" variant="white" />
              <div>
                <div className="font-bold text-[15px]">BoardCA</div>
                <div className="text-[10px] uppercase tracking-widest text-gold">
                  Responsable d'Action
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Déplier le menu" : "Replier le menu"}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-navy-foreground/70 hover:bg-white/10 hover:text-white transition shrink-0"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2.5 space-y-6"
          aria-label="Navigation Responsable d'action"
        >
          {groupes.map((g) => (
            <div key={g}>
              {!collapsed && (
                <div className="px-3 text-[11px] uppercase tracking-widest text-navy-foreground/50 mb-2 font-semibold">
                  {g}
                </div>
              )}
              <ul className="space-y-1.5">
                {(Object.keys(SCREENS) as Exclude<Screen, "profil">[])
                  .filter((k) => SCREENS[k].group === g)
                  .map((k) => {
                    const s = SCREENS[k];
                    const on = actif === k;
                    const n = compteur(k);
                    return (
                      <li key={k}>
                        <button
                          onClick={() => setScreen(k)}
                          aria-current={on ? "page" : undefined}
                          title={collapsed ? s.label : undefined}
                          className={`w-full flex items-center gap-3 rounded-xl text-[15px] transition-all duration-150 border-l-[3px] ${collapsed ? "justify-center px-0 py-3" : "pl-3 pr-3 py-2.5"} ${on ? "bg-[rgba(201,168,76,0.12)] text-white font-semibold border-gold" : "text-white/85 hover:bg-white/[0.06] border-transparent"}`}
                        >
                          <s.icon
                            className={`h-[22px] w-[22px] shrink-0 ${on ? "text-gold" : "text-white/60"}`}
                          />
                          {!collapsed && (
                            <span className="flex-1 text-left truncate">{s.label}</span>
                          )}
                          {!collapsed && n != null && n > 0 && (
                            <span className="text-[10px] font-bold rounded-full px-1.5 py-px bg-white/15 shrink-0">
                              {n}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>

        <div
          className={`p-4 border-t border-white/10 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}
        >
          <div className="h-10 w-10 rounded-full bg-gold text-gold-foreground flex items-center justify-center font-semibold text-sm shrink-0">
            {profile?.initiales || initiales(profile?.nom)}
          </div>
          {!collapsed && (
            <div className="text-[13px] min-w-0 flex-1">
              <div className="font-semibold truncate">{profile?.nom ?? "—"}</div>
              <div className="text-navy-foreground/60">Responsable d'Action</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => logout()}
              title="Déconnexion"
              className="h-9 w-9 rounded-lg flex items-center justify-center text-navy-foreground/70 hover:bg-white/10 hover:text-white transition shrink-0"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </aside>

      {/* ── Contenu ── */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-8 pb-32">
          {actif === "taches" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-navy">
                  Bonjour {profile?.nom ? profile.nom.split(" ")[0] : ""}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Suivez et mettez à jour les actions issues des délibérations du CA.
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatTile
                  icon={Target}
                  label="Total"
                  value={stats.total}
                  gradient="from-emerald-600 to-emerald-800"
                />
                <StatTile
                  icon={Zap}
                  label="En cours"
                  value={stats.en_cours + stats.a_valider}
                  gradient="from-teal-600 to-cyan-800"
                />
                <StatTile
                  icon={AlertTriangle}
                  label="En retard"
                  value={stats.en_retard}
                  gradient="from-slate-700 to-slate-900"
                />
                <StatTile
                  icon={CheckCircle2}
                  label="Terminées"
                  value={stats.terminee}
                  gradient="from-emerald-600 to-emerald-800"
                />
                <StatTile
                  icon={TrendingUp}
                  label="Avancement moyen"
                  value={`${stats.moyen}%`}
                  gradient="from-emerald-800 to-slate-900"
                />
              </div>

              <div className="rounded-2xl bg-card border border-border shadow-sm p-4 flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Rechercher une action…"
                    className="w-full rounded-xl bg-muted/50 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2 flex-wrap">
                  {chips.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setFiltre(c.key)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                        filtre === c.key
                          ? "bg-navy text-white"
                          : "bg-muted/60 text-slate-500 hover:text-navy"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <DesktopList
                items={visibles}
                loading={actionsLoading && mesActions.length === 0}
                empty={
                  mesActions.length === 0
                    ? "Aucune action ne vous est confiée pour l'instant."
                    : "Aucune action ne correspond à ce filtre."
                }
                {...{ nomAuteur, onRapport }}
              />
            </div>
          )}

          {actif === "completees" && (
            <ContentCard
              title="Tâches complétées"
              subtitle="Les actions que vous avez menées à 100 %."
            >
              <DesktopList
                items={completees}
                loading={actionsLoading && mesActions.length === 0}
                empty="Aucune action terminée pour l'instant."
                {...{ nomAuteur, onRapport }}
              />
            </ContentCard>
          )}

          {actif === "infos" && (
            <ContentCard title="Mon profil" subtitle="Vos informations de compte.">
              <InfosContent profile={profile} />
            </ContentCard>
          )}
          {actif === "notifications" && (
            <ContentCard
              title="Notifications"
              subtitle="Choisissez ce dont vous voulez être averti."
            >
              <NotificationsContent />
            </ContentCard>
          )}
          {actif === "securite" && (
            <ContentCard title="Sécurité" subtitle="Protection de votre accès.">
              <SecuriteContent />
            </ContentCard>
          )}
          {actif === "aide" && (
            <ContentCard title="Aide & support" subtitle="Nous sommes là pour vous accompagner.">
              <AideContent />
            </ContentCard>
          )}
          {actif === "signaler" && (
            <ContentCard
              title="Signaler un problème"
              subtitle="En rapport avec une action. Relayé à la Secrétaire et aux membres du CA."
            >
              <SignalerForm onSignaler={onSignaler} actions={mesActions} />
            </ContentCard>
          )}
        </div>
      </main>
    </div>
  );
}

function ContentCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm p-6">
      <h2 className="text-xl font-bold text-navy">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, gradient }: any) {
  return (
    <div className={`rounded-2xl p-5 bg-gradient-to-br ${gradient} text-white shadow-lg`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-85">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-3 text-3xl font-bold font-mono tabular-nums">{value}</div>
    </div>
  );
}

function DesktopList({ items, loading, empty, nomAuteur, onRapport }: any) {
  return (
    <div className="space-y-4">
      {loading && (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      )}
      {items.map((a: Action) => (
        <DesktopCard key={a.id} action={a} nomAuteur={nomAuteur} onRapport={onRapport(a.id)} />
      ))}
      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <ListChecks className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="mt-3 text-sm text-muted-foreground">{empty}</div>
        </div>
      )}
    </div>
  );
}

function DesktopCard({
  action,
  nomAuteur,
  onRapport,
}: {
  action: Action;
  nomAuteur: (id: string) => string;
  onRapport: (r: { texte: string; avancement: number; fichier?: File }) => Promise<void>;
}) {
  const [detail, setDetail] = useState(false);
  const e = etat(action);
  const meta = META[e];
  const retard = action.echeance
    ? Math.round((new Date(action.echeance).getTime() - new Date(today()).getTime()) / 86_400_000)
    : null;

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className={`h-11 w-11 shrink-0 rounded-xl ${meta.iconBg} text-white grid place-items-center`}
        >
          <meta.icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-navy text-lg leading-tight">{action.titre}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                {action.echeance && (
                  <>
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {dateCourt(action.echeance)}
                    </span>
                    {e !== "terminee" && retard !== null && (
                      <span
                        className={e === "en_retard" ? "text-rose-600 font-medium" : "opacity-70"}
                      >
                        {retard < 0
                          ? `${-retard}j de retard`
                          : retard === 0
                            ? "aujourd'hui"
                            : `dans ${retard}j`}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${meta.chip}`}
            >
              {meta.label}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Avancement</span>
            <div className="flex-1" />
            <span className="text-sm font-bold tabular-nums text-navy">{action.avancement}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full ${meta.barre} transition-all duration-500`}
              style={{ width: `${action.avancement}%` }}
            />
          </div>

          {e === "a_valider" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Clock className="h-3.5 w-3.5 shrink-0" /> Clôture à 100 % soumise — en attente de
              confirmation du secrétariat.
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {e !== "terminee" && (
              <button
                onClick={() => setDetail((d) => !d)}
                className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white hover:brightness-125 transition"
              >
                <FileText className="h-3.5 w-3.5" />
                {detail ? "Fermer" : "Rédiger un rapport"}
              </button>
            )}
            <RapportsToggle actionId={action.id} nomAuteur={nomAuteur} />
          </div>

          {detail && e !== "terminee" && (
            <div className="mt-4 border-t border-border pt-4">
              {action.description && (
                <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
              )}
              <RapportForm
                avancementActuel={action.avancement}
                onSubmit={async (r) => {
                  await onRapport(r);
                  setDetail(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Formulaire de rapport d'avancement : texte obligatoire, avancement déclaré,
// pièce jointe facultative. À 100 %, l'action passera « à confirmer ».
function RapportForm({
  avancementActuel,
  onSubmit,
  compact = false,
}: {
  avancementActuel: number;
  onSubmit: (r: { texte: string; avancement: number; fichier?: File }) => Promise<void>;
  compact?: boolean;
}) {
  const [texte, setTexte] = useState("");
  const [avancement, setAvancement] = useState(avancementActuel);
  const [fichier, setFichier] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const choisir = (f: File | null) => {
    if (f && f.size > MAX_RAPPORT_BYTES) {
      toast.error("Fichier trop lourd", { description: "25 Mo maximum." });
      return;
    }
    setFichier(f);
  };

  const envoyer = async () => {
    if (!texte.trim()) return toast.error("Le rapport doit contenir un texte");
    setBusy(true);
    try {
      await onSubmit({ texte: texte.trim(), avancement, fichier: fichier ?? undefined });
      toast.success(
        avancement >= 100
          ? "Rapport transmis — clôture en attente du secrétariat"
          : "Rapport transmis",
      );
      setTexte("");
      setFichier(null);
    } catch (err: any) {
      toast.error("Envoi du rapport impossible", { description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-3 ${compact ? "" : "rounded-xl bg-muted/40 p-4"}`}>
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={3}
        placeholder="Décrivez l'avancement, les difficultés, les prochaines étapes…"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
      />
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
          Avancement déclaré · {avancement}%
        </div>
        <div className="flex gap-1.5">
          {[0, 25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => setAvancement(p)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold border transition ${
                avancement === p
                  ? "bg-navy text-white border-navy"
                  : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 cursor-pointer">
        <Paperclip className="h-3.5 w-3.5 shrink-0" />
        {fichier ? (
          <>
            <span className="flex-1 truncate text-navy">{fichier.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setFichier(null);
              }}
              aria-label="Retirer"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </>
        ) : (
          <span>Joindre une pièce (facultatif)</span>
        )}
        <input
          type="file"
          hidden
          onChange={(e) => {
            choisir(e.target.files?.[0] ?? null);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {avancement >= 100 && (
        <div className="text-[11px] text-amber-700">
          À 100 %, l'action passera « à confirmer » : le secrétariat validera la clôture.
        </div>
      )}
      <button
        onClick={envoyer}
        disabled={busy || !texte.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gold text-gold-foreground py-2.5 text-sm font-semibold disabled:opacity-40 hover:brightness-105 transition"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Transmettre le rapport
      </button>
    </div>
  );
}

// Bouton + fil des rapports d'avancement (chargés à la demande, avec pièce jointe).
function RapportsToggle({
  actionId,
  nomAuteur,
}: {
  actionId: string;
  nomAuteur: (id: string) => string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [rapports, setRapports] = useState<ActionRapport[] | null>(null);

  const basculer = async () => {
    const o = !ouvert;
    setOuvert(o);
    if (o && rapports === null) {
      try {
        setRapports(await fetchRapportsAction(actionId));
      } catch {
        setRapports([]);
      }
    }
  };

  const ouvrirPiece = async (path: string) => {
    const url = await lienPieceJointe(path);
    if (url) window.open(url, "_blank");
    else toast.error("Pièce jointe indisponible");
  };

  return (
    <>
      <button
        onClick={basculer}
        className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-navy transition"
      >
        Rapports
        {rapports && rapports.length > 0 && (
          <span className="rounded-full bg-white px-1.5 py-px text-[10px] font-bold text-navy">
            {rapports.length}
          </span>
        )}
        <ChevronRight className={`h-3.5 w-3.5 transition ${ouvert ? "rotate-90" : ""}`} />
      </button>
      {ouvert && (
        <div className="w-full mt-2 space-y-2.5 border-l-2 border-border pl-3">
          {rapports === null ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
            </div>
          ) : rapports.length === 0 ? (
            <div className="text-xs text-muted-foreground">Aucun rapport pour l'instant.</div>
          ) : (
            rapports.map((r) => (
              <div key={r.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-navy">{nomAuteur(r.auteurId)}</span>
                  <span className="rounded-full bg-navy/10 px-1.5 py-px text-[10px] font-bold text-navy">
                    {r.avancement}%
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{r.texte}</div>
                {r.fichierPath && (
                  <button
                    onClick={() => ouvrirPiece(r.fichierPath!)}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-navy underline underline-offset-2"
                  >
                    <Paperclip className="h-3 w-3" />
                    {r.fichierNom ?? "Pièce jointe"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}

// ═══════════════════════ MOBILE ═══════════════════════
function MobileView({
  mesActions,
  stats,
  actionsLoading,
  nomAuteur,
  onRapport,
  onSignaler,
  profile,
  logout,
  screen,
  setScreen,
}: any) {
  const taches = mesActions.filter((a: Action) => etat(a) !== "terminee");
  const completees = mesActions.filter((a: Action) => etat(a) === "terminee");

  // Onglet actif de la barre du bas (les sous-écrans du menu comptent comme "profil").
  const navTab: "taches" | "completees" | "profil" =
    screen === "taches" || screen === "completees" ? screen : "profil";

  const sousEcran = screen !== "taches" && screen !== "completees" && screen !== "profil";

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="flex-1 overflow-y-auto">
        {screen === "taches" || screen === "completees" ? (
          <MobileListeEcran
            titre={screen === "completees" ? "Actions terminées" : "Mes actions"}
            nom={profile?.nom ?? "—"}
            stats={stats}
            items={screen === "completees" ? completees : taches}
            vide={screen === "completees" ? "Aucune action terminée." : "Aucune action en cours."}
            loading={actionsLoading && mesActions.length === 0}
            {...{ nomAuteur, onRapport }}
          />
        ) : screen === "profil" ? (
          <MobileProfil
            profile={profile}
            stats={stats}
            tachesCount={taches.length}
            completeesCount={completees.length}
            setScreen={setScreen}
            logout={logout}
          />
        ) : (
          <SousEcran
            titre={SCREENS[screen as Exclude<Screen, "profil">].label}
            onBack={() => setScreen("profil")}
          >
            {screen === "infos" && <InfosContent profile={profile} />}
            {screen === "notifications" && <NotificationsContent />}
            {screen === "securite" && <SecuriteContent />}
            {screen === "aide" && <AideContent />}
            {screen === "signaler" && (
              <SignalerForm onSignaler={onSignaler} actions={taches.concat(completees)} />
            )}
          </SousEcran>
        )}
      </div>

      {/* Barre de navigation */}
      <div className="border-t border-border bg-card px-2 py-2 flex items-center justify-around">
        <NavBtn
          active={navTab === "taches" && !sousEcran}
          onClick={() => setScreen("taches")}
          icon={Target}
          label="Mes tâches"
        />
        <NavBtn
          active={navTab === "completees" && !sousEcran}
          onClick={() => setScreen("completees")}
          icon={CheckCircle2}
          label="Complétées"
        />
        <NavBtn
          active={navTab === "profil"}
          onClick={() => setScreen("profil")}
          icon={UserIcon}
          label="Profil"
        />
      </div>
    </div>
  );
}

function MobileListeEcran({ titre, nom, stats, items, vide, loading, nomAuteur, onRapport }: any) {
  return (
    <>
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white px-5 pt-5 pb-6">
        <div className="text-[11px] uppercase tracking-widest text-emerald-300 font-semibold">
          {titre}
        </div>
        <div className="text-2xl font-bold mt-0.5">{nom}</div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <MiniTile value={stats.en_retard} label="Retard" />
          <MiniTile value={stats.en_cours + stats.a_valider} label="En cours" />
          <MiniTile value={stats.terminee} label="Faites" />
        </div>
      </div>
      <div className="px-4 py-4 space-y-3">
        {loading && <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground mt-8" />}
        {items.map((a: Action) => (
          <MobileCard key={a.id} action={a} nomAuteur={nomAuteur} onRapport={onRapport(a.id)} />
        ))}
        {!loading && items.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-12">
            <ListChecks className="h-10 w-10 mx-auto mb-2 opacity-50" />
            {vide}
          </div>
        )}
      </div>
    </>
  );
}

function SousEcran({
  titre,
  onBack,
  children,
}: {
  titre: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white px-4 pt-5 pb-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-full bg-white/10 grid place-items-center active:scale-95 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="font-bold text-lg">{titre}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MiniTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 py-3 text-center">
      <div className="text-2xl font-bold text-gold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/70 mt-0.5">{label}</div>
    </div>
  );
}

function NavBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-1 text-[11px] font-medium transition ${active ? "text-navy" : "text-slate-400"}`}
    >
      <Icon className="h-5 w-5" /> {label}
    </button>
  );
}

function MobileCard({
  action,
  nomAuteur,
  onRapport,
}: {
  action: Action;
  nomAuteur: (id: string) => string;
  onRapport: (r: { texte: string; avancement: number; fichier?: File }) => Promise<void>;
}) {
  const [ouvert, setOuvert] = useState(false);
  const e = etat(action);
  const meta = META[e];

  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span
          className={
            e === "en_retard"
              ? "text-rose-600"
              : e === "terminee"
                ? "text-emerald-600"
                : "text-amber-600"
          }
        >
          {meta.label}
        </span>
      </div>
      <div className="font-semibold text-navy mt-1.5 leading-tight">{action.titre}</div>
      {action.echeance && (
        <div className="text-xs text-muted-foreground mt-1">
          Échéance : {dateCourt(action.echeance)}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Avancement</span>
        <span className="font-bold tabular-nums text-navy">{action.avancement}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${meta.barre} transition-all duration-500`}
          style={{ width: `${action.avancement}%` }}
        />
      </div>

      {e === "a_valider" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          <Clock className="h-3.5 w-3.5 shrink-0" /> Clôture soumise — en attente du secrétariat.
        </div>
      )}

      {e !== "terminee" && (
        <button
          onClick={() => setOuvert((o) => !o)}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-navy py-2.5 text-sm font-semibold text-white hover:brightness-125 transition"
        >
          <FileText className="h-4 w-4" />
          {ouvert ? "Fermer" : "Rédiger un rapport"}
        </button>
      )}

      <div className="mt-2">
        <RapportsToggle actionId={action.id} nomAuteur={nomAuteur} />
      </div>

      {ouvert && e !== "terminee" && (
        <div className="mt-3 border-t border-border pt-3">
          <RapportForm
            compact
            avancementActuel={action.avancement}
            onSubmit={async (r) => {
              await onRapport(r);
              setOuvert(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MobileProfil({ profile, stats, tachesCount, completeesCount, setScreen, logout }: any) {
  return (
    <div>
      {/* Carte d'identité */}
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-slate-900 text-white px-5 pt-6 pb-8 flex flex-col items-center">
        <div className="h-20 w-20 rounded-3xl bg-emerald-400 text-emerald-950 grid place-items-center text-2xl font-bold shadow-lg">
          {profile?.initiales || initiales(profile?.nom)}
        </div>
        <div className="text-xl font-bold mt-3">{profile?.nom ?? "—"}</div>
        <div className="mt-2 inline-block text-[10px] uppercase tracking-widest bg-white/15 px-2.5 py-1 rounded-full font-semibold">
          Responsable d'Action
        </div>
      </div>

      <div className="p-4 space-y-4">
        <ProfilSection title="Activité">
          <MenuRow
            icon={Target}
            wrap="bg-blue-500/10 border-blue-500/30"
            color="text-blue-600"
            label="Mes tâches"
            sub="Actions en cours et en retard"
            badge={tachesCount}
            onClick={() => setScreen("taches")}
          />
          <MenuRow
            icon={CheckCircle2}
            wrap="bg-emerald-500/10 border-emerald-500/30"
            color="text-emerald-600"
            label="Tâches complétées"
            sub="Vos actions terminées"
            value={String(completeesCount)}
            onClick={() => setScreen("completees")}
          />
          <MenuRow
            icon={TrendingUp}
            wrap="bg-violet-500/10 border-violet-500/30"
            color="text-violet-600"
            label="Avancement moyen"
            sub="Sur l'ensemble de vos actions"
            value={`${stats?.moyen ?? 0}%`}
          />
        </ProfilSection>

        <ProfilSection title="Compte">
          <MenuRow
            icon={UserIcon}
            wrap="bg-slate-500/10 border-slate-300"
            color="text-slate-600"
            label="Mon profil"
            sub="Nom, email, téléphone"
            onClick={() => setScreen("infos")}
          />
          <MenuRow
            icon={Bell}
            wrap="bg-amber-500/10 border-amber-500/30"
            color="text-amber-600"
            label="Notifications"
            sub="Alertes et rappels"
            onClick={() => setScreen("notifications")}
          />
          <MenuRow
            icon={Shield}
            wrap="bg-navy/10 border-navy/20"
            color="text-navy"
            label="Sécurité"
            sub="2FA, biométrie, mot de passe"
            onClick={() => setScreen("securite")}
          />
        </ProfilSection>

        <ProfilSection title="Support">
          <MenuRow
            icon={LifeBuoy}
            wrap="bg-teal-500/10 border-teal-500/30"
            color="text-teal-600"
            label="Aide & support"
            sub="Guide et contact du Secrétariat"
            onClick={() => setScreen("aide")}
          />
          <MenuRow
            icon={Bug}
            wrap="bg-rose-500/10 border-rose-500/30"
            color="text-rose-600"
            label="Signaler un problème"
            sub="Anomalie ou suggestion"
            onClick={() => setScreen("signaler")}
          />
        </ProfilSection>

        <button
          onClick={() => logout()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-100 transition"
        >
          <LogOut className="h-4 w-4" /> Déconnexion
        </button>
      </div>
    </div>
  );
}

function ProfilSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold px-1 mb-2">
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function MenuRow({
  icon: Icon,
  wrap,
  color,
  label,
  sub,
  value,
  badge,
  onClick,
}: {
  icon: any;
  wrap: string;
  color: string;
  label: string;
  sub?: string;
  value?: string;
  badge?: number;
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 shadow-sm ${onClick ? "active:scale-[0.98] transition" : ""}`}
    >
      <div
        className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${wrap}`}
      >
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-navy">{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</div>}
      </div>
      {value && <span className="text-xs font-medium text-slate-500 shrink-0">{value}</span>}
      {badge != null && badge > 0 && (
        <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {badge}
        </span>
      )}
      {onClick && <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />}
    </Comp>
  );
}

// ═══════════════ Contenus d'écrans (partagés desktop / mobile) ═══════════════
function InfoLigne({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
      <div className="h-10 w-10 rounded-xl bg-slate-500/10 border border-slate-200 grid place-items-center shrink-0">
        <Icon className="h-5 w-5 text-slate-600" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-sm font-medium text-navy mt-0.5 break-all">{value || "—"}</div>
      </div>
    </div>
  );
}

function InfosContent({ profile }: any) {
  return (
    <div className="space-y-2.5">
      <InfoLigne icon={UserIcon} label="Nom complet" value={profile?.nom} />
      <InfoLigne icon={Mail} label="Email" value={profile?.email} />
      <InfoLigne icon={Phone} label="Téléphone" value={profile?.telephone} />
      <InfoLigne icon={Shield} label="Rôle" value="Responsable d'Action" />
      {profile?.qualite && <InfoLigne icon={UserIcon} label="Qualité" value={profile.qualite} />}
    </div>
  );
}

function ToggleLigne({
  label,
  sub,
  defaut = true,
}: {
  label: string;
  sub?: string;
  defaut?: boolean;
}) {
  const [on, setOn] = useState(defaut);
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-navy">{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className={`h-6 w-11 rounded-full transition relative shrink-0 ${on ? "bg-emerald-500" : "bg-slate-300"}`}
        aria-pressed={on}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

function NotificationsContent() {
  return (
    <div className="space-y-2.5">
      <ToggleLigne label="Nouvelle action assignée" sub="Quand le Conseil vous confie une action" />
      <ToggleLigne label="Rappel d'échéance" sub="À l'approche de la date limite" />
      <ToggleLigne label="Réponse à un commentaire" sub="Quand le Secrétariat vous répond" />
      <ToggleLigne label="Résumé hebdomadaire" sub="Un récapitulatif chaque lundi" defaut={false} />
    </div>
  );
}

function StatutLigne({
  icon: Icon,
  label,
  sub,
  statut,
}: {
  icon: any;
  label: string;
  sub?: string;
  statut: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
      <div className="h-10 w-10 rounded-xl bg-navy/10 border border-navy/20 grid place-items-center shrink-0">
        <Icon className="h-5 w-5 text-navy" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-navy">{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
        {statut}
      </span>
    </div>
  );
}

function SecuriteContent() {
  return (
    <div className="space-y-2.5">
      <StatutLigne
        icon={Shield}
        label="Authentification à deux facteurs"
        sub="Code à usage unique à la connexion"
        statut="Activée"
      />
      <StatutLigne
        icon={Fingerprint}
        label="Déverrouillage biométrique"
        sub="Empreinte ou reconnaissance faciale"
        statut="Activée"
      />
      <button
        onClick={() =>
          toast("Mot de passe", {
            description: "Le changement de mot de passe sera bientôt disponible.",
          })
        }
        className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 shadow-sm active:scale-[0.98] transition"
      >
        <div className="h-10 w-10 rounded-xl bg-navy/10 border border-navy/20 grid place-items-center shrink-0">
          <Shield className="h-5 w-5 text-navy" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-navy">Changer mon mot de passe</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Mettre à jour vos identifiants</div>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
      </button>
    </div>
  );
}

function AideContent() {
  const faq = [
    {
      q: "Comment mettre à jour une action ?",
      r: "Ouvrez l'action, cliquez « Rédiger un rapport », décrivez l'avancement, choisissez le pourcentage et joignez une pièce si besoin. Le rapport est transmis au Secrétariat et au Conseil.",
    },
    {
      q: "Que se passe-t-il à 100 % ?",
      r: "L'action passe « à confirmer » : c'est le Secrétariat qui valide la clôture définitive. Vous êtes notifié une fois confirmée.",
    },
    {
      q: "Qui me confie mes actions ?",
      r: "Les actions naissent des délibérations du Conseil ; le Secrétariat vous les assigne avec une échéance.",
    },
    {
      q: "Comment ajouter un commentaire ?",
      r: "Sur chaque action, ouvrez « Détails » (desktop) ou « Mettre à jour » (mobile) pour écrire un suivi.",
    },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-navy text-white p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center shrink-0">
          <LifeBuoy className="h-5 w-5 text-gold" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm">Secrétariat du Conseil</div>
          <div className="text-[12px] text-white/70">support@bnetd.ci · +225 27 22 48 30 00</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {faq.map((f, i) => (
          <div key={i} className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
            <div className="font-semibold text-sm text-navy">{f.q}</div>
            <div className="text-[12px] text-slate-500 mt-1 leading-relaxed">{f.r}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalerForm({
  onSignaler,
  actions,
}: {
  onSignaler: (input: {
    categorie: SignalementCategorie;
    sujet: string;
    description: string;
    actionId?: string | null;
  }) => Promise<void>;
  actions: Action[];
}) {
  const [cat, setCat] = useState<SignalementCategorie>("anomalie");
  const [actionId, setActionId] = useState<string>("");
  const [sujet, setSujet] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const envoyer = async () => {
    if (!sujet.trim() || !desc.trim()) return toast.error("Renseignez le sujet et la description");
    setBusy(true);
    try {
      await onSignaler({ categorie: cat, sujet, description: desc, actionId: actionId || null });
      toast.success("Problème signalé", {
        description: "La Secrétaire et les membres du CA en ont été informés.",
      });
      setSujet("");
      setDesc("");
      setActionId("");
      setCat("anomalie");
    } catch (err: any) {
      toast.error("Envoi impossible", { description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-navy mb-2">Action concernée</div>
        <select
          value={actionId}
          onChange={(e) => setActionId(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
        >
          <option value="">Aucune (problème général)</option>
          {actions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.titre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="text-xs font-semibold text-navy mb-2">Catégorie</div>
        <div className="flex flex-wrap gap-2">
          {SIGNALEMENT_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                cat === c.key ? "bg-navy text-white" : "bg-muted/60 text-slate-500 hover:text-navy"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-navy mb-2">Sujet</div>
        <input
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          placeholder="Ex. impossible de valider une action"
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
        />
      </div>
      <div>
        <div className="text-xs font-semibold text-navy mb-2">Description</div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={4}
          placeholder="Décrivez ce qui s'est passé, l'écran concerné, le moment…"
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold resize-none"
        />
      </div>
      <button
        onClick={envoyer}
        disabled={busy || !sujet.trim() || !desc.trim()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-navy py-3 text-sm font-semibold text-white hover:brightness-125 transition disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
        le signalement
      </button>
    </div>
  );
}
