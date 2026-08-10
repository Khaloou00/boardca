import { useState } from "react";
import { ROLE_META, type Role } from "@/lib/app-store";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

const PERMS = [
  { key: "meetings.create", label: "Créer des réunions" },
  { key: "meetings.edit", label: "Modifier l'ordre du jour" },
  { key: "documents.upload", label: "Téléverser des documents" },
  { key: "boardbook.generate", label: "Générer un Board Book" },
  { key: "convocations.send", label: "Envoyer des convocations" },
  { key: "vote.open", label: "Ouvrir un scrutin" },
  { key: "vote.cast", label: "Voter" },
  { key: "pv.draft", label: "Rédiger le PV" },
  { key: "pv.sign", label: "Signer le PV" },
  { key: "users.manage", label: "Gérer les utilisateurs" },
  { key: "audit.read", label: "Consulter le journal d'audit" },
  { key: "actions.update", label: "Mettre à jour les actions" },
];

const DEFAULT: Record<Role, Record<string, boolean>> = {
  super_admin: Object.fromEntries(PERMS.map((p) => [p.key, true])),
  secretary: {
    "meetings.create": true,
    "meetings.edit": true,
    "documents.upload": true,
    "boardbook.generate": true,
    "convocations.send": true,
    "vote.open": true,
    "vote.cast": false,
    "pv.draft": true,
    "pv.sign": false,
    "users.manage": false,
    "audit.read": true,
    "actions.update": true,
  },
  admin: {
    "meetings.create": false,
    "meetings.edit": false,
    "documents.upload": false,
    "boardbook.generate": false,
    "convocations.send": false,
    "vote.open": false,
    "vote.cast": true,
    "pv.draft": false,
    "pv.sign": true,
    "users.manage": false,
    "audit.read": false,
    "actions.update": false,
  },
  action_manager: {
    "meetings.create": false,
    "meetings.edit": false,
    "documents.upload": false,
    "boardbook.generate": false,
    "convocations.send": false,
    "vote.open": false,
    "vote.cast": false,
    "pv.draft": false,
    "pv.sign": false,
    "users.manage": false,
    "audit.read": false,
    "actions.update": true,
  },
};

export function PermissionsPanel() {
  const [matrix, setMatrix] = useState(DEFAULT);

  const toggle = (role: Role, key: string) => {
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [key]: !m[role][key] } }));
    toast.success(
      `Permission ${matrix[role][key] ? "retirée" : "accordée"} — ${ROLE_META[role].short}`,
    );
  };

  const roles = Object.keys(ROLE_META) as Role[];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-red-600 text-xs uppercase tracking-widest font-semibold mb-2">
          <KeyRound className="h-4 w-4" /> Matrice RBAC
        </div>
        <h1 className="text-3xl font-bold text-navy">Rôles & Permissions</h1>
        <p className="text-muted-foreground mt-1">
          Contrôlez finement ce que chaque profil peut faire sur la plateforme.
        </p>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Permission</th>
              {roles.map((r) => (
                <th key={r} className="text-center px-4 py-3">
                  {ROLE_META[r].short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMS.map((p) => (
              <tr key={p.key} className="border-t border-border/60 hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="font-medium text-navy">{p.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.key}</div>
                </td>
                {roles.map((r) => (
                  <td key={r} className="text-center px-4 py-3">
                    <Switch checked={matrix[r][p.key]} onCheckedChange={() => toggle(r, p.key)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
