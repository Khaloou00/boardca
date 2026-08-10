import { useEffect, useMemo, useRef, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { Header, Empty } from "./documents-panel";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  Crown,
  Loader2,
  QrCode,
  Download,
  Printer,
  ScanLine,
  CheckCircle2,
  UserCheck,
  FileText,
  CalendarClock,
  Send,
  History,
  Play,
  Gavel,
  Coins,
  Users,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { fetchReportsSeance, type ReportSeance } from "@/lib/reports-seance";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import type { PresenceMode } from "@/types/domain";
import { KpiTiles } from "@/components/super-admin/kpi-tiles";
import { exporterCsv, exporterPdf, type TableauExport } from "@/lib/archive-export";

const MODE_TXT: Record<string, string> = {
  presentiel: "Présentiel",
  distance: "À distance",
  procuration: "Procuration",
};

// Valeur encodée dans le QR de présence — déterministe dès la création de la
// réunion. Le membre la scanne depuis le mobile pour marquer sa présence réelle.
export const presenceQrValue = (reunionId: string) => `BOARDCA:PRESENCE:${reunionId}`;

// Fenêtre de validité du token de scan, affichée à titre indicatif en séance.
const TOKEN_WINDOW_H = 4;

// Émargement réel : une ligne par (réunion, membre) dans `presences`.
// L'absence = absence de ligne (contrainte DB : mode ∈ presentiel|distance|procuration).
export function AttendancePanel({ meetingId }: { meetingId: string | null }) {
  const { reunions, users, comites, presences, procurations, convocations } = useBoardStore(
    useShallow((s) => ({
      reunions: s.reunions,
      users: s.users,
      comites: s.comites,
      presences: s.presences,
      procurations: s.procurations,
      convocations: s.convocations,
    })),
  );
  const setPresence = useBoardStore((s) => s.setPresence);
  const removePresence = useBoardStore((s) => s.removePresence);
  const scanPresence = useBoardStore((s) => s.scanPresence);
  const updateReunion = useBoardStore((s) => s.updateReunion);
  const reporterSeance = useBoardStore((s) => s.reporterSeance);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seanceBusy, setSeanceBusy] = useState(false);
  // Confirmation avant de basculer le statut de séance : les deux actions sont
  // lourdes de conséquences (ouverture du scan / attribution des jetons).
  const [seanceConfirm, setSeanceConfirm] = useState<"en_cours" | "terminee" | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Report de séance (quorum non atteint) : formulaire + historique des reports déjà
  // prononcés sur cette réunion — c'est la pièce qui justifiera le report dans le PV.
  const [reportOuvert, setReportOuvert] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [nouvelleDate, setNouvelleDate] = useState("");
  const [nouvelleHeure, setNouvelleHeure] = useState("");
  const [nouveauLieu, setNouveauLieu] = useState("");
  const [motif, setMotif] = useState("Quorum non atteint");
  const [reports, setReports] = useState<ReportSeance[]>([]);

  useEffect(() => {
    if (!meetingId) return setReports([]);
    let annule = false;
    fetchReportsSeance(meetingId)
      .then((r) => !annule && setReports(r))
      .catch(() => !annule && setReports([]));
    return () => {
      annule = true;
    };
  }, [meetingId]);

  const reunion = reunions.find((r) => r.id === meetingId);
  // Émargement & quorum ne concernent QUE les participants convoqués à CETTE
  // réunion (ceux sélectionnés à la création), pas tout le Conseil. On dérive donc
  // la liste des membres des convocations de la réunion, dans l'ordre du Conseil.
  const membres = useMemo(() => {
    const convoques = new Set(
      convocations.filter((c) => c.reunionId === meetingId).map((c) => c.userId),
    );
    return users.filter((u) => u.role === "administrateur" && convoques.has(u.id));
  }, [users, convocations, meetingId]);
  const presReunion = useMemo(
    () => presences.filter((p) => p.reunionId === meetingId),
    [presences, meetingId],
  );
  const presByUser = useMemo(
    () => Object.fromEntries(presReunion.map((p) => [p.userId, p])),
    [presReunion],
  );
  const procByUser = useMemo(
    () =>
      Object.fromEntries(
        procurations
          .filter((p) => p.reunionId === meetingId)
          .map((p) => [p.deUserId, p.versUserId]),
      ) as Record<string, string>,
    [procurations, meetingId],
  );
  const convocByUser = useMemo(
    () =>
      Object.fromEntries(
        convocations.filter((c) => c.reunionId === meetingId).map((c) => [c.userId, c]),
      ),
    [convocations, meetingId],
  );
  const comiteNom = useMemo(
    () => Object.fromEntries(comites.map((c) => [c.id, c.nom])) as Record<string, string>,
    [comites],
  );
  const nomById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.nom])) as Record<string, string>,
    [users],
  );
  // Un mandataire peut être un invité (rôle 'invite', désigné depuis le mobile
  // du membre représenté) — il n'apparaît jamais dans `membres` (filtré sur
  // role==='administrateur'), donc jamais comme <option> du select ci-dessous.
  const inviteById = useMemo(
    () => Object.fromEntries(users.filter((u) => u.role === "invite").map((u) => [u.id, u])),
    [users],
  );

  if (!reunion) return <Empty />;

  const presentiel = presReunion.filter((p) => p.mode === "presentiel").length;
  const distance = presReunion.filter((p) => p.mode === "distance").length;
  const procuration = presReunion.filter((p) => p.mode === "procuration").length;
  const presents = presentiel + distance + procuration;
  // Un mandataire qui confirme sa présence (mode 'procuration') a bien émargé
  // pour le membre qu'il représente — ça compte comme un émargement au même
  // titre qu'un scan présentiel/à distance, pas moins.
  const scannes = presents;
  const absents = membres.length - presents;
  const quorumAtteint = presents >= reunion.quorumRequis;
  const pct = Math.min(100, Math.round((presents / Math.max(reunion.quorumRequis, 1)) * 100));
  const cloturee = reunion.statut === "terminee";
  const enCours = reunion.statut === "en_cours";

  const heureDebut = reunion.heure ?? "09:00";
  const [hh, mm] = heureDebut.split(":").map((n) => parseInt(n, 10));
  const heureFin =
    Number.isFinite(hh) && Number.isFinite(mm)
      ? `${String((hh + TOKEN_WINDOW_H) % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
      : "—";

  const changer = async (userId: string, mode: PresenceMode | null) => {
    setBusyId(userId);
    try {
      if (mode) await setPresence(reunion.id, userId, mode);
      else await removePresence(reunion.id, userId);
    } catch {
      toast.error("Mise à jour de l'émargement impossible");
    } finally {
      setBusyId(null);
    }
  };

  const simulerScan = async () => {
    const prochain = membres.find((u) => !presByUser[u.id]);
    if (!prochain) {
      toast.info("Tous les membres sont déjà émargés.");
      return;
    }
    setScanBusy(true);
    try {
      await scanPresence(reunion.id, prochain.id, "presentiel");
      toast.success(`${prochain.nom} a scanné le QR — présence enregistrée.`);
    } catch {
      toast.error("Scan impossible");
    } finally {
      setScanBusy(false);
    }
  };

  const telechargerQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-presence-${reunion.titre.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  const imprimerQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) {
      toast.error("Autorisez les fenêtres pop-up pour imprimer le QR.");
      return;
    }
    w.document.write(`<!doctype html><html><head><title>QR de présence</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:48px;text-align:center;color:#0b1f3a}
        .label{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#b48a3f;font-weight:700}
        h1{font-size:20px;margin:8px 0 4px}
        p{color:#64748b;font-size:13px;margin:0 0 28px}
        img{width:300px;height:300px}
      </style></head><body>
        <div class="label">QR Code de présence</div>
        <h1>${reunion.titre}</h1>
        <p>Séance du ${reunion.date}${reunion.heure ? ` — ${reunion.heure}` : ""}</p>
        <img src="${url}" alt="QR de présence" />
        <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  };

  const changerStatutSeance = async (statut: "en_cours" | "terminee") => {
    setSeanceBusy(true);
    try {
      await updateReunion(reunion.id, { statut });
      setSeanceConfirm(null);
      toast.success(
        statut === "en_cours" ? "Séance démarrée" : "Séance clôturée",
        statut === "en_cours"
          ? { description: "Les administrateurs peuvent scanner le QR pour émarger." }
          : { description: "Jetons de présence attribués et membres notifiés." },
      );
    } catch {
      toast.error("Changement de statut impossible");
    } finally {
      setSeanceBusy(false);
    }
  };

  // Par défaut : même séance, huit jours plus tard, mêmes horaire et lieu.
  const ouvrirReport = () => {
    const d = new Date(`${reunion.date}T12:00:00`);
    d.setDate(d.getDate() + 8);
    setNouvelleDate(d.toLocaleDateString("en-CA"));
    setNouvelleHeure(reunion.heure ?? "");
    setNouveauLieu(reunion.lieu ?? "");
    setMotif("Quorum non atteint");
    setReportOuvert(true);
  };

  const confirmerReport = async () => {
    if (!nouvelleDate) return toast.error("Choisissez la nouvelle date de séance");
    setReportBusy(true);
    try {
      await reporterSeance(reunion.id, {
        date: nouvelleDate,
        heure: nouvelleHeure || undefined,
        lieu: nouveauLieu || undefined,
        motif: motif.trim() || undefined,
      });
      setReports(await fetchReportsSeance(reunion.id));
      setReportOuvert(false);
      toast.success("Séance levée et reportée", {
        description: `Nouvelle convocation envoyée aux administrateurs pour le ${new Date(`${nouvelleDate}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`,
      });
    } catch (err) {
      // La RPC renvoie déjà un message en français (rôle, quorum atteint, date passée),
      // porté par une PostgrestError — un objet simple, pas une instance d'Error.
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Report de la séance impossible";
      toast.error(message);
    } finally {
      setReportBusy(false);
    }
  };

  const tableau = (): TableauExport => ({
    titre: `Émargement — ${reunion.titre}`,
    sousTitre: `${new Date(reunion.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · quorum ${presents}/${reunion.quorumRequis} ${quorumAtteint ? "(atteint)" : "(non atteint)"}`,
    entetes: ["Membre", "Qualité / Comité", "Présence", "Procuration à"],
    lignes: membres.map((u) => {
      const p = presByUser[u.id];
      const versId = p?.mode === "procuration" ? (procByUser[u.id] ?? "") : "";
      return [
        u.nom,
        comiteNom[u.comiteIds[0]] ?? u.qualite ?? "Administrateur",
        p
          ? (MODE_TXT[p.mode] ?? p.mode)
          : convocByUser[u.id]?.statut === "excused"
            ? "Excusé"
            : "Absent",
        versId ? (nomById[versId] ?? "—") : "—",
      ];
    }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Header
          title="Émargement & Quorum"
          subtitle="Enregistrez la présence de chaque membre. Le quorum se calcule en direct."
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
            label: "Présents",
            valeur: presents,
            hint: `sur ${membres.length} membre(s)`,
            ton: "navy",
          },
          { label: "Présentiel", valeur: presentiel, hint: "sur place", ton: "emerald" },
          { label: "À distance", valeur: distance, hint: "visioconférence", ton: "gold" },
          {
            label: "Absents",
            valeur: absents,
            hint: `${procuration} procuration(s)`,
            ton: "slate",
          },
        ]}
      />

      {/* Quorum */}
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-3xl font-bold text-navy font-mono tabular-nums">
              {presents}{" "}
              <span className="text-sm font-medium text-muted-foreground">
                / {reunion.quorumRequis} requis
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Les procurations comptent dans le quorum.
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
              quorumAtteint ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            }`}
          >
            {quorumAtteint ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            {quorumAtteint ? "Quorum atteint" : "Quorum non atteint"}
          </span>
        </div>
        <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full transition-all ${quorumAtteint ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Défaut de quorum : la séance ne peut pas délibérer. La Secrétaire la lève
            et la reporte — la réunion garde son ordre du jour et ses documents, mais
            reprend une date et tous les administrateurs sont reconvoqués. */}
        {!quorumAtteint && !cloturee && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-4.5 w-4.5 text-red-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-red-900">
                  Le Conseil ne peut pas délibérer : il manque {reunion.quorumRequis - presents}{" "}
                  présent(s).
                </div>
                <ul className="mt-1.5 space-y-0.5 text-[15px] text-red-800/90">
                  <li>• La séance est levée et reportée à une nouvelle date.</li>
                  <li>• Une nouvelle convocation est envoyée à tous les administrateurs.</li>
                </ul>
                <div className="mt-1.5 text-[13px] text-red-700/80">
                  L'émargement du jour est archivé comme pièce justificative, puis remis à zéro pour
                  la nouvelle séance.
                </div>
              </div>
            </div>
            <button
              onClick={ouvrirReport}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <CalendarClock className="h-4 w-4" /> Lever et reporter la séance
            </button>
          </div>
        )}

        {reports.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wider text-amber-800">
              <History className="h-3.5 w-3.5" /> Séance déjà reportée {reports.length} fois
            </div>
            <ul className="mt-1.5 space-y-1 text-[14px] text-amber-900/90">
              {reports.map((r) => (
                <li key={r.id}>
                  Prévue le {new Date(`${r.ancienneDate}T12:00:00`).toLocaleDateString("fr-FR")} —
                  levée avec {r.presentsConstates}/{r.quorumRequis} présent(s), reportée au{" "}
                  {new Date(`${r.nouvelleDate}T12:00:00`).toLocaleDateString("fr-FR")}
                  {r.motif ? ` · ${r.motif}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Dialog open={reportOuvert} onOpenChange={(o) => !reportBusy && setReportOuvert(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lever et reporter la séance</DialogTitle>
            <DialogDescription>
              Quorum non atteint : {presents} présent(s) sur {reunion.quorumRequis} requis. La
              séance « {reunion.titre} » sera replanifiée et tous les administrateurs seront
              reconvoqués.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-[14px] font-medium text-navy">
              Nouvelle date
              <input
                type="date"
                value={nouvelleDate}
                min={new Date().toLocaleDateString("en-CA")}
                onChange={(e) => setNouvelleDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              />
            </label>
            <label className="text-[14px] font-medium text-navy">
              Heure
              <input
                type="time"
                value={nouvelleHeure}
                onChange={(e) => setNouvelleHeure(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              />
            </label>
          </div>
          <label className="text-[14px] font-medium text-navy">
            Lieu
            <input
              value={nouveauLieu}
              onChange={(e) => setNouveauLieu(e.target.value)}
              placeholder="Lieu de la nouvelle séance"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            />
          </label>
          <label className="text-[14px] font-medium text-navy">
            Motif (porté à la convocation et au PV)
            <input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            />
          </label>

          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-[14px] text-muted-foreground">
            <div className="flex items-center gap-1.5 font-semibold text-navy">
              <Send className="h-3.5 w-3.5 text-gold" /> Ce que fait cette action
            </div>
            <ul className="mt-1 space-y-0.5">
              <li>• La séance repasse en « planifiée » à la nouvelle date.</li>
              <li>• L'émargement du jour est archivé, puis les présences remises à zéro.</li>
              <li>
                • Les {membres.length} administrateurs sont reconvoqués et notifiés ; leurs réponses
                précédentes sont effacées.
              </li>
              <li>• L'ordre du jour, les documents et le Board Book sont conservés.</li>
            </ul>
          </div>

          <DialogFooter>
            <button
              onClick={() => setReportOuvert(false)}
              disabled={reportBusy}
              className="px-4 py-2 text-sm text-muted-foreground disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={confirmerReport}
              disabled={reportBusy || !nouvelleDate}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {reportBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              Lever et reconvoquer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation d'ouverture / de clôture de séance */}
      <Dialog
        open={seanceConfirm !== null}
        onOpenChange={(o) => !seanceBusy && !o && setSeanceConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {seanceConfirm === "en_cours" ? (
                <>
                  <Play className="h-4.5 w-4.5 text-emerald-600" /> Démarrer la séance ?
                </>
              ) : (
                <>
                  <Gavel className="h-4.5 w-4.5 text-gold" /> Clôturer la séance ?
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {seanceConfirm === "en_cours"
                ? `La séance « ${reunion.titre} » passera en cours et le QR de présence deviendra actif.`
                : `La séance « ${reunion.titre} » sera terminée. Cette action est définitive.`}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-[14px] text-muted-foreground">
            <div className="flex items-center gap-1.5 font-semibold text-navy">
              <Send className="h-3.5 w-3.5 text-gold" /> Ce que fait cette action
            </div>
            <ul className="mt-1 space-y-0.5">
              {seanceConfirm === "en_cours" ? (
                <>
                  <li>• Les administrateurs peuvent scanner le QR pour émarger.</li>
                  <li>
                    • Le token de scan est valide {heureDebut} → +{TOKEN_WINDOW_H}h ({heureFin}).
                  </li>
                  <li>• Les votes et discussions de séance s'ouvrent.</li>
                </>
              ) : (
                <>
                  <li>• L'émargement est figé : plus aucun scan ni modification.</li>
                  <li>• Les jetons de présence sont attribués aux membres présents.</li>
                  <li>• Les membres sont notifiés de la clôture.</li>
                </>
              )}
            </ul>
          </div>

          {/* Garde-fou : ouvrir ou clore une séance sans quorum se voit dans le PV. */}
          {!quorumAtteint && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[14px] text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Quorum non atteint : {presents} présent(s) sur {reunion.quorumRequis} requis. Le
                Conseil ne peut pas délibérer valablement — envisagez de lever et reporter la
                séance.
              </span>
            </div>
          )}

          {seanceConfirm === "terminee" && (
            <div className="grid grid-cols-2 gap-2 text-[14px]">
              <div className="rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Présents
                </div>
                <div className="mt-0.5 font-semibold text-navy">
                  {presents} / {membres.length}
                </div>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Coins className="h-3.5 w-3.5 text-gold" /> Jetons attribués
                </div>
                <div className="mt-0.5 font-semibold text-navy">{presents} membre(s)</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              onClick={() => setSeanceConfirm(null)}
              disabled={seanceBusy}
              className="px-4 py-2 text-sm text-muted-foreground disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={() => seanceConfirm && changerStatutSeance(seanceConfirm)}
              disabled={seanceBusy}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                seanceConfirm === "en_cours"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gold text-gold-foreground hover:brightness-95"
              }`}
            >
              {seanceBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : seanceConfirm === "en_cours" ? (
                <Play className="h-4 w-4" />
              ) : (
                <Gavel className="h-4 w-4" />
              )}
              {seanceConfirm === "en_cours" ? "Démarrer la séance" : "Clôturer la séance"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deux colonnes : QR de présence à gauche, feuille de présence à droite */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
        {/* Carte QR de présence */}
        <div className="rounded-2xl border border-border bg-navy text-white p-6 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-widest text-gold font-semibold">
            <QrCode className="h-4 w-4" /> QR Code de présence
          </div>
          <div className="mt-1.5 font-semibold text-lg leading-tight">{reunion.titre}</div>

          <div className="mt-4 rounded-2xl bg-white p-3">
            <QRCodeSVG value={presenceQrValue(reunion.id)} size={196} level="M" />
          </div>
          {/* Canvas caché : sert d'export PNG (téléchargement / impression) */}
          <QRCodeCanvas
            value={presenceQrValue(reunion.id)}
            size={512}
            level="M"
            marginSize={2}
            ref={qrCanvasRef}
            style={{ display: "none" }}
          />

          <div className="mt-3 text-[13px] text-white/60">
            Token valide : {heureDebut} → +{TOKEN_WINDOW_H}h ({heureFin}) · 1 scan par
            administrateur
          </div>

          <button
            onClick={telechargerQr}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-gold text-gold-foreground hover:brightness-95"
          >
            <Download className="h-4 w-4" /> Télécharger le QR Code (PNG)
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2 w-full">
            <button
              onClick={imprimerQr}
              className="inline-flex items-center justify-center gap-2 text-[15px] font-semibold px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15"
            >
              <Printer className="h-4 w-4" /> Imprimer
            </button>
            <button
              onClick={simulerScan}
              disabled={cloturee || scanBusy}
              className="inline-flex items-center justify-center gap-2 text-[15px] font-semibold px-3 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
              title={cloturee ? "Séance terminée" : "Simuler le scan d'un membre"}
            >
              {scanBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}{" "}
              Simuler un scan
            </button>
          </div>

          {/* Statut de séance + démarrer / clôturer */}
          <div className="mt-4 w-full flex flex-col items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1 rounded-full ${
                enCours
                  ? "bg-emerald-500/20 text-emerald-300"
                  : cloturee
                    ? "bg-white/10 text-white/50"
                    : "bg-white/10 text-white/60"
              }`}
            >
              {enCours
                ? "Séance en cours — scan actif"
                : cloturee
                  ? "Séance terminée"
                  : "Le scan sera actif quand la séance démarrera"}
            </span>
            {reunion.statut === "planifiee" && (
              <button
                onClick={() => setSeanceConfirm("en_cours")}
                disabled={seanceBusy}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" /> Démarrer la séance
              </button>
            )}
            {enCours && (
              <button
                onClick={() => setSeanceConfirm("terminee")}
                disabled={seanceBusy}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full bg-gold text-gold-foreground hover:brightness-95 disabled:opacity-60"
              >
                <Gavel className="h-3.5 w-3.5" /> Clôturer la séance
              </button>
            )}
          </div>

          {/* Compteur de scans */}
          <div className="mt-4 w-full border-t border-white/10 pt-3 text-left">
            <div className="flex items-center gap-1.5 text-[13px] uppercase tracking-wider text-gold font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Présents scannés · {scannes}/{membres.length}
            </div>
            <div className="mt-1 text-[13px] text-white/55">
              {scannes === 0
                ? "Aucun scan encore — cliquez « Simuler un scan »."
                : scannes === membres.length
                  ? "Tous les membres présents ont été scannés."
                  : `${membres.length - scannes} membre(s) restant(s) à émarger.`}
            </div>
          </div>
        </div>

        {/* Feuille de présence */}
        <div className="rounded-2xl border border-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40 text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">
            Feuille de présence
          </div>
          {membres.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun membre du CA enregistré.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {membres.map((u) => {
                const p = presByUser[u.id];
                const c = convocByUser[u.id];
                const busy = busyId === u.id;
                const sousTitre = comiteNom[u.comiteIds[0]] ?? u.qualite ?? "Administrateur";
                // La délégation (procurations) existe dès que le membre l'a désignée
                // (mobile ou secrétariat) — indépendamment du scan de présence, qui
                // peut arriver plus tard. Ne JAMAIS gater sur `p?.mode==='procuration'`
                // ici : un mandataire pas encore scanné doit déjà apparaître, sans quoi
                // le membre reste affiché comme s'il n'avait personne pour le représenter.
                const versId = procByUser[u.id] ?? "";
                const versInvite = versId ? inviteById[versId] : undefined;
                const presenceConfirmeeParMandat = p?.mode === "procuration";
                // Un mandataire invité n'a pas de siège propre dans cette liste (elle
                // ne recense que les administrateurs) : sa présence compte pour le
                // membre représenté (même ligne `presences.user_id = u.id`, quorum et
                // décompte inchangés), mais on affiche SON identité à lui — c'est lui
                // qui a réellement émargé — avec le membre représenté en dessous.
                return (
                  <li key={u.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-navy text-gold flex items-center justify-center text-[13px] font-bold shrink-0">
                      {versInvite ? versInvite.initiales : u.initiales}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-navy flex items-center gap-1.5">
                        <span className="truncate">{versInvite ? versInvite.nom : u.nom}</span>
                        {u.estPresidentCA && <Crown className="h-3.5 w-3.5 text-gold shrink-0" />}
                      </div>
                      <div className="text-[13px] text-muted-foreground truncate">
                        {versInvite ? (
                          <>
                            Représente {u.nom}
                            {!presenceConfirmeeParMandat && " · pas encore confirmée"}
                          </>
                        ) : (
                          <>
                            {sousTitre}
                            {c?.statut === "excused" && " · Excusé"}
                            {versId
                              ? ` · Procuration à ${nomById[versId] ?? "—"}${presenceConfirmeeParMandat ? "" : " (pas encore confirmée)"}`
                              : !p && " · Absent"}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Contrôles à colonnes fixes : alignés d'une ligne à l'autre */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-4 flex items-center justify-center shrink-0">
                        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </span>
                      {/* Présence : vert dès qu'une présence est enregistrée, quel que soit
                          le mode (présentiel, à distance ou procuration) — un seul indicateur
                          depuis la suppression du toggle « à distance » dédié. Une confirmation
                          par procuration (mandataire) n'est pas éditable ici — le clic est
                          ignoré pour ne pas écraser silencieusement le lien avec le mandataire.
                          Un « à distance » reste corrigeable en présentiel d'un clic : la
                          Secrétaire doit pouvoir requalifier une présence mal déclarée (ex. un
                          membre marqué à distance alors qu'il est en réalité sur place). */}
                      <button
                        disabled={cloturee || busy}
                        onClick={() => {
                          if (p?.mode === "procuration") return;
                          changer(u.id, p?.mode === "presentiel" ? null : "presentiel");
                        }}
                        title={
                          p?.mode === "procuration"
                            ? "Présence confirmée par procuration"
                            : p?.mode === "distance"
                              ? "Actuellement à distance — cliquer pour requalifier en présentiel"
                              : p?.mode === "presentiel"
                                ? "Retirer (présentiel)"
                                : "Marquer présent (présentiel)"
                        }
                        className={`inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-lg border transition disabled:opacity-40 ${
                          p
                            ? "bg-emerald-600 text-white border-transparent"
                            : "bg-white border-border text-muted-foreground hover:text-navy"
                        } ${p?.mode === "procuration" ? "cursor-default" : ""}`}
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {cloturee && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-600">
          Séance terminée : l'émargement est figé.
        </div>
      )}
    </div>
  );
}
