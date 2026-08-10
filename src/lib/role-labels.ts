import type { UserRole } from "@/types/domain";
import type { Role } from "@/lib/app-store";

// Libellés d'affichage des rôles réels (profiles.role), partagés entre les
// pages une fois branchées sur useBoardStore. Distinct de l'ancien ROLE_META
// (src/lib/app-store.tsx) qui reste utilisé par les pages pas encore migrées.
export const ROLE_LABELS: Record<UserRole, { label: string; short: string }> = {
  super_admin: { label: "Super Administrateur", short: "Super Admin" },
  secretaire: { label: "Secrétaire du CA", short: "Secrétaire" },
  administrateur: { label: "Membre du CA", short: "Membre du CA" },
  responsable_action: { label: "Responsable d'Action", short: "Resp. Action" },
  invite: { label: "Invité (mandataire)", short: "Invité" },
};

// Pont temporaire : tant que certaines pages ne sont pas migrées sur
// useBoardStore, elles lisent encore l'ancien contexte mémoire (useApp) dont
// les rôles ont des clés différentes. Source unique — utilisée par `auth.tsx`
// (à la connexion) et `role-switcher.tsx` (badge indépendant du pont legacy).
// `invite` réutilise le seau "admin" existant plutôt que d'ajouter une 5e
// valeur à `Role` (app-store.tsx) : le pont ne sert qu'aux pages non migrées,
// jamais consulté pour les droits réels (RLS) d'un invité.
export const NEW_TO_OLD_ROLE: Record<UserRole, Role> = {
  super_admin: "super_admin",
  secretaire: "secretary",
  administrateur: "admin",
  responsable_action: "action_manager",
  invite: "admin",
};
