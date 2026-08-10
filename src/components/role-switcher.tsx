import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useApp, ROLE_META, type Role } from "@/lib/app-store";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabase";
import { ROLE_LABELS, NEW_TO_OLD_ROLE } from "@/lib/role-labels";
import { toast } from "sonner";
import { Users, ChevronUp, LogOut, Crown, Loader2 } from "lucide-react";

// Mot de passe commun de démo à tous les comptes seedés. Ce switcher est un outil
// de démo ("accès instantané") : les 4 rôles basculent juste l'ancien contexte
// mémoire, mais le PCA doit être une vraie session Supabase (son statut vient de
// profile.estPresidentCA). Le titulaire du PCA peut changer (Super Admin, etc.) :
// on résout donc le compte PCA courant EN BASE au moment du clic, jamais en dur.
const DEMO_PASSWORD = "0101010101";

// Compte Supabase réel derrière chaque rôle de démo (doit rester synchro avec
// SEED_EMAIL dans auth.tsx). `action_manager` n'a pas de compte seed → résolu en
// base au clic (comme le PCA).
const SEED_EMAIL: Record<Role, string> = {
  super_admin: "admin@timutech.com",
  secretary: "fofanaaicha@gmail.com",
  admin: "cisseibrahimkhalilou@gmail.com",
  action_manager: "",
};

export function RoleSwitcher() {
  const { setRole, logout: legacyLogout } = useApp();
  const storeLogin = useBoardStore((s) => s.login);
  const storeLogout = useBoardStore((s) => s.logout);
  // Source de vérité = la vraie session Supabase (persistée, restaurée par
  // useBootstrap à chaque chargement), PAS le pont `useApp().authed` : celui-ci
  // vit en mémoire pure et retombe à `false` à chaque rechargement de page,
  // ce qui faisait disparaître le badge alors que l'utilisateur restait connecté.
  const { profile, authReady } = useBoardStore(
    useShallow((s) => ({ profile: s.profile, authReady: s.authReady })),
  );
  const isRealPCA = !!profile?.estPresidentCA;
  const [open, setOpen] = useState(false);
  const [switchingToPCA, setSwitchingToPCA] = useState(false);
  const [switchingRole, setSwitchingRole] = useState<Role | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!authReady || !profile || pathname === "/" || pathname.startsWith("/auth")) return null;

  // Rôle réel projeté dans l'ancien système de clés (pour comparer avec les
  // boutons de bascule ci-dessous, qui restent définis sur les 4 rôles legacy).
  const realRole = NEW_TO_OLD_ROLE[profile.role];

  // Bascule de profil = VRAIE re-connexion Supabase. Sans elle, seul l'ancien
  // contexte mémoire changeait de rôle tandis que `auth.uid()` restait le compte
  // précédent → toute écriture RLS (ex. créer une réunion) renvoyait 403.
  const switchTo = async (r: Role) => {
    if (switchingRole) return;
    let email = SEED_EMAIL[r];
    if (!email) {
      // Rôle sans compte seed (responsable d'action) : on en résout un en base.
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("role", "responsable_action")
        .limit(1)
        .maybeSingle();
      email = data?.email ?? "";
    }
    if (!email) {
      toast.error("Aucun compte pour ce rôle", {
        description: "Créez-le depuis Super Admin · Utilisateurs.",
      });
      return;
    }
    setSwitchingRole(r);
    try {
      await storeLogin(email, DEMO_PASSWORD); // vraie session → RLS correcte
      setRole(r); // pont vers l'ancien contexte pour les pages pas encore migrées
      setOpen(false);
      navigate({ to: ROLE_META[r].path });
    } catch {
      toast.error("Échec du changement de profil");
    } finally {
      setSwitchingRole(null);
    }
  };

  const switchToPCA = async () => {
    setSwitchingToPCA(true);
    try {
      // Titulaire courant du PCA (peut changer via Super Admin · Utilisateurs).
      const { data } = await supabase
        .from("profiles")
        .select("email, nom")
        .eq("est_president_ca", true)
        .maybeSingle();
      if (!data?.email) {
        toast.error("Aucun PCA désigné", {
          description: "Désignez-en un depuis Super Admin · Utilisateurs (icône couronne).",
        });
        return;
      }
      await storeLogin(data.email, DEMO_PASSWORD);
      setRole("admin"); // pont vers l'ancien contexte pour les pages pas encore migrées
      setOpen(false);
      navigate({ to: "/mobile" });
    } catch {
      toast.error("Échec de la connexion au profil PCA");
    } finally {
      setSwitchingToPCA(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-80 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2">
          <div className="p-2 space-y-1">
            {(Object.keys(ROLE_META) as Role[]).map((r) => {
              const meta = ROLE_META[r];
              const active = r === realRole;
              return (
                <button
                  key={r}
                  onClick={() => switchTo(r)}
                  disabled={!!switchingRole}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition flex items-center gap-3 disabled:opacity-60 ${active ? "bg-navy text-navy-foreground" : "hover:bg-muted"}`}
                >
                  <div
                    className={`h-9 w-9 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center text-white font-semibold text-sm`}
                  >
                    {switchingRole === r ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      meta.short.slice(0, 2)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{meta.label}</div>
                    <div
                      className={`text-xs truncate ${active ? "text-navy-foreground/70" : "text-muted-foreground"}`}
                    >
                      {meta.description}
                    </div>
                  </div>
                  {active && <div className="h-2 w-2 rounded-full bg-gold" />}
                </button>
              );
            })}
            <button
              onClick={switchToPCA}
              disabled={switchingToPCA}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition flex items-center gap-3 disabled:opacity-60 ${isRealPCA ? "bg-navy text-navy-foreground" : "hover:bg-muted"}`}
            >
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-gold to-yellow-600 flex items-center justify-center text-white font-semibold text-sm">
                {switchingToPCA ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">PCA — Président du Conseil</div>
                <div
                  className={`text-xs truncate ${isRealPCA ? "text-navy-foreground/70" : "text-muted-foreground"}`}
                >
                  Discussions, présidence de séance, sceau du PV
                </div>
              </div>
              {isRealPCA && <div className="h-2 w-2 rounded-full bg-gold" />}
            </button>
          </div>
          <div className="border-t border-border p-2">
            <button
              onClick={async () => {
                // Les deux : la vraie session Supabase (sinon le badge, désormais
                // basé dessus, resterait affiché) et le pont legacy (pages non
                // migrées).
                await storeLogout();
                legacyLogout();
                navigate({ to: "/" });
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-destructive/10 text-destructive text-sm flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Se déconnecter
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-2 rounded-full bg-navy text-navy-foreground pl-2 pr-4 py-2 shadow-xl hover:shadow-2xl transition border border-gold/30"
      >
        <div className="h-8 w-8 rounded-full bg-gold text-gold-foreground flex items-center justify-center font-semibold text-sm">
          {profile.initiales}
        </div>
        <div className="text-left leading-tight">
          <div className="text-[10px] uppercase tracking-wider text-gold">Profil actif</div>
          <div className="text-xs font-semibold">
            {isRealPCA ? "PCA" : ROLE_LABELS[profile.role].short}
          </div>
        </div>
        <ChevronUp className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}
