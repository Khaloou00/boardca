import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SuperAdminLayout, ADMIN_SECTIONS, type AdminSection } from "@/components/super-admin/layout";
import { useSectionPersistante } from "@/lib/use-section-persistante";
import { AdminDashboard } from "@/components/super-admin/dashboard";
import { UsersPanel } from "@/components/super-admin/users-panel";
import { CommitteesPanel } from "@/components/super-admin/committees-panel";
import { PermissionsPanel } from "@/components/super-admin/permissions-panel";
import { AuditPanel } from "@/components/super-admin/audit-panel";
import { SettingsPanel } from "@/components/super-admin/settings-panel";
import { ArchivesPanel } from "@/components/super-admin/archives-view";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { ROLE_LABELS } from "@/lib/role-labels";
import { ShieldAlert, Loader2, LogIn } from "lucide-react";

export const Route = createFileRoute("/super-admin")({
  ssr: false,
  component: SuperAdminPage,
  head: () => ({ meta: [{ title: "Super Administration — BoardCA" }] }),
});

// Garde d'accès : les écrans Super Admin appellent des RPC et une edge function
// réservées au super_admin. Sans ce garde, un autre rôle voyait les pages mais
// toutes les actions échouaient en 403 / renvoyaient des listes vides (RLS), ce
// qui donnait l'illusion de bugs (« création échoue », « journal vide »).
function SuperAdminPage() {
  const { profile, authReady } = useBoardStore(
    useShallow((s) => ({ profile: s.profile, authReady: s.authReady })),
  );
  const navigate = useNavigate();

  // Tant que la session n'a pas été résolue une première fois, on n'affiche NI le
  // contenu NI le refus (sinon flash d'« accès refusé » pour un vrai super_admin).
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.role !== "super_admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-navy mt-4">
            Espace réservé au Super Administrateur
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {profile
              ? `Vous êtes connecté en tant que ${ROLE_LABELS[profile.role].label}. La création de comptes, le journal d'audit et les réglages de sécurité exigent le compte Super Administrateur.`
              : "Vous n'êtes pas connecté. Identifiez-vous avec le compte Super Administrateur pour accéder à cet espace."}
          </p>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy text-white font-semibold py-3 hover:bg-navy-light transition"
          >
            <LogIn className="h-5 w-5" /> Se connecter en Super Administrateur
          </button>
        </div>
      </div>
    );
  }

  return <SuperAdminContent />;
}

function SuperAdminContent() {
  // Onglet conservé au rafraîchissement — même dispositif que l'espace Secrétariat.
  const [section, setSection] = useSectionPersistante<AdminSection>(
    "sa-section",
    ADMIN_SECTIONS,
    "dashboard",
  );
  return (
    <SuperAdminLayout section={section} setSection={setSection}>
      {section === "dashboard" && <AdminDashboard onNav={setSection} />}
      {section === "users" && <UsersPanel />}
      {section === "committees" && <CommitteesPanel />}
      {section === "permissions" && <PermissionsPanel />}
      {section === "audit" && <AuditPanel />}
      {section === "archives" && <ArchivesPanel />}
      {section === "settings" && <SettingsPanel />}
    </SuperAdminLayout>
  );
}
