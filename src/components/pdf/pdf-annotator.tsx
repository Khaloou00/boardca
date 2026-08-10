import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  Trash2,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import {
  createAnnotation,
  deleteAnnotation,
  fetchAnnotations,
  type AnnotationCible,
  type AnnotationType,
  type AnnotationVisibility,
  type DocAnnotation,
} from "@/lib/annotations";
import "./pdf-annotator.css";

// pdf.js s'importe UNIQUEMENT côté client : un `import` statique casse le rendu
// serveur (`ReferenceError: DOMMatrix is not defined` dès l'évaluation du module),
// et il pèse ~1 Mo qu'on n'a aucune raison de mettre dans le bundle initial.
// Le module est donc chargé à la demande, une seule fois, et mémoïsé.
type PdfModule = typeof import("pdfjs-dist");
let pdfModule: Promise<PdfModule> | null = null;

function chargerPdfjs(): Promise<PdfModule> {
  pdfModule ??= (async () => {
    const [pdfjs, worker] = await Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.mjs?url"),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  })();
  return pdfModule;
}

// ── Ancrage texte ──────────────────────────────────────────────────────────
// On repère un passage par (page, offset du 1er caractère, longueur) mesurés sur
// le texte concaténé des nœuds texte de la couche pdf.js. On ne stocke PAS de
// rectangles : ils dépendent du zoom, les offsets non.
//
// `Range.toString()` concatène exactement les mêmes nœuds texte que le
// TreeWalker ci-dessous — c'est ce qui garantit que capture et restitution
// parlent du même système de coordonnées.

function offsetsDeLaSelection(root: HTMLElement, range: Range) {
  const avant = document.createRange();
  avant.selectNodeContents(root);
  avant.setEnd(range.startContainer, range.startOffset);
  const debut = avant.toString().length;
  const texte = range.toString();
  return { debut, longueur: texte.length, texte };
}

function rangeDepuisOffsets(root: HTMLElement, debut: number, longueur: number): Range | null {
  if (longueur <= 0) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const fin = debut + longueur;
  let total = 0;
  let commence = false;
  let n = walker.nextNode() as Text | null;
  while (n) {
    const len = n.data.length;
    // `debut < total + len` (strict) : un début pile sur la frontière appartient
    // au nœud suivant, sinon on poserait un start en fin de nœud vide de sens.
    if (!commence && debut < total + len) {
      range.setStart(n, debut - total);
      commence = true;
    }
    if (commence && fin <= total + len) {
      range.setEnd(n, fin - total);
      return range;
    }
    total += len;
    n = walker.nextNode() as Text | null;
  }
  return null;
}

// ── Couleurs : la teinte encode la VISIBILITÉ, le soulignement encode le TYPE ──
const TEINTE: Record<AnnotationVisibility, string> = {
  private: "rgba(250, 204, 21, 0.42)", // ambre — visible de moi seul
  public: "rgba(239, 68, 68, 0.38)", // rouge — partagé avec le Conseil
};
const SOULIGNE: Record<AnnotationVisibility, string> = {
  private: "#CA8A04",
  public: "#DC2626",
};

// Zoom relatif à l'ajustement pleine largeur : 1 = la page occupe toute la
// largeur visible. Au-delà, la page déborde et le conteneur défile.
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_PAS = 0.25;

type Boite = { id: string; left: number; top: number; width: number; height: number };

export function PdfAnnotator({
  cible,
  url,
  userId,
  onCountChange,
  visibiliteImposee,
  partageAvecUserId,
  partageAvecNom,
  pvVersion,
}: {
  /** Document du Board Book, le recueil fusionné, ou le procès-verbal. */
  cible: AnnotationCible;
  url: string;
  userId: string;
  onCountChange?: (n: number) => void;
  /** Force la visibilité et masque le choix privé/partagé (ex. : PV = toujours partagé). */
  visibiliteImposee?: AnnotationVisibility;
  /** Binôme mandant/mandataire actif sur cette réunion : quand fourni, une 3e
   *  option permet de cibler cette personne précise (indépendant de privé/
   *  public — voir `annotations.partage_avec_user_id`). Absent pour la
   *  grande majorité des lecteurs, qui ne voient donc aucun changement. */
  partageAvecUserId?: string;
  partageAvecNom?: string;
  /** Cible PV uniquement : manche courante du procès-verbal. Les annotations
   *  des versions précédentes (texte depuis corrigé et renvoyé par le
   *  Secrétariat) sont alors masquées, et les nouvelles sont rattachées à
   *  cette version. Omis pour un document/Board Book, qui n'ont pas de version. */
  pvVersion?: number;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const defilementRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const pdfjsRef = useRef<PdfModule | null>(null);
  const renderTokenRef = useRef(0);
  // Tâche pdf.js en cours : deux rendus ne doivent JAMAIS peindre le même canvas
  // en même temps (sinon page corrompue / renversée à 180°). On annule la
  // précédente avant d'en démarrer une nouvelle.
  const renderTaskRef = useRef<{ cancel: () => void; promise: Promise<void> } | null>(null);

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [nbPages, setNbPages] = useState(0);
  const [rendu, setRendu] = useState(0); // incrémenté après chaque rendu réussi
  // Facteur appliqué PAR-DESSUS l'ajustement à la largeur : 1 = pleine largeur.
  const [zoom, setZoom] = useState(1);

  const [annotations, setAnnotations] = useState<DocAnnotation[]>([]);
  const [boites, setBoites] = useState<Boite[]>([]);

  const [selection, setSelection] = useState<{
    debut: number;
    longueur: number;
    texte: string;
  } | null>(null);
  const [visibilite, setVisibilite] = useState<AnnotationVisibility>(
    visibiliteImposee ?? "private",
  );
  // Cible le binôme mandant/mandataire plutôt que tout le Conseil — reste
  // "private" côté visibility (le partage se fait via `partage_avec_user_id`,
  // un axe indépendant, pas en passant par "public").
  const [partageCible, setPartageCible] = useState(false);
  const [commentaireOuvert, setCommentaireOuvert] = useState(false);
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // ── Chargement du PDF ────────────────────────────────────────────────────
  useEffect(() => {
    let annule = false;
    let tache: ReturnType<PdfModule["getDocument"]> | null = null;
    setChargement(true);
    setErreur(null);

    chargerPdfjs()
      .then((pdfjs) => {
        if (annule) return;
        pdfjsRef.current = pdfjs;
        tache = pdfjs.getDocument({ url });
        return tache.promise;
      })
      .then((pdf) => {
        if (annule || !pdf) return;
        pdfRef.current = pdf;
        setNbPages(pdf.numPages);
        setPage(1);
        setChargement(false);
      })
      .catch((e) => {
        if (annule) return;
        setErreur(e?.message ?? "Impossible d'ouvrir le PDF");
        setChargement(false);
      });

    return () => {
      annule = true;
      // Le nettoyage passe par la loading task : c'est elle qui possède le
      // worker, `PDFDocumentProxy` n'expose pas de `destroy()`.
      tache?.destroy();
      pdfRef.current = null;
    };
  }, [url]);

  // ── Chargement des annotations ───────────────────────────────────────────
  // `cible` est un objet littéral recréé à chaque rendu du parent : on mémoïse
  // sur sa valeur, pas sur son identité, sinon l'effet reboucle indéfiniment.
  const cibleCle =
    "documentId" in cible
      ? `d:${cible.documentId}`
      : "boardBookId" in cible
        ? `b:${cible.boardBookId}`
        : `p:${cible.pvId}`;
  const rechargerAnnotations = useCallback(() => {
    const c: AnnotationCible = cibleCle.startsWith("d:")
      ? { documentId: cibleCle.slice(2) }
      : cibleCle.startsWith("b:")
        ? { boardBookId: cibleCle.slice(2) }
        : { pvId: cibleCle.slice(2) };
    fetchAnnotations(c)
      .then((tout) =>
        // Cible PV avec version connue : on n'affiche que la manche courante.
        // Les annotations d'une version antérieure pointent (par leurs offsets)
        // vers un texte qui n'existe plus tel quel — les restituer serait au
        // mieux inutile, au pire trompeur.
        setAnnotations(pvVersion === undefined ? tout : tout.filter((a) => a.pvVersion === pvVersion)),
      )
      .catch(() => toast.error("Chargement des annotations impossible"));
  }, [cibleCle, pvVersion]);
  useEffect(rechargerAnnotations, [rechargerAnnotations]);
  useEffect(() => onCountChange?.(annotations.length), [annotations.length, onCountChange]);

  // ── Rendu d'une page (canvas + couche texte) ─────────────────────────────
  const dessiner = useCallback(async () => {
    const pdf = pdfRef.current;
    const pdfjs = pdfjsRef.current;
    const canvas = canvasRef.current;
    const conteneur = pageRef.current;
    const coucheTexte = textLayerRef.current;
    if (!pdf || !pdfjs || !canvas || !conteneur || !coucheTexte) return;

    // Chaque rendu prend un jeton : un rendu obsolète (page changée, largeur
    // changée) ne doit ni écrire dans le canvas ni publier ses rectangles.
    const jeton = ++renderTokenRef.current;

    // Annule d'abord la tâche pdf.js encore en vol : sans cela, redimensionner le
    // canvas ci-dessous pendant qu'elle peint corrompt sa matrice → page à 180°.
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const p = await pdf.getPage(page);
    if (jeton !== renderTokenRef.current) return;

    // On mesure le conteneur de DÉFILEMENT, pas le parent direct : quand le zoom
    // fait déborder la page, `clientWidth` du conteneur reste la largeur visible,
    // ce qui évite une boucle de rétroaction avec le ResizeObserver.
    const largeurDispo = defilementRef.current?.clientWidth ?? 360;
    const base = p.getViewport({ scale: 1 });
    const echelle = (largeurDispo / base.width) * zoom;
    const viewport = p.getViewport({ scale: echelle });
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    conteneur.style.width = `${viewport.width}px`;
    conteneur.style.height = `${viewport.height}px`;
    conteneur.style.setProperty("--total-scale-factor", String(echelle));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tache = p.render({
      canvas,
      canvasContext: ctx,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });
    renderTaskRef.current = tache;
    try {
      await tache.promise;
    } catch {
      return; // rendu annulé
    } finally {
      if (renderTaskRef.current === tache) renderTaskRef.current = null;
    }
    if (jeton !== renderTokenRef.current) return;

    coucheTexte.replaceChildren();
    const tl = new pdfjs.TextLayer({
      textContentSource: await p.getTextContent(),
      container: coucheTexte,
      viewport,
    });
    await tl.render();
    if (jeton !== renderTokenRef.current) return;
    setRendu((n) => n + 1);
  }, [page, zoom]);

  useEffect(() => {
    if (!chargement && nbPages > 0) void dessiner();
  }, [dessiner, chargement, nbPages]);

  // Re-rendu à la rotation / redimensionnement de la zone visible.
  useEffect(() => {
    const conteneur = defilementRef.current;
    if (!conteneur) return;
    const ro = new ResizeObserver(() => void dessiner());
    ro.observe(conteneur);
    return () => ro.disconnect();
  }, [dessiner]);

  // ── Restitution des surlignages : offsets → rectangles ───────────────────
  // Recalculé après CHAQUE rendu (le zoom change les rectangles, pas les offsets)
  // et à chaque changement d'annotations.
  useLayoutEffect(() => {
    const coucheTexte = textLayerRef.current;
    const conteneur = pageRef.current;
    if (!coucheTexte || !conteneur || rendu === 0) return;
    const cadre = conteneur.getBoundingClientRect();
    if (cadre.width === 0) return;

    const nouvelles: Boite[] = [];
    for (const a of annotations) {
      if (a.page !== page) continue;
      const range = rangeDepuisOffsets(coucheTexte, a.debut, a.longueur);
      if (!range) continue; // ancrage perdu : l'annotation reste dans la liste
      for (const r of Array.from(range.getClientRects())) {
        if (r.width === 0 || r.height === 0) continue;
        nouvelles.push({
          id: a.id,
          left: ((r.left - cadre.left) / cadre.width) * 100,
          top: ((r.top - cadre.top) / cadre.height) * 100,
          width: (r.width / cadre.width) * 100,
          height: (r.height / cadre.height) * 100,
        });
      }
    }
    setBoites(nouvelles);
  }, [annotations, page, rendu]);

  const parId = new Map(annotations.map((a) => [a.id, a]));

  // ── Capture de sélection ─────────────────────────────────────────────────
  const capturer = useCallback(() => {
    // Une fois le champ de commentaire ouvert, la sélection déjà capturée est
    // figée : cliquer/taper dans le `<textarea>` (autofocus) collabore ou
    // déplace la sélection navigateur — sans cette garde, `selectionchange`
    // (ci-dessous) effaçait `selection` à l'instant même où le champ
    // apparaissait, le faisant disparaître aussitôt.
    if (commentaireOuvert) return;
    const coucheTexte = textLayerRef.current;
    const sel = window.getSelection();
    if (!coucheTexte || !sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    // Ignore toute sélection qui déborde de la couche texte de la page courante.
    if (!coucheTexte.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const { debut, longueur, texte } = offsetsDeLaSelection(coucheTexte, range);
    if (texte.trim().length < 2) {
      setSelection(null);
      return;
    }
    setSelection({ debut, longueur, texte });
  }, [commentaireOuvert]);

  // Sur mobile, étendre une sélection se fait en glissant les poignées natives
  // du navigateur — ces gestes ne déclenchent PAS un `touchend` sur `.pdfPage`
  // (les poignées sont un overlay du système, hors de notre DOM), donc
  // `onTouchEnd={capturer}` seul ne capture que le 1er mot (celui du appui
  // long initial) et jamais l'extension voulue par l'utilisateur : les membres
  // du CA « n'arrivaient pas à sélectionner » un groupe de mots sur mobile.
  // `selectionchange` est le seul événement garanti à chaque mise à jour de la
  // sélection, quel que soit le mécanisme (souris, poignées tactiles, clavier)
  // — écouté au niveau du document et légèrement débounced pour ne pas
  // recalculer les offsets à chaque micro-changement pendant le glissé.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onSelectionChange = () => {
      clearTimeout(t);
      t = setTimeout(capturer, 150);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      clearTimeout(t);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [capturer]);

  const annuler = () => {
    setSelection(null);
    setCommentaireOuvert(false);
    setCommentaire("");
    setPartageCible(false);
    window.getSelection()?.removeAllRanges();
  };

  const ajouter = async (type: AnnotationType, note?: string) => {
    if (!selection) return;
    if (type === "comment" && !note?.trim()) {
      toast.error("Le commentaire est vide");
      return;
    }
    setEnvoi(true);
    try {
      const a = await createAnnotation({
        cible,
        userId,
        type,
        visibility: partageCible ? "private" : visibilite,
        page,
        debut: selection.debut,
        longueur: selection.longueur,
        texte: selection.texte,
        note: note?.trim(),
        partageAvecUserId: partageCible ? partageAvecUserId : undefined,
        pvVersion,
      });
      setAnnotations((prev) => [a, ...prev]);
      annuler();
      toast.success(
        partageCible
          ? `${type === "highlight" ? "Passage surligné" : "Commentaire"} partagé avec ${partageAvecNom ?? "le binôme"}`
          : type === "highlight"
            ? visibilite === "private"
              ? "Passage surligné (privé)"
              : "Passage surligné et partagé"
            : visibilite === "private"
              ? "Note privée enregistrée"
              : "Commentaire partagé au Conseil",
      );
    } catch {
      toast.error("Enregistrement de l'annotation impossible");
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async (id: string) => {
    const avant = annotations;
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    try {
      await deleteAnnotation(id);
    } catch {
      setAnnotations(avant);
      toast.error("Suppression impossible");
    }
  };

  if (erreur)
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        Impossible d'afficher ce PDF. <div className="text-xs mt-1 text-slate-400">{erreur}</div>
      </div>
    );

  const annotationsPage = annotations.filter((a) => a.page === page);
  const zoomer = (delta: number) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));

  return (
    <div className="space-y-3">
      {/* Barre de pages */}
      <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-[12px] font-semibold text-navy tabular-nums">
          {chargement ? "…" : `Page ${page} / ${nbPages}`}
        </div>
        <button
          onClick={() => setPage((p) => Math.min(nbPages, p + 1))}
          disabled={page >= nbPages}
          className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Barre de zoom */}
      <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2">
        <button
          onClick={() => zoomer(-ZOOM_PAS)}
          disabled={zoom <= ZOOM_MIN}
          className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40"
          aria-label="Réduire"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-navy tabular-nums px-2 py-1 rounded-lg hover:bg-slate-50"
          title="Ajuster à la largeur"
        >
          <Maximize2 className="h-3.5 w-3.5 text-slate-400" />
          {Math.round(zoom * 100)} %
        </button>
        <button
          onClick={() => zoomer(ZOOM_PAS)}
          disabled={zoom >= ZOOM_MAX}
          className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40"
          aria-label="Agrandir"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      {/* Page — déborde horizontalement dès que le zoom dépasse la largeur */}
      <div
        ref={defilementRef}
        className="bg-white rounded-2xl border border-slate-100 p-1 overflow-auto"
      >
        {chargement && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Ouverture du document…
          </div>
        )}
        {/* `w-max` : le wrapper épouse la page zoomée pour que le conteneur de
            défilement mesure correctement son `scrollWidth`. Pas de `mx-auto`,
            qui rognerait la gauche d'une page plus large que la zone visible. */}
        <div className={chargement ? "hidden" : "w-max"}>
          <div ref={pageRef} className="pdfPage" onMouseUp={capturer} onTouchEnd={capturer}>
            <canvas ref={canvasRef} />
            <div className="annoLayer">
              {boites.map((b, i) => {
                const a = parId.get(b.id);
                if (!a) return null;
                return (
                  <div
                    key={`${b.id}-${i}`}
                    className="annoBox"
                    style={{
                      left: `${b.left}%`,
                      top: `${b.top}%`,
                      width: `${b.width}%`,
                      height: `${b.height}%`,
                      background: TEINTE[a.visibility],
                      borderBottom:
                        a.type === "comment" ? `2px dashed ${SOULIGNE[a.visibility]}` : undefined,
                    }}
                  />
                );
              })}
            </div>
            <div ref={textLayerRef} className="textLayer" />
          </div>
        </div>
      </div>

      {/* Barre d'outils de sélection */}
      {selection && !commentaireOuvert && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 bg-navy text-white rounded-2xl shadow-2xl px-2 py-2 flex flex-col gap-2 w-[300px]">
          {/* Choix privé/partagé — masqué quand la visibilité est imposée (PV = partagé). */}
          {!visibiliteImposee && (
            <div className="flex rounded-full bg-white/10 p-0.5 text-[11px] font-semibold">
              {(["private", "public"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setVisibilite(v);
                    setPartageCible(false);
                  }}
                  className={`flex-1 rounded-full py-1 flex items-center justify-center gap-1 transition ${
                    !partageCible && visibilite === v ? "bg-white text-navy" : "text-white/70"
                  }`}
                >
                  {v === "private" ? <Lock className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                  {v === "private" ? "Privé" : "Partagé"}
                </button>
              ))}
              {partageAvecUserId && (
                <button
                  onClick={() => setPartageCible(true)}
                  title={`Visible uniquement de vous et ${partageAvecNom ?? "cette personne"}`}
                  className={`flex-1 rounded-full py-1 flex items-center justify-center gap-1 transition truncate ${
                    partageCible ? "bg-white text-navy" : "text-white/70"
                  }`}
                >
                  <Users className="h-3 w-3 shrink-0" />
                  <span className="truncate">Avec {partageAvecNom ?? "le binôme"}</span>
                </button>
              )}
            </div>
          )}
          <div className="flex items-center">
            <button
              onClick={() => ajouter("highlight")}
              disabled={envoi}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold disabled:opacity-50"
            >
              <Highlighter className="h-4 w-4" /> Surligner
            </button>
            <div className="w-px h-6 bg-white/15" />
            <button
              onClick={() => setCommentaireOuvert(true)}
              disabled={envoi}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold disabled:opacity-50"
            >
              <MessageSquare className="h-4 w-4" /> Commenter
            </button>
            <div className="w-px h-6 bg-white/15" />
            <button onClick={annuler} className="px-3 py-2 text-[12px] text-white/60">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Saisie du commentaire */}
      {commentaireOuvert && selection && (
        <div className="fixed bottom-20 left-4 right-4 z-30 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3">
          <div className="text-[11px] text-slate-500 mb-2 italic line-clamp-2">
            « {selection.texte} »
          </div>
          <textarea
            autoFocus
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder={
              partageCible
                ? `Votre note, visible de vous et ${partageAvecNom ?? "cette personne"}…`
                : visibilite === "private"
                  ? "Votre note privée…"
                  : "Votre commentaire au Conseil…"
            }
            className="w-full text-sm border border-slate-200 rounded-lg p-2 min-h-[70px] focus:border-gold outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={annuler}
              className="flex-1 text-sm py-2 border border-slate-200 rounded-lg"
            >
              Annuler
            </button>
            <button
              onClick={() => ajouter("comment", commentaire)}
              disabled={envoi}
              className="flex-1 text-sm py-2 bg-gold text-gold-foreground rounded-lg font-semibold disabled:opacity-60"
            >
              {envoi ? "Envoi…" : partageCible || visibilite === "public" ? "Partager" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* Annotations de la page */}
      {annotationsPage.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            Annotations · page {page}
          </div>
          {annotationsPage.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-xl border border-slate-100 p-3 flex gap-2 items-start"
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: TEINTE[a.visibility] }}
              >
                {a.type === "highlight" ? (
                  <Highlighter className="h-4 w-4 text-navy" />
                ) : (
                  <MessageSquare className="h-4 w-4 text-navy" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-slate-700 italic line-clamp-2">« {a.texte} »</div>
                {a.note && <div className="text-[12px] text-navy mt-1">{a.note}</div>}
                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  {a.partageAvecUserId ? (
                    <>
                      <Users className="h-2.5 w-2.5" /> Avec {a.partageAvecNom ?? "—"} ·{" "}
                      {a.auteurNom ?? "—"}
                    </>
                  ) : a.visibility === "private" ? (
                    <>
                      <Lock className="h-2.5 w-2.5" /> Privé
                    </>
                  ) : (
                    <>
                      <Users className="h-2.5 w-2.5" /> Partagé · {a.auteurNom ?? "—"}
                    </>
                  )}
                </div>
              </div>
              {a.userId === userId && (
                <button
                  onClick={() => supprimer(a.id)}
                  className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 flex items-center justify-center shrink-0"
                  aria-label="Supprimer l'annotation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
