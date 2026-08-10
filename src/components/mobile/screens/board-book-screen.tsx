// BoardBookScreen — extrait de `admin-app.tsx`.
import { useState, useEffect } from "react";
import { AnnotationsPanel } from "../shared/annotations-panel";
import { TopBar } from "../shared/ui-components";
import { type View } from "../shared/view-state";
import { ImageViewerScreen } from "./image-viewer-screen";
import { PdfViewerScreen } from "./pdf-viewer-screen";
import { fetchAnnotationsDeLaSeance, type DocAnnotation } from "@/lib/annotations";
import { TYPE_BADGE, normaliserDocType } from "@/lib/doc-types";
import { supabase } from "@/lib/supabase";
import { type DocType, type Reunion, type User as CaUser } from "@/types/domain";
import { BookOpen, Calendar, ChevronRight, CircleDot, FileText, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

export function BoardBookScreen({
  nav,
  sub,
  data,
  realReunions,
  boardBookReunion,
  profile,
  requireOnline,
  partenaireProcuration,
}: {
  nav: (v: View) => void;
  sub?: string;
  data?: any;
  realReunions: Reunion[];
  boardBookReunion: Reunion | null;
  profile: CaUser | null;
  requireOnline: (label?: string) => boolean;
  partenaireProcuration: (reunionId?: string | null) => { userId: string; nom: string } | undefined;
}) {
  type BBDoc = {
    id: string;
    nom: string;
    type: DocType;
    tailleBytes: number;
    pages: number | null;
    storagePath: string | null;
    pointOjId: string | null;
  };
  // Chaque réunion est un « dossier » : l'écran affiche le Board Book de la
  // réunion passée en navigation, pas une réunion devinée globalement.
  const reunion = realReunions.find((r) => r.id === data?.reunionId) ?? boardBookReunion!;
  const [docs, setDocs] = useState<BBDoc[]>([]);
  const [bb, setBb] = useState<{
    id: string;
    pages: number | null;
    tailleBytes: number | null;
    storagePath: string | null;
    genereAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  // Incrémenté par le canal Realtime : le Board Book généré par le
  // secrétariat doit apparaître sans que le membre recharge l'app.
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const canal = supabase
      .channel(`boardca:bb:${reunion.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "board_books",
          filter: `reunion_id=eq.${reunion.id}`,
        },
        () => setRev((n) => n + 1),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `reunion_id=eq.${reunion.id}`,
        },
        () => setRev((n) => n + 1),
      )
      // Resynchro sur reconnexion : voir src/lib/notifications.ts.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRev((n) => n + 1);
      });
    return () => {
      supabase.removeChannel(canal);
    };
  }, [reunion.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase
        .from("documents")
        .select("id, nom, type, taille_bytes, pages, storage_path, point_oj_id")
        .eq("reunion_id", reunion.id),
      supabase
        .from("board_books")
        .select("id, pages, taille_bytes, storage_path, genere_at")
        .eq("reunion_id", reunion.id)
        .maybeSingle(),
    ]).then(([docsRes, bbRes]) => {
      if (cancelled) return;
      setDocs(
        ((docsRes.data ?? []) as any[]).map((d) => ({
          id: d.id,
          nom: d.nom,
          type: normaliserDocType(d.type),
          tailleBytes: d.taille_bytes ?? 0,
          pages: d.pages,
          storagePath: d.storage_path,
          pointOjId: d.point_oj_id,
        })),
      );
      const b = bbRes.data as any;
      setBb(
        b
          ? {
              id: b.id,
              pages: b.pages,
              tailleBytes: b.taille_bytes,
              storagePath: b.storage_path,
              genereAt: b.genere_at,
            }
          : null,
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reunion.id, rev]);

  // Annotations réelles de tous les documents de la réunion : les miennes
  // (privées + partagées) et celles partagées par les autres, filtrées par RLS.
  const [annos, setAnnos] = useState<DocAnnotation[]>([]);
  const docIds = docs.map((d) => d.id).join(",");
  const bbId = bb?.id ?? null;
  useEffect(() => {
    if (!docIds && !bbId) {
      setAnnos([]);
      return;
    }
    let cancelled = false;
    fetchAnnotationsDeLaSeance(docIds ? docIds.split(",") : [], bbId)
      .then((a) => !cancelled && setAnnos(a))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [docIds, bbId]);
  const docNomById = Object.fromEntries(docs.map((d) => [d.id, d.nom]));

  const openDoc = async (d: BBDoc) => {
    if (!d.storagePath) {
      toast.error("Fichier indisponible");
      return;
    }
    if (!requireOnline("Ouverture du document")) return;
    // PDF → lecteur intégré annotable ; image → visionneuse intégrée (zoom).
    // Les autres formats (docx, xlsx…) n'ont rien à rendre en interne : on les
    // délègue au navigateur via une URL signée.
    if (d.type === "pdf" || d.type === "image") {
      nav({
        tab: "boardbook",
        sub: d.type === "pdf" ? "viewer" : "image",
        data: { reunionId: reunion.id, documentId: d.id, nom: d.nom, storagePath: d.storagePath },
      });
      return;
    }
    setOpeningId(d.id);
    try {
      const { data } = await supabase.storage
        .from("boardca-docs")
        .createSignedUrl(d.storagePath, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      else toast.error("Lien indisponible");
    } finally {
      setOpeningId(null);
    }
  };

  if (sub === "viewer" && data?.storagePath)
    return (
      <PdfViewerScreen
        cible={{ documentId: data.documentId }}
        nom={data.nom}
        storagePath={data.storagePath}
        partenaire={partenaireProcuration(data.reunionId ?? reunion.id)}
        onBack={() => nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } })}
        profile={profile}
      />
    );

  if (sub === "image" && data?.storagePath)
    return (
      <ImageViewerScreen
        nom={data.nom}
        storagePath={data.storagePath}
        onBack={() => nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } })}
      />
    );

  if (sub === "annotations")
    return (
      <AnnotationsPanel
        annotations={annos}
        docNomById={docNomById}
        userId={profile?.id ?? ""}
        onBack={() => nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } })}
        onOpenAnnotation={(a) => {
          // Annotations héritées du temps où le recueil était un PDF unique : ce
          // document n'existe plus, on ramène au sommaire de la séance.
          if (a.boardBookId) {
            nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } });
            return;
          }
          const d = docs.find((x) => x.id === a.documentId);
          if (d?.storagePath && d.type === "pdf")
            nav({
              tab: "boardbook",
              sub: "viewer",
              data: {
                reunionId: reunion.id,
                documentId: d.id,
                nom: d.nom,
                storagePath: d.storagePath,
              },
            });
          else nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } });
        }}
        onDeleted={(id) => setAnnos((prev) => prev.filter((a) => a.id !== id))}
      />
    );

  const annCount = annos.length;
  const extStyle = TYPE_BADGE;
  const fmtSize = (b: number) =>
    b < 1024 * 1024
      ? `${Math.max(1, Math.round(b / 1024))} Ko`
      : `${(b / 1024 / 1024).toFixed(1)} Mo`;
  const statusMeta =
    reunion.statut === "en_cours"
      ? { bg: "#FEE2E2", color: "#DC2626", label: "EN COURS" }
      : reunion.statut === "terminee"
        ? { bg: "#F1F5F9", color: "#64748B", label: "TERMINÉE" }
        : { bg: "#E0F2FE", color: "#0369A1", label: "À VENIR" };

  // Le Board Book EST l'ordre du jour : chaque point, puis les documents qui lui
  // sont rattachés — aucun fichier unique compilé, chaque pièce s'ouvre seule.
  // Les fichiers orphelins (sans point) n'entrent pas dans le recueil.
  const points = [...reunion.ordreDuJour].sort((a, b) => a.position - b.position);
  const docsDuPoint = (pointId: string) => docs.filter((d) => d.pointOjId === pointId);
  const nbRattaches = points.reduce((n, p) => n + docsDuPoint(p.id).length, 0);
  const recueilPret = !!bb;

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-20 relative">
      <TopBar title="Board Book" onBack={() => nav({ tab: "boardbook" })} />
      <div className="px-5 py-4">
        <div
          className="bg-white rounded-xl p-4 border-l-4 border-[#C9A84C]"
          style={{ boxShadow: "0 2px 12px rgba(13,27,62,0.08)" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Séance concernée
            </div>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: statusMeta.bg, color: statusMeta.color }}
            >
              <CircleDot className="h-2.5 w-2.5" /> {statusMeta.label}
            </span>
          </div>
          <div className="mt-1 font-bold text-[#0D1B3E] text-[15px] leading-tight">
            {reunion.titre}
          </div>
          <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />{" "}
            {new Date(reunion.date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {reunion.heure ? ` · ${reunion.heure}` : ""}
          </div>
          <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> {points.length} point(s) à l'ordre du jour ·{" "}
            {nbRattaches} document{nbRattaches > 1 ? "s" : ""}
          </div>
        </div>

        {loading ? (
          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-400 py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Synchronisation…
          </div>
        ) : !recueilPret ? (
          <div className="mt-8 flex flex-col items-center text-center gap-3 px-6">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-navy">Board Book en préparation</div>
            <div className="text-xs text-slate-500 max-w-[250px]">
              Le secrétariat n'a pas encore publié le recueil de cette séance.
            </div>
          </div>
        ) : (
          /* Le recueil : l'ordre du jour, point par point, avec ses documents. */
          <div className="mt-5 space-y-4">
            {/* AJOUT : PDF compilé (sommaire + points & fichiers), quand le
                secrétariat l'a généré. La liste par point ci-dessous reste. */}
            {bb?.storagePath && (
              <button
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from("boardca-docs")
                    .createSignedUrl(bb.storagePath!, 3600);
                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                  else toast.error("PDF indisponible");
                }}
                className="w-full text-left rounded-2xl bg-gradient-to-br from-navy to-navy-light text-white p-4 flex items-center gap-3 shadow-lg active:scale-[0.98] transition"
              >
                <div className="h-11 w-11 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">Board Book — PDF complet</div>
                  <div className="text-[11px] text-white/70 mt-0.5">
                    Sommaire + tous les documents{bb.pages ? ` · ${bb.pages} pages` : ""}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/50 shrink-0" />
              </button>
            )}
            {points.map((p) => {
              const pieces = docsDuPoint(p.id);
              return (
                <section key={p.id}>
                  <header className="flex items-start gap-2 pb-1.5 mb-2 border-b border-[#F1F5F9]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-navy text-gold text-[10px] font-bold">
                      {p.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13px] font-semibold text-[#0D1B3E] leading-snug">
                        {p.titre}
                      </h3>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        {pieces.length === 0
                          ? "Aucun document"
                          : `${pieces.length} document${pieces.length > 1 ? "s" : ""}`}
                      </div>
                    </div>
                  </header>

                  {pieces.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#E2E8F0] py-3 text-center text-[11px] text-slate-400">
                      Aucune pièce rattachée à ce point.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pieces.map((d) => {
                        const style = extStyle[d.type] ?? extStyle.autre;
                        return (
                          <button
                            key={d.id}
                            onClick={() => openDoc(d)}
                            className="w-full bg-white rounded-xl p-3 flex items-center gap-3 border border-[#F1F5F9] active:scale-[0.99] transition"
                          >
                            <div
                              className={`h-11 w-11 rounded-lg ${style.bg} text-white flex flex-col items-center justify-center shrink-0`}
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-[8px] font-bold leading-none mt-0.5">
                                {style.label}
                              </span>
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="text-[14px] font-semibold text-[#0D1B3E] truncate">
                                {d.nom}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {fmtSize(d.tailleBytes)}
                                {d.pages ? ` · ${d.pages} page(s)` : ""}
                              </div>
                            </div>
                            {openingId === d.id ? (
                              <Loader2 className="h-4 w-4 text-[#CBD5E1] shrink-0 animate-spin" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-[#CBD5E1] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <div className="absolute bottom-[52px] left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-[#F1F5F9] px-4 py-2.5 flex items-center gap-2 z-20">
        <button
          onClick={() =>
            nav({ tab: "boardbook", sub: "annotations", data: { reunionId: reunion.id } })
          }
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#0D1B3E] text-white text-[12px] font-semibold active:scale-[0.98]"
        >
          <PenLine className="h-4 w-4" /> Mes annotations ({annCount})
        </button>
      </div>
    </div>
  );
}
