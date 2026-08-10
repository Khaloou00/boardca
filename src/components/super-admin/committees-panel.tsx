import { useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Building2,
  Plus,
  Users,
  UserPlus,
  X,
  Crown,
  Trash2,
  Download,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { KpiTiles } from "./kpi-tiles";
import { exporterCsv, exporterPdf, type TableauExport } from "@/lib/archive-export";

export function CommitteesPanel() {
  const { comites, users } = useBoardStore(
    useShallow((s) => ({ comites: s.comites, users: s.users })),
  );
  const addComite = useBoardStore((s) => s.addComite);
  const updateComite = useBoardStore((s) => s.updateComite);
  const removeComite = useBoardStore((s) => s.removeComite);
  const addComiteMembre = useBoardStore((s) => s.addComiteMembre);
  const removeComiteMembre = useBoardStore((s) => s.removeComiteMembre);

  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(comites[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nom: string } | null>(null);

  const selected = comites.find((c) => c.id === selectedId) ?? null;
  const administrateurs = users.filter((u) => u.role === "administrateur");
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  const tuiles = [
    { label: "Comités", valeur: comites.length, ton: "navy" as const },
    {
      label: "Sièges pourvus",
      valeur: comites.reduce((s, c) => s + c.membreIds.length, 0),
      ton: "emerald" as const,
    },
    {
      label: "Comités présidés",
      valeur: comites.filter((c) => c.presidentId).length,
      ton: "gold" as const,
    },
    {
      label: "Sans membre",
      valeur: comites.filter((c) => c.membreIds.length === 0).length,
      ton: "rose" as const,
    },
  ];

  const tableau = (): TableauExport => ({
    titre: "Comités du Conseil",
    entetes: ["Comité", "Président", "Membres", "Composition"],
    lignes: comites.map((c) => [
      c.nom,
      c.presidentId ? (usersById[c.presidentId]?.nom ?? "—") : "—",
      String(c.membreIds.length),
      c.membreIds.map((id) => usersById[id]?.nom).filter(Boolean).join(", ") || "—",
    ]),
  });

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await addComite({ nom: name.trim() });
      setSelectedId(id);
      setName("");
      toast.success(`Comité "${name.trim()}" créé`);
    } catch {
      toast.error("Échec de la création du comité");
    } finally {
      setBusy(false);
    }
  };

  const toggleMembre = async (uid: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      if (selected.membreIds.includes(uid)) {
        await removeComiteMembre(selected.id, uid);
      } else {
        await addComiteMembre(selected.id, uid);
      }
    } catch {
      toast.error("Échec de la mise à jour des membres");
    } finally {
      setBusy(false);
    }
  };

  const setPresident = async (uid: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateComite(selected.id, { presidentId: uid === "none" ? undefined : uid });
      toast.success("Président du comité mis à jour");
    } catch {
      toast.error("Échec de la mise à jour du président");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await removeComite(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      toast.success(`Comité "${deleteTarget.nom}" supprimé`);
      setDeleteTarget(null);
    } catch {
      toast.error("Échec de la suppression du comité");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-navy">Comités</h1>
          <p className="text-muted-foreground mt-1">
            Structurez la gouvernance du CA par comités spécialisés.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exporterCsv(tableau())} disabled={comites.length === 0}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" onClick={() => exporterPdf(tableau())} disabled={comites.length === 0}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <KpiTiles tuiles={tuiles} />

      <div className="grid grid-cols-3 gap-6">
        <Card className="p-5 col-span-1">
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Nom du comité"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              disabled={busy}
            />
            <Button size="icon" className="bg-navy hover:bg-navy-light" onClick={create} disabled={busy}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {comites.map((c) => (
              <div
                key={c.id}
                className={`w-full rounded-lg border transition flex items-center ${selectedId === c.id ? "border-gold bg-gold/5" : "border-border hover:border-navy/30"}`}
              >
                <button onClick={() => setSelectedId(c.id)} className="flex-1 text-left p-3 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-navy shrink-0" />
                    <div className="font-medium text-navy flex-1 truncate">{c.nom}</div>
                    <Badge variant="secondary">{c.membreIds.length}</Badge>
                  </div>
                  {c.presidentId && usersById[c.presidentId] && (
                    <div className="text-[13px] text-muted-foreground mt-1 flex items-center gap-1 pl-6">
                      <Crown className="h-3 w-3 text-gold" /> {usersById[c.presidentId].nom}
                    </div>
                  )}
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: c.id, nom: c.nom })}
                  className="p-3 text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={`Supprimer ${c.nom}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {comites.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">Aucun comité.</div>
            )}
          </div>
        </Card>

        <Card className="p-5 col-span-2">
          {selected ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-navy" />
                <h2 className="font-semibold text-navy flex-1">Membres — {selected.nom}</h2>
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Président du comité
                </label>
                <Select value={selected.presidentId ?? "none"} onValueChange={setPresident}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Aucun président désigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {administrateurs.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {administrateurs.map((u) => {
                  const inC = selected.membreIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleMembre(u.id)}
                      disabled={busy}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition disabled:opacity-60 ${inC ? "bg-navy text-white border-navy" : "border-border hover:border-navy/30"}`}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${inC ? "bg-gold text-gold-foreground" : "bg-navy text-white"}`}
                      >
                        {u.initiales}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1">
                          {u.nom}
                          {u.id === selected.presidentId && <Crown className="h-3 w-3 text-gold shrink-0" />}
                        </div>
                        <div
                          className={`text-xs truncate ${inC ? "text-white/70" : "text-muted-foreground"}`}
                        >
                          {u.email}
                        </div>
                      </div>
                      {inC ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-16">Sélectionnez un comité.</div>
          )}
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deleteTarget?.nom} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action retire le comité et l'ensemble de ses affectations de membres. Les
              réunions déjà rattachées à ce comité ne seront pas supprimées. Irréversible.
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
