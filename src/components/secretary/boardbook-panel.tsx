import { useMemo, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { Header, Empty } from "./documents-panel";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  BookOpen,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Layers,
  FileStack,
  Copy,
  FileDown,
} from "lucide-react";
import { KpiTiles } from "@/components/super-admin/kpi-tiles";

function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

// Board Book réel : ce n'est PAS un document unique, mais le FORMAT du recueil —
// l'ordre du jour, et sous chaque point les documents qui lui sont rattachés,
// chacun consultable séparément. Le publier (`board_books`) scelle la liste des
// pièces mises à disposition ; un trigger notifie alors les membres. Publication
// possible dès que chaque point OBLIGATOIRE porte au moins un document.
export function BoardBookPanel({ meetingId }: { meetingId: string | null }) {
  const { reunions, documents, boardBooks } = useBoardStore(
    useShallow((s) => ({
      reunions: s.reunions,
      documents: s.documents,
      boardBooks: s.boardBooks,
    })),
  );
  const generateBoardBook = useBoardStore((s) => s.generateBoardBook);
  const generateBoardBookPdf = useBoardStore((s) => s.generateBoardBookPdf);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const reunion = reunions.find((r) => r.id === meetingId);
  const docs = useMemo(
    () => documents.filter((d) => d.reunionId === meetingId),
    [documents, meetingId],
  );

  if (!reunion) return <Empty />;

  const points = reunion.ordreDuJour;
  const board = boardBooks.find((b) => b.reunionId === reunion.id);
  const docsByPoint = (pointId: string) => docs.filter((d) => d.pointOjId === pointId);

  const pointsObligatoiresManquants = points.filter(
    (p) => p.obligatoire && docsByPoint(p.id).length === 0,
  );
  const pret = pointsObligatoiresManquants.length === 0 && points.length > 0;

  const generer = async () => {
    setBusy(true);
    try {
      const bb = await generateBoardBook(reunion.id);
      if (bb)
        toast.success("Board Book publié", { description: "Les membres du CA sont notifiés." });
      else
        toast.error("Board Book incomplet", {
          description: "Chaque point obligatoire doit porter au moins un document.",
        });
    } catch {
      toast.error("Publication impossible");
    } finally {
      setBusy(false);
    }
  };

  // AJOUT : compile le PDF unique (couverture + sommaire dynamique + points et
  // leurs fichiers), puis l'ouvre. Le format « fichiers séparés » reste inchangé.
  const genererPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await generateBoardBookPdf(reunion.id);
      if (res) {
        toast.success("PDF du Board Book généré", { description: "Ouverture du document…" });
        await ouvrirPdf(res.storagePath);
      } else toast.error("Génération du PDF impossible");
    } catch {
      toast.error("Génération du PDF impossible");
    } finally {
      setPdfBusy(false);
    }
  };

  const ouvrirPdf = async (path: string) => {
    const { data } = await supabase.storage.from("boardca-docs").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Lien du PDF indisponible");
  };

  const totalPages = docs.reduce((a, d) => a + (d.pages ?? 1), 0);
  const totalBytes = docs.reduce((a, d) => a + d.tailleBytes, 0);

  // Couverture de l'ordre du jour : ce qui conditionne la compilation.
  const pointsCouverts = points.filter((p) => docsByPoint(p.id).length > 0).length;
  const pctCouverture = points.length ? Math.round((pointsCouverts / points.length) * 100) : 0;

  const copierEmpreinte = async () => {
    if (!board?.hash) return;
    await navigator.clipboard.writeText(board.hash);
    toast.success("Empreinte copiée");
  };

  return (
    <div className="space-y-6">
      <Header
        title="Board Book"
        subtitle="L'ordre du jour de la séance et, sous chaque point, les documents qui s'y rattachent. Chaque pièce reste un fichier consultable séparément."
      />

      <KpiTiles
        tuiles={[
          { label: "Documents", valeur: docs.length, hint: formatBytes(totalBytes), ton: "navy" },
          {
            label: "Pages",
            valeur: board?.pages ?? totalPages,
            hint: "toutes pièces confondues",
            ton: "gold",
          },
          {
            label: "Points couverts",
            valeur: `${pointsCouverts}/${points.length}`,
            hint: `${pctCouverture} % de l'ordre du jour`,
            ton: pret ? "emerald" : "slate",
          },
          {
            label: "Recueil",
            valeur: board ? "Publié" : "À publier",
            hint: board ? "les membres sont notifiés" : "non publié",
            ton: board ? "emerald" : "rose",
          },
        ]}
      />

      {/* Statut de compilation */}
      <div className="rounded-2xl border border-border bg-white p-6">
        {board ? (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-navy flex items-center gap-2">
                  Board Book disponible
                  <span className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="h-3 w-3" /> Publié
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {docs.filter((d) => d.pointOjId).length} document(s) · {board.pages ?? totalPages}{" "}
                  page(s) · {formatBytes(board.tailleBytes ?? totalBytes)} ·{" "}
                  {board.genereeAt
                    ? new Date(board.genereeAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </div>
                {board.hash && (
                  <button
                    onClick={copierEmpreinte}
                    title="Copier l'empreinte complète"
                    className="group mt-1 inline-flex items-center gap-1.5 rounded-md bg-muted/70 px-2 py-1 text-[13px] font-mono text-muted-foreground transition hover:bg-muted hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    {board.hash.slice(0, 24)}…
                    <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              {/* AJOUT : PDF unique (sommaire + points & fichiers), en plus du recueil. */}
              <button
                onClick={genererPdf}
                disabled={pdfBusy}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-40"
              >
                {pdfBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                {board.storagePath ? "Régénérer le PDF" : "Générer le PDF"}
              </button>
              {board.storagePath && (
                <button
                  onClick={() => ouvrirPdf(board.storagePath!)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-navy hover:bg-muted"
                >
                  <FileText className="h-3.5 w-3.5" /> Ouvrir le PDF
                </button>
              )}
              {reunion.statut !== "terminee" && (
                <button
                  onClick={generer}
                  disabled={busy || !pret}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-navy hover:bg-muted disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Layers className="h-3.5 w-3.5" />
                  )}
                  Republier
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                <FileStack className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-navy">Board Book non publié</div>
                <div className="text-xs text-muted-foreground mt-1 max-w-md">
                  {pret
                    ? `Prêt à publier — ${docs.length} document(s), ${totalPages} page(s).`
                    : "Ajoutez au moins un document à chaque point obligatoire avant de publier."}
                </div>
              </div>
            </div>
            <button
              onClick={generer}
              disabled={busy || !pret}
              className="inline-flex items-center gap-2 rounded-lg bg-gold text-gold-foreground px-4 py-2.5 font-semibold hover:brightness-110 disabled:opacity-40 transition"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
              Publier le Board Book
            </button>
          </div>
        )}

        {/* Couverture de l'ordre du jour : la condition même de la compilation. */}
        {points.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Couverture de l'ordre du jour</span>
              <span className="tabular-nums">
                {pointsCouverts}/{points.length} point(s)
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all duration-500 ${pret ? "bg-emerald-500" : "bg-gold"}`}
                style={{ width: `${pctCouverture}%` }}
              />
            </div>
          </div>
        )}

        {pointsObligatoiresManquants.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[15px] text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {pointsObligatoiresManquants.length} point(s) obligatoire(s) sans document :{" "}
              {pointsObligatoiresManquants.map((p) => `« ${p.titre} »`).join(", ")}.
            </span>
          </div>
        )}
      </div>

      {/* Sommaire du recueil */}
      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40 text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">
          Sommaire — {points.length} point(s) à l'ordre du jour
        </div>
        {points.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucun point à l'ordre du jour.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {points.map((p, i) => {
              const attaches = docsByPoint(p.id);
              const manquant = attaches.length === 0;
              return (
                <li
                  key={p.id}
                  className={`px-4 py-3.5 transition-colors ${
                    manquant && p.obligatoire ? "bg-red-50/40" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold tabular-nums ${
                        manquant
                          ? p.obligatoire
                            ? "bg-red-100 text-red-700"
                            : "bg-muted text-muted-foreground"
                          : "bg-navy text-gold"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-navy">{p.titre}</div>
                      {p.dureeMin ? (
                        <div className="mt-0.5 text-[13px] text-muted-foreground">
                          {p.dureeMin} min
                        </div>
                      ) : null}
                    </div>
                    {attaches.length > 0 ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[13px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {attaches.length} document
                        {attaches.length > 1 ? "s" : ""}
                      </span>
                    ) : p.obligatoire ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[13px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                        <AlertTriangle className="h-3.5 w-3.5" /> Document requis
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[13px] font-medium text-muted-foreground">
                        Optionnel
                      </span>
                    )}
                  </div>
                  {attaches.length > 0 && (
                    <ul className="ml-10 mt-2 space-y-1">
                      {attaches.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1 text-[14px] text-muted-foreground hover:bg-muted/50"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-red-500" />
                          <span className="truncate text-navy/80">{d.nom}</span>
                          <span className="ml-auto shrink-0 tabular-nums">
                            {formatBytes(d.tailleBytes)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
