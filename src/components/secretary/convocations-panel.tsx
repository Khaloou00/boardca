import { useMemo, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { Header, Empty } from "./documents-panel";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Crown,
  RefreshCw,
  Download,
  FileText,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { KpiTiles } from "@/components/super-admin/kpi-tiles";
import { exporterCsv, exporterPdf, type TableauExport } from "@/lib/archive-export";
import type { User } from "@/types/domain";

const STATUT_TXT: Record<string, string> = {
  confirmed: "Confirmée",
  excused: "Excusé",
  sent: "En attente",
};

const frDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// Convocations réelles : une ligne par (réunion, membre du CA) dans `convocations`.
// L'envoi crée les lignes ; un trigger Postgres notifie chaque destinataire.
export function ConvocationsPanel({ meetingId }: { meetingId: string | null }) {
  const { reunions, users, convocations } = useBoardStore(
    useShallow((s) => ({ reunions: s.reunions, users: s.users, convocations: s.convocations })),
  );
  const sendConvocations = useBoardStore((s) => s.sendConvocations);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<User | null>(null);

  const reunion = reunions.find((r) => r.id === meetingId);
  const convocsReunion = useMemo(
    () => convocations.filter((c) => c.reunionId === meetingId),
    [convocations, meetingId],
  );
  // On n'affiche QUE les membres du CA convoqués à CETTE séance (ceux sélectionnés à
  // la création), pas tout le Conseil. La liste est dérivée des convocations, gardée
  // dans l'ordre du Conseil.
  const membres = useMemo(() => {
    const convoques = new Set(convocsReunion.map((c) => c.userId));
    return users.filter((u) => u.role === "administrateur" && convoques.has(u.id));
  }, [users, convocsReunion]);
  const convocByUser = useMemo(
    () => Object.fromEntries(convocsReunion.map((c) => [c.userId, c])),
    [convocsReunion],
  );

  if (!reunion) return <Empty />;

  const confirmes = convocsReunion.filter((c) => c.statut === "confirmed").length;
  const excuses = convocsReunion.filter((c) => c.statut === "excused").length;
  const enAttente = convocsReunion.length - confirmes - excuses;
  const cloturee = reunion.statut === "terminee";

  const envoyer = async (userIds: string[], label: string) => {
    if (userIds.length === 0) return;
    setBusy(true);
    try {
      await sendConvocations(reunion.id, userIds);
      toast.success(`${label} · ${userIds.length} destinataire(s)`, {
        description: "Chaque nouveau convoqué reçoit une notification.",
      });
    } catch {
      toast.error("Échec de l'envoi des convocations");
    } finally {
      setBusy(false);
    }
  };

  // Relance : ne cible que les sans-réponse — on ne réécrase jamais une réponse donnée.
  const relancer = () =>
    envoyer(
      convocsReunion
        .filter((c) => c.statut !== "confirmed" && c.statut !== "excused")
        .map((c) => c.userId),
      "Relance envoyée",
    );

  const tableau = (): TableauExport => ({
    titre: `Convocations — ${reunion.titre}`,
    sousTitre: new Date(reunion.date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    entetes: ["Membre", "Qualité", "Statut", "Envoyée le", "Ouverte le"],
    lignes: membres.map((u) => {
      const c = convocByUser[u.id];
      return [
        u.nom,
        u.qualite ?? "",
        c ? (STATUT_TXT[c.statut] ?? c.statut) : "Non convoqué",
        c ? frDateTime(c.sentAt) : "—",
        c ? frDateTime(c.openedAt) : "—",
      ];
    }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Header
          title="Convocations"
          subtitle="Envoi et suivi des convocations des membres du Conseil."
        />
        <div className="flex gap-2">
          <button
            onClick={() => exporterCsv(tableau())}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-muted transition"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={() => exporterPdf(tableau())}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-muted transition"
          >
            <FileText className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      <KpiTiles
        tuiles={[
          {
            label: "Convoqués",
            valeur: convocsReunion.length,
            hint: "membre(s) du CA",
            ton: "navy",
          },
          { label: "Confirmés", valeur: confirmes, hint: "présence confirmée", ton: "emerald" },
          { label: "Excusés", valeur: excuses, hint: "absence signalée", ton: "rose" },
          { label: "En attente", valeur: enAttente, hint: "sans réponse", ton: "slate" },
        ]}
      />

      {!cloturee && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={relancer}
            disabled={busy || enAttente === 0}
            title="Ne réinitialise jamais une réponse déjà donnée"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:bg-muted disabled:opacity-40 transition"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Relancer les {enAttente} sans réponse
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40 text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">
          Destinataires
        </div>
        {membres.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucun membre convoqué à cette séance.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {membres.map((u) => {
              const c = convocByUser[u.id];
              return (
                <li
                  key={u.id}
                  onClick={() => setDetail(u)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setDetail(u)}
                  className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gold/5 focus:bg-gold/5 focus:outline-none transition group"
                >
                  <div className="h-10 w-10 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold shrink-0">
                    {u.initiales}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] font-medium text-navy flex items-center gap-1.5">
                      {u.nom}
                      {u.estPresidentCA && <Crown className="h-3.5 w-3.5 text-gold" />}
                    </div>
                    <div className="text-[14px] text-muted-foreground truncate">
                      {c ? `Envoyée le ${frDateTime(c.sentAt)}` : "Non convoqué"}
                    </div>
                  </div>
                  <StatusBadge statut={c?.statut} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-gold transition shrink-0" />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5 text-xl text-navy">
                  <span className="h-10 w-10 rounded-full bg-navy text-gold flex items-center justify-center text-sm font-bold">
                    {detail.initiales}
                  </span>
                  {detail.nom}
                  {detail.estPresidentCA && <Crown className="h-5 w-5 text-gold" />}
                </DialogTitle>
                <DialogDescription>Convocation · {reunion.titre}</DialogDescription>
              </DialogHeader>
              {(() => {
                const c = convocByUser[detail.id];
                return (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-1">
                    <ConvChamp
                      label="Statut"
                      value={c ? (STATUT_TXT[c.statut] ?? c.statut) : "Non convoqué"}
                    />
                    <ConvChamp label="Qualité" value={detail.qualite || "—"} />
                    <ConvChamp label="Envoyée le" value={c ? frDateTime(c.sentAt) : "—"} />
                    <ConvChamp label="Ouverte le" value={c ? frDateTime(c.openedAt) : "—"} />
                    <ConvChamp label="Email" value={detail.email} pleineLargeur />
                  </div>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConvChamp({
  label,
  value,
  pleineLargeur,
}: {
  label: string;
  value: string;
  pleineLargeur?: boolean;
}) {
  return (
    <div className={pleineLargeur ? "col-span-2" : undefined}>
      <div className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="mt-1 text-[17px] text-navy break-words">{value}</div>
    </div>
  );
}

function StatusBadge({ statut }: { statut?: string }) {
  if (!statut)
    return (
      <span className="text-[12px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500">
        Non convoqué
      </span>
    );
  if (statut === "confirmed")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Confirmée
      </span>
    );
  if (statut === "excused")
    return (
      <span className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
        <XCircle className="h-3 w-3" /> Excusé
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full bg-sky-100 text-sky-700">
      <Clock className="h-3 w-3" /> En attente
    </span>
  );
}
