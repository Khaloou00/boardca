import { useEffect, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";
import type { User } from "@/types/domain";
import type { UserRole } from "@/types/domain";
import { ROLE_LABELS } from "@/lib/role-labels";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  Pencil,
  Trash2,
  ShieldOff,
  ShieldCheck,
  Crown,
  AlertTriangle,
  Download,
  FileText,
} from "lucide-react";
import { KpiTiles } from "./kpi-tiles";
import { exporterCsv, exporterPdf, type TableauExport } from "@/lib/archive-export";

const STATUT_LABEL: Record<string, string> = {
  actif: "Actif",
  suspendu: "Suspendu",
  inactif: "Inactif",
};

export function UsersPanel() {
  const { users, comites, usersLoading } = useBoardStore(
    useShallow((s) => ({ users: s.users, comites: s.comites, usersLoading: s.usersLoading })),
  );
  const addUser = useBoardStore((s) => s.addUser);
  const updateUser = useBoardStore((s) => s.updateUser);
  const removeUser = useBoardStore((s) => s.removeUser);
  const setPresidentCA = useBoardStore((s) => s.setPresidentCA);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [detail, setDetail] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  const currentPCA = users.find((u) => u.estPresidentCA);

  // Garde-fou produit : un PV ne peut être scellé que si le PCA présent signe.
  // On alerte si des signatures ont déjà commencé sur un PV ouvert sans PCA désigné.
  const [unsealedPvs, setUnsealedPvs] = useState<{ id: string; reunionTitre: string }[]>([]);
  useEffect(() => {
    if (currentPCA) {
      setUnsealedPvs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: openPvs } = await supabase
        .from("pv")
        .select("id, reunion_id, reunions(titre)")
        .eq("statut", "en_signature")
        .returns<(Tables<"pv"> & { reunions: { titre: string } | null })[]>();
      if (!openPvs || openPvs.length === 0) {
        if (!cancelled) setUnsealedPvs([]);
        return;
      }
      const { data: sigs } = await supabase
        .from("signatures")
        .select("pv_id")
        .in(
          "pv_id",
          openPvs.map((p) => p.id),
        );
      const withSignatures = new Set((sigs ?? []).map((s) => s.pv_id));
      const flagged = openPvs
        .filter((p) => withSignatures.has(p.id))
        .map((p) => ({ id: p.id, reunionTitre: p.reunions?.titre ?? "Réunion" }));
      if (!cancelled) setUnsealedPvs(flagged);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPCA]);

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (q && !`${u.nom} ${u.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const comiteNoms = (u: User) =>
    comites
      .filter((c) => u.comiteIds.includes(c.id))
      .map((c) => c.nom)
      .join(", ") || "—";

  const tuiles = [
    { label: "Comptes", valeur: users.length, ton: "navy" as const },
    {
      label: "Actifs",
      valeur: users.filter((u) => u.statut === "actif").length,
      ton: "emerald" as const,
    },
    {
      label: "Suspendus",
      valeur: users.filter((u) => u.statut !== "actif").length,
      ton: "rose" as const,
    },
    {
      label: "Administrateurs",
      valeur: users.filter((u) => u.role === "administrateur").length,
      hint: currentPCA ? `PCA : ${currentPCA.nom}` : "Aucun PCA désigné",
      ton: "gold" as const,
    },
  ];

  // Même définition de colonnes pour les deux exports : impossible qu'ils divergent.
  const tableau = (): TableauExport => ({
    titre: "Annuaire des comptes",
    sousTitre:
      q || roleFilter !== "all" ? `Filtré — ${filtered.length} compte(s)` : `${users.length} compte(s)`,
    entetes: ["Nom", "Email", "Rôle", "PCA", "Comité(s)", "Statut"],
    lignes: filtered.map((u) => [
      u.nom,
      u.email,
      ROLE_LABELS[u.role].label,
      u.estPresidentCA ? "Oui" : "",
      comiteNoms(u),
      STATUT_LABEL[u.statut] ?? u.statut,
    ]),
  });

  const toggleStatus = async (u: User) => {
    const next = u.statut === "actif" ? "suspendu" : "actif";
    setBusy(true);
    try {
      await updateUser(u.id, { statut: next });
      toast.success(`${u.nom} — ${next === "suspendu" ? "suspendu" : "réactivé"}`);
    } catch {
      toast.error("Échec de la mise à jour du statut");
    } finally {
      setBusy(false);
    }
  };

  const togglePCA = async (u: User) => {
    const transferFrom = currentPCA && currentPCA.id !== u.id ? currentPCA.nom : null;
    setBusy(true);
    try {
      await setPresidentCA(u.estPresidentCA ? null : u.id);
      if (u.estPresidentCA) {
        toast.success(`${u.nom} n'est plus PCA`);
      } else if (transferFrom) {
        toast.success(`Le titre de PCA est passé de ${transferFrom} à ${u.nom}`);
      } else {
        toast.success(`${u.nom} est désigné Président du Conseil d'Administration`);
      }
    } catch {
      toast.error("Échec de la désignation du PCA");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await removeUser(deleteTarget.id);
      toast.success(`${deleteTarget.nom} supprimé`);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error("Échec de la suppression", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">
            {users.length} comptes · {filtered.length} affichés
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-navy hover:bg-navy-light">
          <UserPlus className="h-4 w-4 mr-2" /> Nouvel utilisateur
        </Button>
      </div>

      <KpiTiles tuiles={tuiles} />

      <Card className="p-4">
        {currentPCA ? (
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-navy text-white flex items-center justify-center font-semibold shrink-0">
              {currentPCA.initiales}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-navy">{currentPCA.nom}</span>
                <Crown className="h-4 w-4 text-gold shrink-0" />
              </div>
              <div className="text-xs text-muted-foreground">
                Président du Conseil d'Administration — signe le PV final
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="font-medium text-foreground">Aucun PCA désigné</div>
              <div className="text-xs">
                Choisissez-en un parmi les administrateurs (icône couronne) avant l'ouverture des
                signatures d'un PV.
              </div>
            </div>
          </div>
        )}
      </Card>

      {unsealedPvs.length > 0 && (
        <div className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-gold shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-navy">
              Désignez un PCA avant l'ouverture des signatures.
            </span>{" "}
            <span className="text-muted-foreground">
              Signatures en cours sans PCA désigné : {unsealedPvs.map((p) => p.reunionTitre).join(", ")}.
              Le PV ne pourra pas être scellé tant qu'aucun PCA n'est nommé.
            </span>
          </div>
        </div>
      )}

      <Card className="p-4 flex gap-3">
        <div className="flex-1 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | "all")}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => exporterCsv(tableau())} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
        <Button variant="outline" onClick={() => exporterPdf(tableau())} disabled={filtered.length === 0}>
          <FileText className="h-4 w-4 mr-2" /> PDF
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Utilisateur</th>
              <th className="text-left px-4 py-3">Rôle</th>
              <th className="text-left px-4 py-3">Comité</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                onClick={() => setDetail(u)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setDetail(u)}
                className="border-t border-border/60 hover:bg-gold/5 focus:bg-gold/5 focus:outline-none cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-navy text-white flex items-center justify-center font-semibold text-xs">
                      {u.initiales}
                    </div>
                    <div>
                      <div className="font-medium text-navy">{u.nom}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary">{ROLE_LABELS[u.role].short}</Badge>
                    {u.estPresidentCA && (
                      <Badge className="bg-gold text-gold-foreground hover:bg-gold">
                        <Crown className="h-3 w-3 mr-1" /> PCA
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{comiteNoms(u)}</td>
                <td className="px-4 py-3">
                  {u.statut === "actif" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" /> Actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                      <ShieldOff className="h-3.5 w-3.5" /> {u.statut === "suspendu" ? "Suspendu" : "Inactif"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex gap-1">
                    {u.role === "administrateur" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => togglePCA(u)}
                        title={u.estPresidentCA ? "Retirer le titre de PCA" : "Désigner comme PCA"}
                      >
                        <Crown className={`h-4 w-4 ${u.estPresidentCA ? "text-gold" : ""}`} />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggleStatus(u)}>
                      {u.statut === "actif" ? (
                        <ShieldOff className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(u)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  {usersLoading ? "Chargement…" : "Aucun utilisateur."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <UserDialog
        open={creating || !!editing}
        user={editing}
        busy={busy}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={async (data) => {
          // Contrôle immédiat AVANT l'appel serveur : la cause n°1 d'un 400 est un
          // email déjà pris. On le dit tout de suite plutôt que via un aller-retour.
          if (!editing) {
            const email = (data.email ?? "").trim().toLowerCase();
            if (users.some((u) => u.email.toLowerCase() === email)) {
              toast.error("Un compte existe déjà avec cet email.", {
                description: "Choisissez une autre adresse.",
              });
              return;
            }
          }
          setBusy(true);
          try {
            if (editing) {
              await updateUser(editing.id, {
                nom: data.nom,
                telephone: data.telephone,
                qualite: data.qualite,
                role: data.role,
              });
              toast.success("Utilisateur mis à jour");
            } else {
              const { emailSent, emailError, lien } = await addUser({
                nom: data.nom!.trim(),
                email: data.email!.trim().toLowerCase(),
                role: data.role!,
                telephone: data.telephone?.trim() || undefined,
                qualite: data.qualite?.trim() || undefined,
              });
              if (emailSent) {
                toast.success("Compte créé", {
                  description: "Un email d'activation a été envoyé : le membre y créera son mot de passe personnel.",
                });
              } else {
                toast.warning("Compte créé, email non envoyé", {
                  description: emailError ?? "Communiquez le lien d'activation manuellement.",
                  action: lien
                    ? {
                        label: "Copier le lien",
                        onClick: () => {
                          navigator.clipboard.writeText(lien);
                          toast.success("Lien copié");
                        },
                      }
                    : undefined,
                });
              }
            }
            setCreating(false);
            setEditing(null);
          } catch (e: any) {
            toast.error(editing ? "Échec de la mise à jour" : "Échec de la création du compte", {
              description: e?.message,
            });
          } finally {
            setBusy(false);
          }
        }}
      />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <span className="h-11 w-11 rounded-full bg-navy text-white flex items-center justify-center font-semibold text-sm shrink-0">
                    {detail.initiales}
                  </span>
                  <span className="text-navy">{detail.nom}</span>
                  {detail.estPresidentCA && <Crown className="h-5 w-5 text-gold" />}
                </DialogTitle>
              </DialogHeader>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-1">
                <Champ label="Email" pleineLargeur value={detail.email} />
                <Champ label="Rôle" value={ROLE_LABELS[detail.role].label} />
                <Champ label="Statut" value={STATUT_LABEL[detail.statut] ?? detail.statut} />
                <Champ label="Téléphone" value={detail.telephone || "—"} />
                <Champ label="Qualité" value={detail.qualite || "—"} />
                <Champ label="Comité(s)" pleineLargeur value={comiteNoms(detail)} />
                <Champ
                  label="Président du Conseil"
                  value={detail.estPresidentCA ? "Oui — signe le PV final" : "Non"}
                />
              </div>
              <DialogFooter className="mt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDetail(null);
                    setEditing(detail);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" /> Modifier
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteTarget?.nom} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprime définitivement le compte (authentification incluse) et le
              retire de ses comités, réunions et présences. Elle est irréversible.
              <br />
              <br />
              Si ce compte a un historique (réunion créée, procuration, action, message…), la
              suppression sera refusée pour préserver la traçabilité — suspendez-le plutôt (icône
              bouclier dans le tableau).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Champ({
  label,
  value,
  pleineLargeur,
}: {
  label: string;
  value: string;
  pleineLargeur?: boolean;
}) {
  return (
    <div className={pleineLargeur ? "sm:col-span-2" : undefined}>
      <div className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="mt-1 text-[17px] text-navy break-words">{value}</div>
    </div>
  );
}

function UserDialog({
  open,
  user,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  user: User | null;
  busy: boolean;
  onClose: () => void;
  onSave: (u: Partial<User>) => void;
}) {
  const [form, setForm] = useState<Partial<User>>({});
  const current = { nom: "", email: "", role: "administrateur" as UserRole, ...user, ...form };
  const reset = () => {
    setForm({});
  };
  // Supabase rejette (« invalid format ») tout email non standard : espace, domaine
  // incomplet, accent… On valide AVANT l'envoi pour un retour immédiat.
  const emailBrut = (current.email ?? "").trim();
  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailBrut);
  const emailInvalide = !user && emailBrut.length > 0 && !emailValide;
  const peutEnregistrer = !!current.nom && (!!user || emailValide);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nom complet</Label>
            <Input
              value={current.nom ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={current.email ?? ""}
              disabled={!!user}
              placeholder="prenom.nom@domaine.com"
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            {emailInvalide && (
              <div className="text-[13px] text-red-600 mt-1">
                Format d'email invalide. Sans espace, avec un domaine complet (ex.
                jean.kouassi@bnetd.ci).
              </div>
            )}
          </div>
          <div>
            <Label>Rôle</Label>
            <Select
              value={current.role}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Téléphone (optionnel)</Label>
            <Input
              value={current.telephone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
            />
          </div>
          <div>
            <Label>Qualité (optionnel)</Label>
            <Input
              value={current.qualite ?? ""}
              placeholder="ex. Représentant du Ministère des Finances"
              onChange={(e) => setForm((f) => ({ ...f, qualite: e.target.value }))}
            />
          </div>
          {!user && (
            <div className="text-[13px] text-muted-foreground">
              Un email d'activation sera envoyé à cette adresse : le membre y créera lui-même
              son mot de passe personnel.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Annuler
          </Button>
          <Button
            className="bg-navy hover:bg-navy-light"
            onClick={() => {
              onSave(current);
              reset();
            }}
            disabled={busy || !peutEnregistrer}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
