import { useEffect, useState, type ReactNode } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import {
  LayoutDashboard,
  Users,
  Building2,
  KeyRound,
  ScrollText,
  Settings,
  Archive,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

// Liste runtime ET type dérivés l'un de l'autre — voir le même dispositif dans
// `secretary/layout.tsx` (validation de la section restaurée au rafraîchissement).
export const ADMIN_SECTIONS = [
  "dashboard",
  "users",
  "committees",
  "permissions",
  "audit",
  "settings",
  "archives",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

const NAV: {
  key: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}[] = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, group: "Vue d'ensemble" },
  { key: "users", label: "Utilisateurs", icon: Users, group: "Gouvernance" },
  { key: "committees", label: "Comités", icon: Building2, group: "Gouvernance" },
  { key: "permissions", label: "Rôles & Permissions", icon: KeyRound, group: "Gouvernance" },
  { key: "audit", label: "Journal d'audit", icon: ScrollText, group: "Conformité" },
  // Archives : une seule entrée — la SÉANCE. Son PV, son émargement, ses scrutins,
  // ses convocations et ses actions se lisent À L'INTÉRIEUR d'elle, plus dans sept
  // écrans séparés qu'il fallait recroiser à la main.
  { key: "archives", label: "Archives", icon: Archive, group: "Conformité" },
  { key: "settings", label: "Paramètres sécurité", icon: Settings, group: "Conformité" },
];

export function SuperAdminLayout({
  section,
  setSection,
  children,
}: {
  section: AdminSection;
  setSection: (s: AdminSection) => void;
  children: ReactNode;
}) {
  // Identité réelle de la session Supabase (l'ancien contexte mémoire affichait
  // une persona figée, sans lien avec le compte réellement authentifié).
  const profile = useBoardStore((s) => s.profile);
  const groups = Array.from(new Set(NAV.map((n) => n.group)));
  // Repli de la barre latérale, mémorisé d'une session à l'autre.
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("sa-nav-collapsed") === "1",
  );
  useEffect(() => {
    localStorage.setItem("sa-nav-collapsed", collapsed ? "1" : "0");
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
                <div className="text-[12px] uppercase tracking-widest text-red-400">
                  Super Administration
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
          aria-label="Navigation Super Administration"
        >
          {groups.map((g) => (
            <div key={g}>
              {!collapsed && (
                <div
                  className="px-3 text-[13px] uppercase tracking-widest text-navy-foreground/50 mb-2 font-semibold"
                  id={`sagrp-${g}`}
                >
                  {g}
                </div>
              )}
              <ul className="space-y-1.5" aria-labelledby={`sagrp-${g}`}>
                {NAV.filter((n) => n.group === g).map((n) => {
                  const active = section === n.key;
                  return (
                    <li key={n.key}>
                      <button
                        onClick={() => setSection(n.key)}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? n.label : undefined}
                        className={`w-full flex items-center gap-3 rounded-xl text-[17px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-navy ${collapsed ? "justify-center px-0 py-3" : "px-3 py-2.5"} ${active ? "bg-gold text-gold-foreground font-semibold" : "text-navy-foreground/80 hover:bg-white/5"}`}
                      >
                        <n.icon className="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
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
          <div className="h-10 w-10 rounded-full bg-red-500 text-white flex items-center justify-center font-semibold text-sm shrink-0">
            {profile?.initiales ?? "?"}
          </div>
          {!collapsed && (
            <div className="text-[15px] min-w-0">
              <div className="font-semibold truncate">{profile?.nom ?? "—"}</div>
              <div className="text-navy-foreground/60">Super Administrateur</div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-8 pb-32">{children}</div>
      </main>
    </div>
  );
}
