import { useEffect, useMemo, useState } from "react";
import { sha256 } from "js-sha256";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { Header, Empty } from "./documents-panel";
import { toast } from "sonner";
import { exportSignedPvPdf } from "@/lib/pdf-export";
import { RichTextEditor } from "./rich-text-editor";
import { genererPv, MODELES_PV, type ModelePv } from "@/lib/pv-templates";
import { htmlVersTexte, versHtml, pvEstVide } from "@/lib/pv-format";
import { useSuiviSignature } from "./signature-tracker";
import { fetchPvObservations, type PvObservation } from "@/lib/pv-observations";
import { fetchAnnotations, type DocAnnotation } from "@/lib/annotations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Save,
  FileCheck2,
  Wand2,
  PenLine,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  FileDown,
  Lock,
  Crown,
  FileText,
  ArrowRight,
  AlertTriangle,
  ThumbsDown,
  MessageSquare,
  Highlighter,
  Users,
  Clock,
} from "lucide-react";

export function PVPanel() {
  // Onglets : rédaction/signature du PV courant, ou archive des PV scellés.
  const {
    reunions,
    reunionActiveId,
    presences,
    procurations,
    votes,
    users,
    pvs,
    convocations,
    usersLoading,
    presencesLoading,
    pvLoading,
  } = useBoardStore(
    useShallow((s) => ({
      reunions: s.reunions,
      reunionActiveId: s.reunionActiveId,
      presences: s.presences,
      procurations: s.procurations,
      votes: s.votes,
      users: s.users,
      pvs: s.pvs,
      convocations: s.convocations,
      usersLoading: s.usersLoading,
      presencesLoading: s.presencesLoading,
      pvLoading: s.pvLoading,
    })),
  );
  // Tant que ces fetches n'ont pas au moins tourné une fois, les dérivés (présents,
  // signatures, statut PCA) ne sont pas fiables — voir le même garde-fou côté mobile.
  const pvDataReady = !usersLoading && !presencesLoading && !pvLoading && users.length > 0;
  const ensurePV = useBoardStore((s) => s.ensurePV);
  const updatePVContent = useBoardStore((s) => s.updatePVContent);
  const sendForSignature = useBoardStore((s) => s.sendForSignature);

  // Le suivi des signatures est un widget FLOTTANT et persistant : un PV n'est pas
  // signé dans la minute, la Secrétaire doit pouvoir aller travailler ailleurs.
  const suivreSignatures = useSuiviSignature((s) => s.suivre);

  const [content, setContent] = useState("");
  const [modeleOuvert, setModeleOuvert] = useState(false);
  // Modèle en attente de confirmation quand un PV est déjà en cours de rédaction
  // — remplace l'ancien `window.confirm` par une popup cohérente avec le reste
  // de l'app (voir les dialogues de confirmation de l'Émargement).
  const [modeleConfirm, setModeleConfirm] = useState<ModelePv | null>(null);
  const [sending, setSending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");

  // La réunion traitée est celle ouverte dans la grille de la section (SectionBrowser
  // la pose comme réunion active) : ce panneau ne choisit plus de défaut lui-même,
  // il écraserait le choix de la Secrétaire au montage.
  const reunion = reunions.find((r) => r.id === reunionActiveId);

  useEffect(() => {
    if (reunionActiveId) ensurePV(reunionActiveId);
  }, [reunionActiveId, ensurePV]);

  const pv = pvs.find((p) => p.reunionId === reunionActiveId);

  useEffect(() => {
    // Un PV rédigé avant l'éditeur riche est du texte brut : `versHtml` le remonte
    // en HTML sans en perdre les sauts de ligne.
    setContent(versHtml(pv?.contenu ?? ""));
  }, [pv?.id, pv?.contenu]);

  // Désapprobations/observations (pv_observations) et annotations du PDF (annotations,
  // cible pvId) laissées par les membres du CA — jusqu'ici invisibles côté Secrétariat,
  // qui ne voyait que le statut "En attente" des signatures sans jamais savoir POURQUOI
  // un membre n'avait pas encore signé.
  const [observations, setObservations] = useState<PvObservation[]>([]);
  const [pvAnnotations, setPvAnnotations] = useState<DocAnnotation[]>([]);
  const pvId = pv?.id ?? null;
  useEffect(() => {
    if (!pvId) {
      setObservations([]);
      setPvAnnotations([]);
      return;
    }
    let annule = false;
    Promise.all([fetchPvObservations(pvId), fetchAnnotations({ pvId })]).then(
      ([obs, annos]) => {
        if (annule) return;
        setObservations(obs);
        setPvAnnotations(annos);
      },
    );
    return () => {
      annule = true;
    };
  }, [pvId]);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const currentPCA = users.find((u) => u.estPresidentCA);

  const reunionPresences = presences.filter((p) => p.reunionId === reunionActiveId);
  const presentUsers = reunionPresences
    .map((p) => usersById[p.userId])
    .filter((u): u is NonNullable<typeof u> => !!u);

  // Un renvoi (RPC `renvoyer_pv`, bouton "Renvoyer pour signature") incrémente
  // `pv.version` : les signatures d'une version antérieure restent en base
  // (immuables) mais ne comptent plus — chacun doit resigner la version courante.
  const signaturesCourantes = (pv?.signatures ?? []).filter((s) => s.pvVersion === pv?.version);
  const signedIds = new Set(signaturesCourantes.map((s) => s.userId));
  const signedCount = signedIds.size;
  const totalPresents = presentUsers.length;

  const pcaPresent = !!currentPCA && reunionPresences.some((p) => p.userId === currentPCA.id);
  const pcaSigned = !!currentPCA && signedIds.has(currentPCA.id);

  // Présidence prévue pour cette réunion (déclarative — via convocation/délégation,
  // distincte du sceau effectif qui dépend de la présence réelle le jour J).
  const pcaConvocation = currentPCA
    ? convocations.find((c) => c.reunionId === reunionActiveId && c.userId === currentPCA.id)
    : undefined;
  const delegateUser = reunion?.presidentSeanceId
    ? usersById[reunion.presidentSeanceId]
    : undefined;
  const chairLine =
    !pcaConvocation || pcaConvocation.statut !== "excused"
      ? currentPCA
        ? `Présidence : ${currentPCA.nom} (titulaire)`
        : null
      : delegateUser
        ? `Présidence déléguée à ${delegateUser.nom} pour cette séance`
        : "Présidence à confirmer (titulaire excusé, aucun délégué désigné)";
  const nonPcaPresentUsers = presentUsers.filter((u) => u.id !== currentPCA?.id);
  // .every() sur un tableau vide renvoie true par vacuité : ne jamais en déduire
  // "tout le monde a signé" tant que les présences n'ont pas fini de charger.
  const nonPcaAllSigned =
    nonPcaPresentUsers.length > 0 && nonPcaPresentUsers.every((u) => signedIds.has(u.id));

  type StatusBadge = "signe" | "waiting_pca" | "signing" | null;
  const statusBadge: StatusBadge = !pvDataReady
    ? null
    : pv?.statut === "signe"
      ? "signe"
      : pv?.statut === "en_signature"
        ? nonPcaAllSigned && pcaPresent && !pcaSigned
          ? "waiting_pca"
          : "signing"
        : null;

  if (!reunion) return <Empty />;

  // Applique un des trois modèles (voir `pv-templates.ts` et Trame.docx). Le modèle est
  // pré-rempli avec ce que la base sait déjà ; ce qu'elle ne sait pas reste marqué
  // « [À rédiger par le Secrétaire] ».
  const appliquerModele = (modele: ModelePv) => {
    setContent(
      genererPv(modele, {
        reunion,
        presents: presentUsers,
        presences: reunionPresences,
        procurations: procurations.filter((p) => p.reunionId === reunion.id),
        usersById,
        pca: currentPCA,
        presidentSeance: delegateUser,
        votes: votes.filter((v) => v.reunionId === reunion.id),
      }),
    );
    setModeleOuvert(false);
    setModeleConfirm(null);
    toast.success("Modèle appliqué", {
      description:
        "Les données de la séance ont été reprises ; complétez les parties rédactionnelles.",
    });
  };

  // Un PV déjà rédigé mérite une confirmation explicite avant d'être écrasé ;
  // un éditeur vide n'a rien à perdre, on applique directement.
  const choisirModele = (modele: ModelePv) => {
    if (!pvEstVide(content)) {
      setModeleConfirm(modele);
      return;
    }
    appliquerModele(modele);
  };

  const save = async () => {
    if (!pv) return;
    try {
      await updatePVContent(pv.id, content);
      toast.success("PV enregistré");
    } catch {
      toast.error("Échec de l'enregistrement du PV");
    }
  };

  const openSign = async () => {
    if (!pv) return;
    if (pvEstVide(content)) return toast.error("Rédigez le PV avant l'envoi");
    setSending(true);
    try {
      await updatePVContent(pv.id, content);
      await sendForSignature(pv.id);
      suivreSignatures(reunion.id);
      toast.success("PV envoyé pour signature certifiée", {
        description:
          "Les membres signent depuis leur mobile. Le suivi reste affiché en bas à droite pendant que vous travaillez ailleurs.",
      });
    } catch {
      toast.error("Échec de l'envoi pour signature");
    } finally {
      setSending(false);
    }
  };

  const exportPdf = async () => {
    if (!pv || pv.statut !== "signe") return toast.error("Le PV doit être scellé avant l'export");
    if (pdfPassword.length < 4) return toast.error("Mot de passe : 4 caractères minimum");
    setExporting(true);
    try {
      // Sur le document final, seule la signature du PCA vaut signature qualifiée :
      // les signatures des membres ne sont que des approbations et n'y figurent pas.
      // Filtré sur la version qui a scellé le PV — une manche antérieure (avant un
      // renvoi) ne doit jamais apparaître sur le document final.
      const sigs = pv.signatures
        .filter((s) => s.pvVersion === pv.version && usersById[s.userId]?.estPresidentCA)
        .map((s) => ({
          name: usersById[s.userId]?.nom ?? "Président du Conseil",
          at: new Date(s.signedAt).toLocaleString("fr-FR"),
          image: s.imageBase64,
        }));
      // jsPDF écrit du texte, pas du HTML : on aplatit la mise en forme en gardant
      // la structure (titres en majuscules, puces, sauts de ligne).
      const texte = htmlVersTexte(content);
      const sealHash = pv.hashDocument ?? `sha256:${sha256(`${pv.id}|${texte}|${signedCount}`)}`;
      const res = exportSignedPvPdf({
        meetingTitle: reunion.titre,
        meetingDate: new Date(reunion.date).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        meetingLocation: reunion.lieu ?? "—",
        content: texte,
        signatures: sigs,
        sealHash,
        sealedAt: new Date().toLocaleString("fr-FR"),
        password: pdfPassword,
      });
      toast.success("PDF chiffré téléchargé", {
        description: "Ouvrable uniquement avec le mot de passe.",
      });
    } catch {
      toast.error("Échec de l'export PDF chiffré");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <Header title="Procès-verbal" subtitle="Rédaction et envoi pour signature certifiée." />

      {chairLine && (
        <div className="mt-3 rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-600 flex items-center gap-1.5">
          <Crown className="h-3.5 w-3.5 text-gold shrink-0" /> {chairLine}
        </div>
      )}

      {statusBadge === "signing" && (
        <div className="mt-4 rounded-xl bg-gold/10 border border-gold/30 px-4 py-3 flex items-center gap-2 text-sm text-navy">
          <Loader2 className="h-4 w-4 text-gold animate-spin" /> Signatures en cours ({signedCount}/
          {totalPresents})
        </div>
      )}
      {statusBadge === "waiting_pca" && (
        <div className="mt-4 rounded-xl bg-gold/10 border border-gold/30 px-4 py-3 flex items-center gap-2 text-sm text-navy">
          <Crown className="h-4 w-4 text-gold" /> En attente du sceau du PCA — {currentPCA?.nom}
        </div>
      )}
      {statusBadge === "signe" && (
        <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> PV scellé
          {currentPCA ? ` — ${currentPCA.nom}` : ""}
          {signaturesCourantes.length
            ? ` · ${new Date(
                Math.max(...signaturesCourantes.map((s) => new Date(s.signedAt).getTime())),
              ).toLocaleString("fr-FR")}`
            : ""}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setModeleOuvert(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-navy text-navy-foreground px-4 py-2 text-sm hover:bg-navy-light focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" /> Choisir un modèle de PV
        </button>
        <button
          onClick={save}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <Save className="h-4 w-4" aria-hidden="true" /> Enregistrer
        </button>
        {pv?.statut !== "signe" && (
          <button
            onClick={openSign}
            disabled={sending}
            aria-busy={sending}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-gold text-gold-foreground px-4 py-2 text-sm font-semibold hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PenLine className="h-4 w-4" aria-hidden="true" />
            )}
            {sending
              ? "Envoi en cours…"
              : pv?.statut === "en_signature"
                ? "Renvoyer pour signature"
                : "Envoyer pour signature"}
          </button>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-navy">
          <ClipboardList className="h-4 w-4" aria-hidden="true" /> Éditeur PV
        </div>
        {/* Le PV n'est plus du texte brut : la mise en forme (titres, gras, listes,
            alignement) est conservée en HTML, et aplatie en texte structuré au moment
            de l'export PDF et du sceau. */}
        <RichTextEditor
          value={content}
          onChange={setContent}
          disabled={pv?.statut === "signe"}
          placeholder="Commencez à rédiger, ou cliquez sur « Choisir un modèle de PV »…"
        />
        {pv?.statut === "signe" && (
          <div className="mt-2 flex items-center gap-1.5 text-[14px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Le PV est scellé : son contenu ne peut plus être
            modifié.
          </div>
        )}
      </div>

      {/* Observations, désapprobations et annotations laissées par les membres du CA sur
          ce PV — jusqu'ici invisibles côté Secrétariat. Permet de savoir POURQUOI un
          membre n'a pas encore signé, de corriger le contenu en conséquence, puis de
          renvoyer pour signature (bouton dynamique ci-dessus, voir `openSign`). */}
      {(observations.length > 0 || pvAnnotations.length > 0) && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/40 overflow-hidden">
          <div className="border-b border-red-200 bg-red-100/60 px-4 py-2 text-xs font-semibold uppercase text-red-800 flex items-center gap-2">
            <ThumbsDown className="h-4 w-4" aria-hidden="true" /> Observations du Conseil sur ce PV
            ({observations.length + pvAnnotations.length})
          </div>
          <div className="p-4 space-y-3">
            {observations.map((o) => {
              // Une désapprobation d'une manche révolue (avant un renvoi) reste
              // visible pour l'historique, mais n'est plus "active" — elle ne
              // bloque plus rien côté membre (voir `monObservation` mobile).
              const traitee = o.pvVersion !== pv?.version;
              return (
                <div
                  key={o.id}
                  className={`rounded-lg border p-3 text-sm ${traitee ? "border-slate-200 bg-slate-50/60 opacity-70" : o.type === "desapprobation" ? "border-red-300 bg-white" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${o.type === "desapprobation" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      {o.type === "desapprobation" ? "Désapprouve" : "Observation"}
                    </span>
                    <span className="font-semibold text-navy">{o.auteurNom ?? "—"}</span>
                    {traitee && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Traitée (version {o.pvVersion})
                      </span>
                    )}
                    <span className="ml-auto text-[12px] text-slate-400">
                      {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="mt-1.5 text-slate-700 whitespace-pre-wrap">{o.texte}</div>
                </div>
              );
            })}
            {pvAnnotations.map((a) => {
              // Même règle que les observations : une annotation posée sur une
              // version antérieure reste consultable ici (c'est le plan de
              // travail du Secrétariat) mais est marquée comme déjà traitée.
              const traitee = a.pvVersion !== undefined && a.pvVersion !== pv?.version;
              return (
                <div
                  key={a.id}
                  className={`rounded-lg border p-3 text-sm ${traitee ? "border-slate-200 bg-slate-50/60 opacity-70" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {a.type === "comment" ? (
                        <MessageSquare className="h-3 w-3" />
                      ) : (
                        <Highlighter className="h-3 w-3" />
                      )}
                      {a.type === "comment" ? "Commentaire" : "Surlignage"}
                    </span>
                    <span className="font-semibold text-navy">{a.auteurNom ?? "—"}</span>
                    {a.visibility === "public" && !traitee && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-semibold">
                        <Users className="h-3 w-3" /> Partagé
                      </span>
                    )}
                    {traitee && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Traitée (version {a.pvVersion})
                      </span>
                    )}
                    <span className="ml-auto text-[12px] text-slate-400">
                      page {a.page} · {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="mt-1.5 italic text-slate-600">« {a.texte} »</div>
                  {a.note && <div className="mt-1 text-navy">{a.note}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sélecteur des trois modèles de procès-verbal (voir Trame.docx). */}
      <Dialog open={modeleOuvert} onOpenChange={setModeleOuvert}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choisir un modèle de procès-verbal</DialogTitle>
            <DialogDescription>
              Le modèle est pré-rempli avec les données de la séance — présences, quorum, ordre du
              jour, scrutins. Les parties rédactionnelles (exposé, débats) restent à votre plume.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            {MODELES_PV.map((m) => (
              <button
                key={m.cle}
                onClick={() => choisirModele(m.cle)}
                className="group flex flex-col rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-gold">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="mt-3 text-[12px] font-bold uppercase tracking-wider text-gold">
                  {m.sousTitre}
                </div>
                <div className="mt-0.5 font-bold leading-snug text-navy">{m.nom}</div>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted-foreground">
                  {m.quand}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[13px]">
                  <span className="text-muted-foreground">{m.longueur}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-navy transition group-hover:text-gold">
                    Utiliser <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation de remplacement — un PV déjà rédigé ne doit pas être écrasé
          par un clic malheureux sur un autre modèle. */}
      <Dialog open={modeleConfirm !== null} onOpenChange={(o) => !o && setModeleConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500" /> Remplacer le procès-verbal en
              cours ?
            </DialogTitle>
            <DialogDescription>
              Le contenu déjà rédigé sera intégralement remplacé par le modèle «{" "}
              <strong className="text-navy">
                {MODELES_PV.find((m) => m.cle === modeleConfirm)?.nom}
              </strong>{" "}
              ». Cette action n'est pas réversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setModeleConfirm(null)}
              className="px-4 py-2 text-sm text-muted-foreground"
            >
              Annuler
            </button>
            <button
              onClick={() => modeleConfirm && appliquerModele(modeleConfirm)}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <Wand2 className="h-4 w-4" /> Remplacer par ce modèle
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {signedCount > 0 && (
        <div className="mt-4 rounded-2xl bg-card border border-border overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase text-navy flex items-center justify-between">
            <span className="flex items-center gap-2">
              <PenLine className="h-4 w-4" aria-hidden="true" /> Signatures des Conseillers
            </span>
            <span className="text-[13px] text-slate-500 normal-case">
              {signedCount} / {totalPresents} reçues · eIDAS qualifié
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-white">
            {signaturesCourantes.map((sig) => {
              const signer = usersById[sig.userId];
              return (
                <div key={sig.id} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                  {sig.imageBase64 && (
                    <div className="rounded-md bg-white border border-slate-200 flex items-center justify-center py-2">
                      <img
                        src={sig.imageBase64}
                        alt={`Signature de ${signer?.nom ?? ""}`}
                        className="h-16 object-contain"
                      />
                    </div>
                  )}
                  <div className="mt-2 text-sm font-semibold text-navy leading-tight flex items-center gap-1.5">
                    {signer?.nom ?? "Signataire"}
                    {signer?.estPresidentCA && <Crown className="h-3.5 w-3.5 text-gold" />}
                  </div>
                  <div className="text-[13px] text-slate-500">
                    {signer?.estPresidentCA
                      ? "Président du Conseil d'Administration"
                      : "Conseiller"}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[13px] text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Signé à{" "}
                    {new Date(sig.signedAt).toLocaleTimeString("fr-FR")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(pv?.statut === "en_signature" || pv?.statut === "signe") && (
        <div className="mt-4 rounded-2xl border border-border bg-white overflow-hidden">
          <div className="bg-navy text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-gold" aria-hidden="true" />
              <div>
                <div className="text-xs uppercase tracking-widest text-gold">
                  signature certifiée · suivi en direct
                </div>
                <div id="pv-sign-title" className="font-semibold">
                  {reunion.titre}
                </div>
              </div>
            </div>
            <button
              onClick={() => suivreSignatures(reunion.id)}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              Épingler en bas à droite
            </button>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-navy">Signatures reçues</span>
              <span className="font-bold text-navy" aria-live="polite">
                {signedCount} / {totalPresents}
              </span>
            </div>
            <div
              className="h-2 bg-slate-100 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalPresents}
              aria-valuenow={signedCount}
              aria-label="Progression des signatures"
            >
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: totalPresents ? `${(signedCount / totalPresents) * 100}%` : "0%",
                }}
              />
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Chaque membre signe depuis son mobile, à son rythme — cela peut prendre plusieurs
              jours. Ce bloc se met à jour en direct, et le suivi épinglé en bas à droite vous
              accompagne dans les autres onglets.
            </p>

            <ul
              className="mt-4 max-h-80 overflow-y-auto space-y-2"
              aria-label="Liste des signataires"
            >
              {presentUsers.map((s) => {
                const signed = signedIds.has(s.id);
                // Un membre qui a désapprouvé/émis une réserve n'est pas juste "pas
                // encore signé" — voir la même logique côté mobile (SignatureRow).
                // Filtré sur la manche courante : après un renvoi (RPC `renvoyer_pv`),
                // une désapprobation d'une version révolue ne doit plus s'afficher
                // comme bloquante, le membre repart sur "En attente" pour la nouvelle manche.
                const obsSigner = observations.find(
                  (o) => o.userId === s.id && o.pvVersion === pv?.version,
                );
                const statutLabel = signed
                  ? "Signé"
                  : obsSigner?.type === "desapprobation"
                    ? "Désapprouvé"
                    : obsSigner
                      ? "Réserve émise"
                      : "En attente…";
                return (
                  <li
                    key={s.id}
                    className={`rounded-lg border p-2.5 ${
                      signed
                        ? "border-emerald-200 bg-emerald-50/60"
                        : obsSigner
                          ? "border-red-200 bg-red-50/50"
                          : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-full bg-navy text-gold flex items-center justify-center font-semibold text-xs shrink-0"
                        aria-hidden="true"
                      >
                        {s.initiales}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-navy truncate flex items-center gap-1.5">
                          {s.nom}
                          {s.estPresidentCA && <Crown className="h-3.5 w-3.5 text-gold shrink-0" />}
                        </div>
                        <div
                          className={`text-[13px] ${obsSigner && !signed ? "text-red-600 font-semibold" : "text-slate-500"}`}
                        >
                          {statutLabel}
                        </div>
                      </div>
                      {signed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Signé" />
                      ) : obsSigner ? (
                        <ThumbsDown className="h-4 w-4 text-red-600" aria-label={statutLabel} />
                      ) : (
                        <Clock className="h-4 w-4 text-slate-400" aria-label="En attente" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {pv?.statut === "signe" && (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> PV intégralement signé —
                    Scellé
                  </div>
                </div>

                <div className="rounded-xl border border-navy/20 bg-navy/[0.03] p-4">
                  <div className="flex items-center gap-2 text-navy font-semibold text-sm">
                    <Lock className="h-4 w-4 text-gold" aria-hidden="true" /> Export PDF chiffré
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Définissez un mot de passe. Le PDF ne s'ouvrira qu'avec ce mot de passe.
                  </p>
                  <label htmlFor="pv-pdf-pw" className="sr-only">
                    Mot de passe du PDF
                  </label>
                  <input
                    id="pv-pdf-pw"
                    type="password"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    placeholder="Mot de passe (min. 4 caractères)"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  />
                  <button
                    onClick={exportPdf}
                    disabled={exporting || pdfPassword.length < 4}
                    aria-busy={exporting}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-navy text-white py-2.5 text-sm font-semibold hover:bg-navy-light disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileDown className="h-4 w-4" aria-hidden="true" />
                    )}
                    {exporting ? "Génération…" : "Télécharger le PDF chiffré"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {pv?.statut === "signe" && (
        <div
          className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-2 text-emerald-800 text-sm"
          role="status"
        >
          <FileCheck2 className="h-4 w-4" aria-hidden="true" /> PV scellé — retrouvez-le dans
          l'onglet Archives.
        </div>
      )}
    </div>
  );
}
