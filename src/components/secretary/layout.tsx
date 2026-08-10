import { useEffect, useState, type ReactNode } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarDays,
  Send,
  QrCode,
  Vote,
  ClipboardList,
  ListChecks,
  MailCheck,
  BookOpen,
  Coins,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ROLE_LABELS } from "@/lib/role-labels";
import { ShieldAlert } from "lucide-react";

// Liste runtime ET type dérivés l'un de l'autre : la validation de la section
// restaurée au rafraîchissement (voir `useSectionPersistante`) a besoin des
// clés à l'exécution, et cette forme interdit qu'elles divergent du type.
export const SECTION_KEYS = [
  "dashboard",
  "gouvernance",
  "calendrier",
  "create",
  "boardbook",
  "convocations",
  "consultation",
  "invites",
  "attendance",
  "vote",
  "pv",
  "actions",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

const NAV: {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}[] = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, group: "Général" },
  { key: "gouvernance", label: "Gestion des jetons", icon: Coins, group: "Général" },
  { key: "calendrier", label: "Mon Calendrier", icon: CalendarDays, group: "Préparation" },
  { key: "create", label: "Créer une réunion", icon: CalendarPlus, group: "Préparation" },
  { key: "boardbook", label: "Board Book", icon: BookOpen, group: "Préparation" },
  { key: "convocations", label: "Convocations", icon: Send, group: "Préparation" },
  { key: "attendance", label: "Émargement & Quorum", icon: QrCode, group: "Séance" },
  { key: "vote", label: "Votes électroniques", icon: Vote, group: "Séance" },
  { key: "consultation", label: "Consultation écrite", icon: MailCheck, group: "Hors séance" },
  { key: "invites", label: "Invités", icon: UserCheck, group: "Hors séance" },
  { key: "pv", label: "Procès-verbal", icon: ClipboardList, group: "Après séance" },
  { key: "actions", label: "Actions & Suivi", icon: ListChecks, group: "Après séance" },
];

export function SecretaryLayout({
  section,
  setSection,
  children,
}: {
  section: SectionKey;
  setSection: (s: SectionKey) => void;
  children: ReactNode;
}) {
  // Identité réelle de la session Supabase (l'ancien contexte affichait une persona figée).
  const profile = useBoardStore((s) => s.profile);
  const groups = Array.from(new Set(NAV.map((n) => n.group)));
  // Mêmes habilitations que le garde serveur de `get_reunion_stats` / `get_jetons_kpis` :
  // secrétaire, super_admin, ou le PCA titulaire.
  const habilite =
    profile?.role === "secretaire" || profile?.role === "super_admin" || !!profile?.estPresidentCA;
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("sec-nav-collapsed") === "1",
  );
  useEffect(() => {
    localStorage.setItem("sec-nav-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className="min-h-screen flex bg-muted/30">
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
                <div className="font-bold text-[17px]">BoardCA</div>
                <div className="text-[12px] uppercase tracking-widest text-gold">
                  Secrétariat CA
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
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
          aria-label="Navigation Secrétariat"
        >
          {groups.map((g) => (
            <div key={g}>
              {!collapsed && (
                <div
                  className="px-3 text-[13px] uppercase tracking-widest text-navy-foreground/50 mb-2 font-semibold"
                  id={`grp-${g}`}
                >
                  {g}
                </div>
              )}
              <ul className="space-y-1.5" aria-labelledby={`grp-${g}`}>
                {NAV.filter((n) => n.group === g).map((n) => {
                  const active = section === n.key;
                  return (
                    <li key={n.key}>
                      <button
                        onClick={() => setSection(n.key)}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? n.label : undefined}
                        className={`w-full flex items-center gap-3 rounded-xl text-[17px] transition-all duration-150 border-l-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy ${collapsed ? "justify-center px-0 py-3" : "pl-3 pr-3 py-2.5"} ${active ? "bg-[rgba(201,168,76,0.12)] text-white font-semibold border-gold" : "text-white/85 hover:bg-white/[0.06] border-transparent"}`}
                      >
                        <n.icon
                          className={`h-[22px] w-[22px] shrink-0 ${active ? "text-gold" : "text-white/60"}`}
                          aria-hidden="true"
                        />
                        {!collapsed && <span>{n.label}</span>}
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
            {profile?.initiales ?? "?"}
          </div>
          {!collapsed && (
            <div className="text-[15px] min-w-0">
              <div className="font-semibold truncate">{profile?.nom ?? "—"}</div>
              {/* Le rôle RÉEL du compte connecté : l'afficher en dur mentait dès
                  qu'un autre profil ouvrait cet espace, et rendait incompréhensible
                  le refus des RPC réservées au secrétariat. */}
              <div className="text-navy-foreground/60">
                {profile ? ROLE_LABELS[profile.role].label : "—"}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-8 pb-32">
          {profile && !habilite && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[15px] text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">
                  Vous consultez l'espace Secrétariat en tant que {ROLE_LABELS[profile.role].label}.
                </span>{" "}
                Les données réservées au secrétariat (statistiques de séance, jetons) resteront
                inaccessibles : le serveur les refuse à ce rôle. Connectez-vous avec le compte de la
                Secrétaire pour les voir.
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
