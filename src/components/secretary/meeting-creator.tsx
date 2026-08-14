import { useEffect, useMemo, useRef, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  CalendarDays,
  Users,
  ListOrdered,
  Sparkles,
  Loader2,
  Send,
  AlertTriangle,
  FileText,
  BookOpen,
  Layers,
  ShieldCheck,
  FileStack,
  Video,
} from "lucide-react";
import { UploadDropzone, FileRow, PointDropZone } from "@/components/secretary/documents-panel";
import { MAX_BYTES, fileIcon, formatBytes, type DocLike } from "@/lib/doc-files";
import { docTypeDepuisFichier } from "@/lib/doc-types";

const STEPS = [
  "Informations",
  "Ordre du jour & documents",
  "Participants",
  "Board Book",
  "Récapitulatif",
];
const DERNIERE_ETAPE = STEPS.length - 1;

// `obligatoire` = « ce point DOIT porter au moins un document pour que le Board
// Book soit compilable ». Décoché par défaut : créer un point de l'ordre du jour
// n'impose pas de joindre un fichier.
type AgendaDraft = { id: string; titre: string; dureeMin: number; obligatoire: boolean };

// Fichier retenu dans le navigateur tant que la réunion n'existe pas : il n'y a
// pas encore de `reunion_id` sur lequel accrocher le document ni de dossier de
// stockage. On l'envoie au moment du « Créer et convoquer », une fois les points
// de l'ordre du jour insérés (leurs identifiants réels remplacent alors les
// identifiants de brouillon).
type StagedFile = DocLike & { file: File; pointDraftId: string | null };

export function MeetingCreator({ onCreated }: { onCreated: (id: string) => void }) {
  const { users } = useBoardStore(useShallow((s) => ({ users: s.users })));
  const addReunion = useBoardStore((s) => s.addReunion);
  const addPointsOJ = useBoardStore((s) => s.addPointsOJ);
  const addDocument = useBoardStore((s) => s.addDocument);
  const generateBoardBook = useBoardStore((s) => s.generateBoardBook);
  const generateBoardBookPdf = useBoardStore((s) => s.generateBoardBookPdf);
  const sendConvocations = useBoardStore((s) => s.sendConvocations);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"ca_ordinaire" | "ca_extraordinaire">("ca_ordinaire");
  const [date, setDate] = useState("");
  // "YYYY-MM-DD" local (jamais un objet Date) : même convention que `Reunion.date`
  // et que les filtres « séance à venir » du mobile, donc les comparaisons de
  // chaînes sont exactes et insensibles au fuseau.
  const aujourdhui = new Date().toLocaleDateString("en-CA");
  const [time, setTime] = useState(""); // saisi, jamais suggéré
  const [location, setLocation] = useState("");
  // Lien de visioconférence : facultatif, mais s'il est saisi il doit être une URL —
  // la contrainte SQL rejette tout le reste, autant le dire ici.
  const [lienVisio, setLienVisio] = useState("");
  const lienVisioValide = !lienVisio.trim() || /^https?:\/\/\S+$/i.test(lienVisio.trim());

  const [agenda, setAgenda] = useState<AgendaDraft[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Documents en attente d'envoi, rattachés (ou non) à un point de l'OJ.
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const stagedByPoint = useMemo(() => {
    const map: Record<string, StagedFile[]> = {};
    for (const f of staged) if (f.pointDraftId) (map[f.pointDraftId] ??= []).push(f);
    return map;
  }, [staged]);
  const nonRattaches = useMemo(() => staged.filter((f) => !f.pointDraftId), [staged]);

  const ajouterFichiers = (files: FileList | null, pointDraftId: string | null) => {
    if (!files || files.length === 0) return;
    const retenus: StagedFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(`« ${file.name} » dépasse 25 Mo`);
        continue;
      }
      retenus.push({
        id: crypto.randomUUID(),
        nom: file.name,
        // Tous les formats sont acceptés : le type ne sert qu'à l'icône et au mode
        // de lecture dans le Board Book.
        type: docTypeDepuisFichier(file.name, file.type),
        tailleBytes: file.size,
        file,
        pointDraftId,
      });
    }
    if (retenus.length > 0) setStaged((s) => [...s, ...retenus]);
  };

  const rattacher = (docId: string, pointDraftId: string | null) =>
    setStaged((s) => s.map((f) => (f.id === docId ? { ...f, pointDraftId } : f)));
  const retirerFichier = (docId: string) => setStaged((s) => s.filter((f) => f.id !== docId));

  // ── Board Book ───────────────────────────────────────────────
  // Le Board Book n'est pas un document unique : c'est le FORMAT du recueil —
  // l'ordre du jour, et sous chaque point les documents qui s'y rattachent, chaque
  // pièce restant un fichier ouvert séparément par le membre. Cette étape en montre
  // le sommaire exact. La publication (qui scelle la liste des pièces et notifie le
  // Conseil) ne peut se faire qu'une fois la réunion et ses documents en base : elle
  // part au « Créer et convoquer », juste avant les convocations.
  const [bbPrepare, setBbPrepare] = useState(false);
  const [bbBusy, setBbBusy] = useState(false);

  const totalBytes = useMemo(() => staged.reduce((a, f) => a + f.tailleBytes, 0), [staged]);
  const pointsCouverts = agenda.filter((p) => (stagedByPoint[p.id]?.length ?? 0) > 0).length;
  const pctCouverture = agenda.length ? Math.round((pointsCouverts / agenda.length) * 100) : 0;
  const pointsObligatoiresManquants = agenda.filter(
    (p) => p.obligatoire && (stagedByPoint[p.id]?.length ?? 0) === 0,
  );
  const bbPret = agenda.length > 0 && pointsObligatoiresManquants.length === 0;

  // Tout changement de l'ordre du jour ou des documents périme l'aperçu validé.
  useEffect(() => {
    setBbPrepare(false);
  }, [agenda, staged]);

  const preparerBoardBook = async () => {
    if (!bbPret) return;
    setBbBusy(true);
    // Assemblage du sommaire : purement local (rien n'existe encore en base).
    await new Promise((r) => setTimeout(r, 900));
    setBbBusy(false);
    setBbPrepare(true);
    toast.success("Board Book prêt", {
      description: "Il sera publié et notifié avec les convocations.",
    });
  };

  const administrateurs = users.filter((u) => u.role === "administrateur");
  // Par défaut, tous les administrateurs sont convoqués. On ne peut pas
  // l'initialiser via useState (les users peuvent charger APRÈS le montage) :
  // on garnit la sélection quand ils arrivent, tant que le Secrétaire n'a pas
  // lui-même modifié la liste.
  const [invitees, setInvitees] = useState<string[]>([]);
  const inviteesTouched = useRef(false);
  useEffect(() => {
    if (!inviteesTouched.current) {
      setInvitees(users.filter((u) => u.role === "administrateur").map((a) => a.id));
    }
  }, [users]);

  // Quorum : par défaut la majorité simple des membres du CA. Un quorum figé à 7
  // rendait la séance inquorable dès que le Conseil comptait moins de 7 membres.
  const [quorum, setQuorum] = useState(1);
  const quorumTouched = useRef(false);
  useEffect(() => {
    const n = users.filter((u) => u.role === "administrateur").length;
    if (!quorumTouched.current && n > 0) setQuorum(Math.floor(n / 2) + 1);
  }, [users]);

  const next = () => setStep((s) => Math.min(DERNIERE_ETAPE, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const addAgendaItem = () => {
    setAgenda((a) => [
      ...a,
      { id: `n${Date.now()}`, titre: "Nouveau point", dureeMin: 15, obligatoire: false },
    ]);
  };
  // Supprimer un point ne détruit pas ses fichiers : ils retournent dans « Mes
  // fichiers », prêts à être rattachés ailleurs.
  const removeAgendaItem = (id: string) => {
    setAgenda((a) => a.filter((x) => x.id !== id));
    setStaged((s) => s.map((f) => (f.pointDraftId === id ? { ...f, pointDraftId: null } : f)));
  };

  const onDragStart = (i: number) => setDragIdx(i);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) return;
    const nextArr = [...agenda];
    const [item] = nextArr.splice(dragIdx, 1);
    nextArr.splice(i, 0, item);
    setAgenda(nextArr);
    setDragIdx(null);
    toast.success("Ordre du jour réorganisé");
  };

  const create = async () => {
    if (busy) return;
    if (!title.trim()) return toast.error("Titre requis");
    if (!date) return toast.error("Choisissez la date de la réunion");
    // La colonne `heure` est de type `time` : une chaîne vide y est refusée par
    // Postgres et fait échouer toute la création.
    if (!time) return toast.error("Choisissez l'heure de la réunion");
    // Une séance datée dans le passé part quand même en convocation, mais elle est
    // ensuite filtrée partout (calendrier du mois courant, « séance à venir » et
    // convocations du mobile) : les membres reçoivent l'alerte sans rien voir.
    if (date < aujourdhui)
      return toast.error("Date déjà passée", {
        description:
          "Une séance convoquée à une date antérieure à aujourd'hui n'apparaîtra ni au calendrier ni chez les membres du CA.",
      });
    if (!lienVisioValide)
      return toast.error("Lien de visioconférence invalide", {
        description: "Il doit commencer par https://",
      });
    if (invitees.length === 0)
      return toast.error("Sélectionnez au moins un participant à convoquer");
    setBusy(true);
    try {
      setProgress("Création de la réunion…");
      const id = await addReunion({
        type,
        titre: title.trim(),
        date,
        heure: time,
        dureeMin: agenda.reduce((s, a) => s + a.dureeMin, 0),
        lieu: location,
        lienVisio: lienVisio.trim() || undefined,
        quorumRequis: quorum,
      });
      // Ordre du jour en un seul lot (ordre d'affichage conservé).
      await addPointsOJ(
        id,
        agenda.map((point) => ({
          titre: point.titre,
          dureeMin: point.dureeMin,
          obligatoire: point.obligatoire,
        })),
      );

      // Les points existent maintenant en base : `addPointsOJ` a rechargé les
      // réunions, on lit leurs identifiants réels dans l'ordre des positions pour
      // traduire les rattachements faits au glisser-déposer sur les brouillons.
      const points = useBoardStore.getState().reunions.find((r) => r.id === id)?.ordreDuJour ?? [];
      const idReelParBrouillon = Object.fromEntries(
        agenda.map((p, i) => [p.id, points[i]?.id ?? null]),
      ) as Record<string, string | null>;

      let envoyes = 0;
      for (const f of staged) {
        setProgress(`Envoi des documents… (${envoyes + 1}/${staged.length})`);
        const safe = f.nom.replace(/[^\w.-]+/g, "_");
        const path = `documents/${id}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage
          .from("boardca-docs")
          .upload(path, f.file, { contentType: f.file.type || undefined, upsert: false });
        if (error) {
          toast.error(`Échec de l'envoi : ${f.nom}`);
          continue;
        }
        await addDocument({
          reunionId: id,
          nom: f.nom,
          type: f.type,
          tailleBytes: f.tailleBytes,
          storagePath: path,
          pointOjId: f.pointDraftId ? idReelParBrouillon[f.pointDraftId] : null,
        });
        envoyes++;
      }

      // Board Book publié AVANT les convocations : les membres du CA doivent le
      // trouver déjà disponible en ouvrant leur convocation.
      let bbCompile = false;
      if (bbPret) {
        setProgress("Publication du Board Book…");
        try {
          bbCompile = !!(await generateBoardBook(id));
          if (bbCompile) {
            // On compile AUSSI le PDF unique et on le stocke : les membres du CA
            // pourront ainsi télécharger le recueil complet depuis leur convocation.
            // Un échec du PDF ne remet pas en cause la publication « fichiers séparés ».
            setProgress("Génération du PDF du Board Book…");
            await generateBoardBookPdf(id).catch(() => null);
          }
        } catch {
          bbCompile = false;
        }
        if (!bbCompile)
          toast.warning("Board Book non publié", {
            description: "La réunion est créée : publiez-le depuis la section Board Book.",
          });
      }

      // Chaque réunion créée envoie automatiquement les convocations aux invités.
      setProgress("Envoi des convocations…");
      await sendConvocations(id, invitees);
      toast.success("Réunion créée", {
        description: [
          `${invitees.length} convocation(s) envoyée(s)`,
          envoyes > 0 ? `${envoyes} document(s) déposé(s)` : null,
          bbCompile ? "Board Book publié" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
      onCreated(id);
    } catch (e: any) {
      // Ne jamais avaler l'erreur : un refus RLS (« violates row-level security
      // policy ») veut dire « mauvais compte », pas « bug de création ». Le
      // message générique envoyait chercher un bug inexistant.
      const brut = e?.message ?? String(e);
      const refusDroits = /row-level security|permission denied|policy/i.test(brut);
      toast.error(refusDroits ? "Droits insuffisants" : "Échec de la création de la réunion", {
        description: refusDroits
          ? "Votre compte n'est pas celui du Secrétariat. Reconnectez-vous en Secrétaire pour créer une réunion."
          : brut,
      });
      console.error("[MeetingCreator] création échouée :", e);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-widest text-gold">Préparation</div>
        <h1 className="text-3xl font-bold text-navy mt-1">Créer une réunion</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-3 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-3 flex-1">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? "bg-emerald-600 text-white" : i === step ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <div
              className={`text-sm ${i === step ? "font-semibold text-navy" : "text-muted-foreground"}`}
            >
              {s}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 ${i < step ? "bg-emerald-600" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-card border border-border p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-navy font-semibold">
              <CalendarDays className="h-5 w-5" /> Informations générales
            </div>
            <Field label="Titre de la réunion">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "ca_ordinaire" | "ca_extraordinaire")}
                  className="input"
                >
                  <option value="ca_ordinaire">Ordinaire</option>
                  <option value="ca_extraordinaire">Extraordinaire</option>
                </select>
              </Field>
              <Field label="Lieu">
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  min={aujourdhui}
                  onChange={(e) => setDate(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Heure">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label={`Quorum requis (sur ${administrateurs.length} membre(s))`}>
                <input
                  type="number"
                  min={1}
                  max={Math.max(administrateurs.length, 1)}
                  value={quorum}
                  onChange={(e) => {
                    quorumTouched.current = true;
                    setQuorum(Math.max(1, Number(e.target.value) || 1));
                  }}
                  className="input"
                />
              </Field>
            </div>

            <Field label="Lien de visioconférence (facultatif)">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Video className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="url"
                    inputMode="url"
                    value={lienVisio}
                    onChange={(e) => setLienVisio(e.target.value)}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    aria-invalid={!lienVisioValide}
                    className="input"
                    style={{ paddingLeft: "2.25rem" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLienVisio(genererLienMeetDemo());
                    toast.success("Lien Meet généré", {
                      description:
                        "Lien de démonstration (maquette) — remplacez-le par un vrai lien Meet en production.",
                    });
                  }}
                  className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-input px-3 text-sm font-medium hover:border-gold hover:bg-gold/5 transition"
                  title="Remplir avec un lien Meet de démonstration"
                >
                  <MeetLogo className="h-4 w-4" /> Créer un lien Meet
                </button>
              </div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                {lienVisioValide
                  ? "Le bouton remplit le champ avec un lien Meet de démonstration (maquette — pas une vraie réunion Google). Il partira dans la convocation pour permettre aux administrateurs de rejoindre la séance à distance."
                  : "Lien invalide : il doit commencer par https://"}
              </div>
            </Field>

            {administrateurs.length > 0 && quorum > administrateurs.length && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
                Le quorum dépasse le nombre de membres du CA : la séance ne pourra jamais être
                quorée.
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-navy font-semibold">
                <ListOrdered className="h-5 w-5" /> Ordre du jour ({agenda.length} points)
              </div>
              <button
                onClick={addAgendaItem}
                className="inline-flex items-center gap-1 rounded-lg bg-navy text-navy-foreground px-3 py-1.5 text-sm hover:bg-navy-light"
              >
                <Plus className="h-4 w-4" /> Ajouter un point
              </button>
            </div>
            <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-gold" /> Faites glisser les points pour les
              réordonner
            </div>
            {agenda.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
                <ListOrdered className="h-8 w-8 text-muted-foreground mx-auto" />
                <div className="mt-2 text-sm font-medium text-navy">
                  Aucun point à l'ordre du jour
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Ajoutez les points de cette séance, puis déposez les documents en dessous.
                </div>
                <button
                  onClick={addAgendaItem}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-navy text-navy-foreground px-3 py-1.5 text-sm hover:bg-navy-light"
                >
                  <Plus className="h-4 w-4" /> Ajouter le premier point
                </button>
              </div>
            )}
            <div className="space-y-2">
              {agenda.map((item, i) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStart(i)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(i)}
                  className={`group flex items-start gap-3 rounded-xl border-2 p-3 bg-background hover:border-gold transition cursor-move ${dragIdx === i ? "border-gold opacity-50" : "border-border"}`}
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
                  <div className="h-8 w-8 rounded-full bg-navy text-gold flex items-center justify-center font-bold text-sm shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-[1fr_120px] gap-2">
                    <input
                      value={item.titre}
                      onChange={(e) =>
                        setAgenda((a) =>
                          a.map((x) => (x.id === item.id ? { ...x, titre: e.target.value } : x)),
                        )
                      }
                      className="input"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.dureeMin}
                      onChange={(e) =>
                        setAgenda((a) =>
                          a.map((x) =>
                            x.id === item.id ? { ...x, dureeMin: Number(e.target.value) } : x,
                          ),
                        )
                      }
                      className="input"
                      placeholder="min"
                    />
                  </div>
                  <button
                    onClick={() => removeAgendaItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition text-destructive p-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Durée totale prévue :{" "}
              <span className="font-semibold text-navy">
                {agenda.reduce((s, a) => s + a.dureeMin, 0)} min
              </span>
            </div>

            {/* Documents de la séance — déposés ici, envoyés à la création. */}
            <div className="mt-8 border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-navy font-semibold">
                  <FileText className="h-5 w-5" /> Documents ({staged.length})
                </div>
                <div className="text-xs text-muted-foreground">
                  Glissez un fichier sur le point de l'ordre du jour qu'il documente
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* GAUCHE — Mes fichiers */}
                <section className="lg:col-span-2 space-y-4" aria-label="Mes fichiers">
                  <div className="text-[12px] uppercase tracking-widest text-gold">
                    Mes fichiers
                  </div>
                  <UploadDropzone
                    uploading={false}
                    onFiles={(files) => ajouterFichiers(files, null)}
                    onDropDoc={(docId) => rattacher(docId, null)}
                  />
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">
                      {nonRattaches.length} fichier{nonRattaches.length > 1 ? "s" : ""} non rattaché
                      {nonRattaches.length > 1 ? "s" : ""} · glissez-en un sur un point pour l'y
                      associer
                    </div>
                    <ul className="space-y-2">
                      {nonRattaches.length === 0 && (
                        <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                          Aucun fichier en attente de rattachement.
                        </li>
                      )}
                      {nonRattaches.map((f) => (
                        <FileRow key={f.id} doc={f} onRemove={() => retirerFichier(f.id)} />
                      ))}
                    </ul>
                  </div>
                </section>

                {/* DROITE — points de l'ordre du jour */}
                <section className="lg:col-span-3 space-y-3" aria-label="Points de l'ordre du jour">
                  <div className="text-[12px] uppercase tracking-widest text-gold">
                    Ordre du jour
                  </div>
                  {agenda.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-amber-800 text-sm flex gap-2 items-start">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      Ajoutez d'abord un point à l'ordre du jour : les documents s'y rattachent. Un
                      fichier peut aussi rester non rattaché.
                    </div>
                  ) : (
                    agenda.map((p, i) => (
                      <PointDropZone
                        key={p.id}
                        pointNumber={i + 1}
                        title={p.titre}
                        optional={!p.obligatoire}
                        docs={stagedByPoint[p.id] ?? []}
                        onFiles={(files) => ajouterFichiers(files, p.id)}
                        onDropDoc={(docId) => rattacher(docId, p.id)}
                        onUnassign={(docId) => rattacher(docId, null)}
                      />
                    ))
                  )}
                </section>
              </div>

              <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-[14px] text-muted-foreground">
                Les fichiers sont envoyés au moment du « Créer et convoquer » : ils seront
                immédiatement disponibles pour le Board Book.
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-center gap-2 text-navy font-semibold mb-4">
              <Users className="h-5 w-5" /> Participants convoqués ({invitees.length} /{" "}
              {administrateurs.length})
            </div>
            {administrateurs.length === 0 && (
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement des administrateurs…
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {administrateurs.map((a) => {
                const on = invitees.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${on ? "border-gold bg-gold/5" : "border-border hover:border-navy"}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        inviteesTouched.current = true;
                        setInvitees((v) =>
                          e.target.checked ? [...v, a.id] : v.filter((x) => x !== a.id),
                        );
                      }}
                      className="accent-gold h-4 w-4"
                    />
                    <div className="h-8 w-8 rounded-full bg-navy text-gold flex items-center justify-center font-semibold text-xs">
                      {a.initiales}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-navy truncate">{a.nom}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.qualite ?? "Membre du CA"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div className="flex items-center gap-2 text-navy font-semibold">
                <BookOpen className="h-5 w-5" /> Board Book
              </div>
              <div className="text-xs text-muted-foreground">
                L'ordre du jour et ses documents, tels que les membres les verront
              </div>
            </div>

            {/* Bandeau de publication */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div
                    className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      bbPrepare
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {bbPrepare ? (
                      <BookOpen className="h-6 w-6" />
                    ) : (
                      <FileStack className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-navy flex items-center gap-2">
                      {bbPrepare ? "Board Book prêt" : "Board Book à préparer"}
                      {bbPrepare && (
                        <span className="inline-flex items-center gap-1 text-[12px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <ShieldCheck className="h-3 w-3" /> Validé
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 max-w-md">
                      {bbPrepare
                        ? `${agenda.length} point(s) · ${staged.length} document(s) · ${formatBytes(totalBytes)}. Le recueil sera publié à la création : chaque pièce reste un fichier que le membre ouvre séparément.`
                        : bbPret
                          ? `Prêt à publier — ${staged.length} document(s), ${formatBytes(totalBytes)}.`
                          : agenda.length === 0
                            ? "Ajoutez au moins un point à l'ordre du jour : le recueil, c'est l'ordre du jour et ses documents."
                            : "Chaque point marqué « document requis » doit porter au moins un fichier."}
                    </div>
                  </div>
                </div>
                {bbPrepare && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Recueil prêt
                  </span>
                )}
              </div>

              {agenda.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Couverture de l'ordre du jour</span>
                    <span className="tabular-nums">
                      {pointsCouverts}/{agenda.length} point(s)
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full transition-all duration-500 ${bbPret ? "bg-emerald-500" : "bg-gold"}`}
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

            {/* Sommaire : le recueil tel qu'il sera assemblé */}
            <div className="mt-6 rounded-2xl border border-border bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between gap-2">
                <span className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Sommaire du recueil
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {title || "Réunion sans titre"}
                  {date
                    ? ` · ${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
                    : ""}
                </span>
              </div>
              {agenda.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Aucun point à l'ordre du jour : revenez à l'étape précédente.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {agenda.map((p, i) => {
                    const attaches = stagedByPoint[p.id] ?? [];
                    const manquant = attaches.length === 0;
                    return (
                      <li
                        key={p.id}
                        className={`px-4 py-3.5 ${manquant && p.obligatoire ? "bg-red-50/40" : ""}`}
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
                            <div className="truncate text-sm font-semibold text-navy">
                              {p.titre}
                            </div>
                            <div className="mt-0.5 text-[13px] text-muted-foreground">
                              {p.dureeMin} min
                            </div>
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
                                className="flex items-center gap-2 rounded-md px-2 py-1 text-[14px] text-muted-foreground"
                              >
                                {fileIcon(d.type, "h-3.5 w-3.5")}
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
                  {nonRattaches.length > 0 && (
                    <li className="px-4 py-3.5 bg-muted/30">
                      <div className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Annexes — {nonRattaches.length} document(s) non rattaché(s)
                      </div>
                      <ul className="mt-2 space-y-1">
                        {nonRattaches.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center gap-2 text-[14px] text-muted-foreground"
                          >
                            {fileIcon(d.type, "h-3.5 w-3.5")}
                            <span className="truncate text-navy/80">{d.nom}</span>
                            <span className="ml-auto shrink-0 tabular-nums">
                              {formatBytes(d.tailleBytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="text-navy font-semibold mb-4">Récapitulatif</div>
            <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-3 text-sm">
              <Row label="Titre" value={title} />
              <Row label="Type" value={type === "ca_ordinaire" ? "Ordinaire" : "Extraordinaire"} />
              <Row
                label="Date & heure"
                value={`${new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${time}`}
              />
              <Row label="Lieu" value={location} />
              <Row
                label="Visioconférence"
                value={lienVisio.trim() ? "Lien joint à la convocation" : "Aucun lien — présentiel"}
              />
              <Row
                label="Ordre du jour"
                value={`${agenda.length} points · ${agenda.reduce((s, a) => s + a.dureeMin, 0)} min`}
              />
              <Row
                label="Documents"
                value={
                  staged.length === 0
                    ? "Aucun"
                    : `${staged.length} fichier(s) · ${staged.length - nonRattaches.length} rattaché(s) à un point`
                }
              />
              <Row label="Participants convoqués" value={`${invitees.length} administrateurs`} />
              <Row
                label="Board Book"
                value={
                  bbPrepare
                    ? `Prêt · ${pointsCouverts}/${agenda.length} point(s) couvert(s) · ${formatBytes(totalBytes)}`
                    : bbPret
                      ? "Non préparé — sera publié quand même"
                      : "Non publiable (points obligatoires sans document)"
                }
              />
            </div>

            {!bbPrepare && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[15px] text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Le Board Book n'a pas été assemblé à l'étape précédente.{" "}
                  {bbPret
                    ? "Il sera tout de même publié à la création."
                    : "Il ne sera pas publié : les membres recevront la convocation sans recueil, à publier ensuite depuis la section Board Book."}
                </span>
              </div>
            )}

            <div className="mt-4 rounded-lg bg-gold/10 border border-gold/30 px-4 py-3 text-[15px] text-navy flex items-start gap-2">
              <Send className="h-4 w-4 text-gold shrink-0 mt-0.5" />
              <span>
                À la création : les documents sont envoyés, le Board Book est publié et son PDF
                complet généré, puis les {invitees.length} participants sélectionnés reçoivent leur
                convocation — recueil déjà consultable et téléchargeable en PDF.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          onClick={prev}
          disabled={step === 0 || busy}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-40 hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" /> Précédent
        </button>
        {step < DERNIERE_ETAPE ? (
          step === 3 ? (
            // Board Book : le bouton d'avancement GÉNÈRE le recueil (assemble le
            // sommaire), puis passe au récapitulatif. Le PDF, lui, est produit au
            // « Créer et convoquer », une fois la réunion en base.
            <button
              onClick={async () => {
                if (bbPret && !bbPrepare) await preparerBoardBook();
                next();
              }}
              disabled={busy || bbBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-navy text-navy-foreground px-6 py-2 font-semibold hover:bg-navy-light disabled:opacity-60"
            >
              {bbBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Layers className="h-4 w-4" />
              )}
              {bbBusy ? "Assemblage…" : "Générer le Board Book"}
            </button>
          ) : (
            <button
              onClick={next}
              disabled={busy || bbBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-navy text-navy-foreground px-6 py-2 font-semibold hover:bg-navy-light"
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          )
        ) : (
          <button
            onClick={create}
            disabled={busy || invitees.length === 0}
            title={invitees.length === 0 ? "Chargement des participants…" : undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-gold text-gold-foreground px-6 py-2 font-semibold hover:brightness-110 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {busy ? progress || "Création…" : "Créer et convoquer"}
          </button>
        )}
      </div>

      <style>{`.input { width:100%; border:1px solid var(--input); background:var(--background); border-radius:0.5rem; padding:0.5rem 0.75rem; font-size:0.875rem; }
      .input:focus { outline:none; box-shadow: 0 0 0 2px var(--gold); }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-navy uppercase tracking-wider">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-navy text-right">{value}</span>
    </div>
  );
}

// Lien Meet de DÉMONSTRATION (maquette) — pas une vraie réunion Google. Un
// vrai lien ne peut être obtenu que via l'API Google Calendar (OAuth + appel
// serveur) : le navigateur ne peut pas lire l'URL générée dans l'onglet Meet
// ouvert, protection inter-domaines infranchissable côté client. Même forme
// que les vrais liens (xxx-xxxx-xxx en minuscules) pour rester crédible en démo.
function genererLienMeetDemo(): string {
  const lettres = "abcdefghijklmnopqrstuvwxyz";
  const bloc = (n: number) =>
    Array.from({ length: n }, () => lettres[Math.floor(Math.random() * lettres.length)]).join("");
  return `https://meet.google.com/${bloc(3)}-${bloc(4)}-${bloc(3)}`;
}

// Logo Google Meet simplifié (couleurs officielles) — lucide-react n'a pas
// d'icône de marque, ce SVG reste reconnaissable en 16px dans le bouton.
function MeetLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#00832d" d="M12 10.5v6.75L4.5 15V9z" />
      <path fill="#0066da" d="M12 10.5 19.5 4v7z" />
      <path fill="#e94235" d="M12 10.5 19.5 4h-13.5L9 7z" />
      <path fill="#2684fc" d="M19.5 4v16l-7.5-6.75z" />
      <path fill="#00ac47" d="M4.5 15v4a1 1 0 0 0 1 1h5z" />
      <path fill="#ffba00" d="M4.5 9V6a1 1 0 0 1 1-1h3.5z" />
    </svg>
  );
}
