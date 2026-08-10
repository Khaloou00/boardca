import { useEffect, useMemo, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Download,
  Search,
  ScrollText,
  ShieldCheck,
  Loader2,
  FileText,
  ChevronRight,
} from "lucide-react";
import { KpiTiles } from "./kpi-tiles";
import { exporterCsv, exporterPdf, type TableauExport } from "@/lib/archive-export";
import type { AuditEntry } from "@/types/domain";

// Journal d'audit RÉEL (`audit_log`), alimenté par le RPC `log_event`. Table en
// ajout seul : la RLS n'expose qu'un SELECT réservé au super_admin, et aucune
// policy UPDATE/DELETE n'existe.
//
// Le hash SHA-256 scelle CHAQUE entrée (utilisateur + action + ressource +
// horodatage). Il n'est PAS chaîné à l'entrée précédente — l'ancien écran, qui
// affichait un « hash précédent » et une « chaîne intègre », le laissait croire.
export function AuditPanel() {
  const { auditLog, auditLoading, users, profile, fetchAuditLog } = useBoardStore(
    useShallow((s) => ({
      auditLog: s.auditLog,
      auditLoading: s.auditLoading,
      users: s.users,
      profile: s.profile,
      fetchAuditLog: s.fetchAuditLog,
    })),
  );

  // `fetchCoreData` ne charge pas le journal : il est réservé au super_admin.
  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [detail, setDetail] = useState<AuditEntry | null>(null);
  // La lecture d'`audit_log` est réservée au super_admin (RLS). Un autre rôle
  // obtient un résultat vide, pas une erreur — d'où ce garde explicite.
  const accesAutorise = profile?.role === "super_admin";

  // Ne JAMAIS conclure « compte supprimé » d'une simple absence : tant que
  // `users` n'est pas chargé, aucun identifiant ne résout, et tout le journal
  // s'accuserait de porter sur des comptes disparus.
  const nomDe = useMemo(() => {
    const parId = Object.fromEntries(users.map((u) => [u.id, u.nom]));
    return (id?: string) => {
      if (!id) return "Système";
      const nom = parId[id];
      if (nom) return nom;
      if (users.length === 0) return "…";
      return `Compte supprimé · ${id.slice(0, 8)}`;
    };
  }, [users]);

  const actions = useMemo(
    () => [...new Set(auditLog.map((a) => a.action))].sort(),
    [auditLog],
  );

  const filtered = useMemo(
    () =>
      auditLog.filter((a) => {
        if (action && a.action !== action) return false;
        if (!q) return true;
        const foin = `${nomDe(a.userId)} ${a.action} ${a.ressource ?? ""} ${a.hash ?? ""}`;
        return foin.toLowerCase().includes(q.toLowerCase());
      }),
    [auditLog, q, action, nomDe],
  );

  const tableau = (): TableauExport => ({
    titre: "Journal d'audit",
    sousTitre:
      q || action ? `Filtré — ${filtered.length} entrée(s)` : `${filtered.length} entrée(s)`,
    entetes: ["Horodatage", "Utilisateur", "Action", "Statut", "Adresse IP"],
    lignes: filtered.map((a) => [
      new Date(a.createdAt).toLocaleString("fr-FR"),
      nomDe(a.userId),
      a.action,
      // Le journal ne consigne que des actions RÉUSSIES (log_event est appelé après
      // succès) : leur statut est donc « 200 OK ». Aucune valeur n'est fabriquée.
      "200 OK",
      a.ip ?? "",
    ]),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-red-600 text-xs uppercase tracking-widest font-semibold mb-2">
            <ScrollText className="h-4 w-4" aria-hidden="true" /> Traçabilité
          </div>
          <h1 className="text-3xl font-bold text-navy">Journal d'audit</h1>
          <p className="text-muted-foreground mt-1">
            Historique horodaté des actions critiques. Chaque entrée porte une empreinte SHA-256 et
            ne peut être ni modifiée ni supprimée.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exporterCsv(tableau())} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" aria-hidden="true" /> CSV
          </Button>
          <Button variant="outline" onClick={() => exporterPdf(tableau())} disabled={filtered.length === 0}>
            <FileText className="h-4 w-4 mr-2" aria-hidden="true" /> PDF
          </Button>
        </div>
      </div>

      <KpiTiles
        tuiles={[
          { label: "Événements", valeur: auditLog.length >= 200 ? "200+" : auditLog.length, ton: "navy" },
          { label: "Types d'action", valeur: actions.length, ton: "gold" },
          {
            label: "Acteurs distincts",
            valeur: new Set(auditLog.map((a) => a.userId).filter(Boolean)).size,
            ton: "emerald",
          },
          {
            label: "Dernier événement",
            valeur: auditLog[0] ? new Date(auditLog[0].createdAt).toLocaleDateString("fr-FR") : "—",
            ton: "slate",
          },
        ]}
      />

      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3 text-emerald-800 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>
          <strong>Registre en ajout seul</strong> ·{" "}
          {auditLog.length >= 200 ? "200 événements les plus récents" : `${auditLog.length} événements`}{" "}
          · empreinte SHA-256 par entrée · horodatage UTC
        </span>
      </div>

      <Card className="p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search
              className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="audit-search" className="sr-only">
              Rechercher dans le journal d'audit
            </label>
            <Input
              id="audit-search"
              placeholder="Rechercher un utilisateur, une action…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 focus-visible:ring-2 focus-visible:ring-gold"
            />
          </div>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            aria-label="Filtrer par type d'action"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="">Toutes les actions ({auditLog.length})</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a} ({auditLog.filter((e) => e.action === a).length})
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Journal d'audit horodaté">
            <caption className="sr-only">
              Historique de {filtered.length} actions critiques avec leur statut
            </caption>
            <thead className="bg-muted/50 text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th scope="col" className="text-left px-5 py-4 w-48">
                  Horodatage
                </th>
                <th scope="col" className="text-left px-5 py-4">
                  Utilisateur
                </th>
                <th scope="col" className="text-left px-5 py-4">
                  Action
                </th>
                <th scope="col" className="text-left px-5 py-4">
                  Statut
                </th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setDetail(a)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setDetail(a)}
                  className="border-t border-border/60 hover:bg-gold/5 focus:bg-gold/5 focus:outline-none cursor-pointer group"
                >
                  <td className="px-5 py-4 text-[15px] text-muted-foreground font-mono whitespace-nowrap">
                    {new Date(a.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-5 py-4 font-medium text-navy text-[17px]">{nomDe(a.userId)}</td>
                  <td className="px-5 py-4">
                    <Badge variant="secondary">{a.action}</Badge>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[14px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                      200 OK
                    </span>
                  </td>
                  <td className="px-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-gold transition" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    {auditLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    ) : auditLog.length > 0 ? (
                      "Aucune entrée correspondante."
                    ) : !accesAutorise ? (
                      // La RLS d'`audit_log` renvoie [] (pas d'erreur) à un non-super_admin :
                      // un journal « vide » sur un compte non habilité est en fait un refus.
                      "Journal réservé au Super Administrateur. Connectez-vous avec un compte super_admin pour le consulter."
                    ) : (
                      "Le journal est vide. Les actions critiques y seront consignées."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl text-navy">{detail.action}</DialogTitle>
                <DialogDescription>
                  Événement d'audit · entrée immuable, en lecture seule.
                </DialogDescription>
              </DialogHeader>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-1">
                <ChampAudit label="Auteur" value={nomDe(detail.userId)} />
                <ChampAudit
                  label="Horodatage"
                  value={new Date(detail.createdAt).toLocaleString("fr-FR")}
                />
                <ChampAudit label="Statut" value="200 OK · action réussie" />
                <ChampAudit label="Adresse IP" value={detail.ip ?? "—"} pleineLargeur />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChampAudit({
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
