import { useRef, useState } from "react";
import {
  File,
  Upload,
  Loader2,
  Trash2,
  Download,
  GripVertical,
  CheckCircle2,
  X,
} from "lucide-react";
import { TYPE_LABEL } from "@/lib/doc-types";
import { fileIcon, formatBytes, type DocLike } from "@/lib/doc-files";

// Les documents se déposent désormais pendant la création de la réunion (étape
// « Ordre du jour & documents » du MeetingCreator). Ce module ne porte plus de
// panneau autonome : il expose les briques de dépôt réutilisées par ce wizard —
// un fichier n'existe en base qu'une fois la réunion créée.

// Zone d'envoi « Mes fichiers » : accepte les fichiers de l'OS et récupère un
// document relâché depuis un point (= le détacher).
export function UploadDropzone({
  uploading,
  onFiles,
  onDropDoc,
}: {
  uploading: boolean;
  onFiles: (files: FileList | null) => void;
  onDropDoc: (docId: string) => void;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const docId = e.dataTransfer.getData("docId");
        if (docId) onDropDoc(docId);
        else onFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${
        over ? "border-gold bg-gold/5" : "border-border hover:border-gold/50 bg-card"
      }`}
    >
      <div className="h-12 w-12 rounded-2xl bg-navy text-gold mx-auto flex items-center justify-center">
        {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
      </div>
      <div className="mt-3 text-sm font-semibold text-navy">
        {uploading ? "Envoi en cours…" : "Glissez des fichiers ici"}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        ou cliquez pour parcourir — tous formats, images comprises (25 Mo max)
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

// Ligne fichier (colonne « Mes fichiers ») — glissable vers un point.
export function FileRow({
  doc,
  onDownload,
  onRemove,
}: {
  doc: DocLike;
  onDownload?: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("docId", doc.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-gold/60 hover:shadow-sm transition cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        {fileIcon(doc.type, "h-4 w-4")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-navy truncate">{doc.nom}</div>
        <div className="text-[13px] text-muted-foreground truncate">
          {formatBytes(doc.tailleBytes)} · {TYPE_LABEL[doc.type]}
        </div>
      </div>
      {onDownload && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          title="Télécharger"
          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Retirer le document"
        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

// Zone de dépôt d'un point de l'ordre du jour.
export function PointDropZone({
  pointNumber,
  title,
  optional,
  docs,
  onFiles,
  onDropDoc,
  onUnassign,
  onDownload,
}: {
  pointNumber: number;
  title: string;
  optional: boolean;
  docs: DocLike[];
  onFiles: (files: FileList | null) => void;
  onDropDoc: (docId: string) => void;
  onUnassign: (docId: string) => void;
  onDownload?: (d: DocLike) => void;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const has = docs.length > 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
        e.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const docId = e.dataTransfer.getData("docId");
        if (docId) onDropDoc(docId);
        else onFiles(e.dataTransfer.files);
      }}
      className={`rounded-2xl border bg-card p-4 transition ${
        over
          ? "border-gold ring-2 ring-gold/40 bg-gold/5"
          : has
            ? "border-emerald-300"
            : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
            Point {pointNumber}
            {optional ? " · Optionnel" : ""}
          </div>
          <div className="font-semibold text-navy mt-0.5 truncate">{title}</div>
        </div>
        {has ? (
          <span className="inline-flex items-center gap-1 text-[13px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 shrink-0">
            <CheckCircle2 className="h-3 w-3" /> {docs.length}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[13px] rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 shrink-0">
            <X className="h-3 w-3" /> Aucun
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      {has ? (
        <div className="mt-3 space-y-2">
          {docs.map((d) => (
            <div
              key={d.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("docId", d.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5 cursor-grab active:cursor-grabbing"
            >
              <GripVertical
                className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                aria-hidden="true"
              />
              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                {fileIcon(d.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-navy truncate">{d.nom}</div>
                <div className="text-[13px] text-muted-foreground">
                  {formatBytes(d.tailleBytes)} · {TYPE_LABEL[d.type]}
                </div>
              </div>
              {onDownload && (
                <button
                  onClick={() => onDownload(d)}
                  title="Télécharger"
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onUnassign(d.id)}
                title="Retirer de ce point (le fichier reste dans Mes fichiers)"
                className="p-1.5 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full mt-1 inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-navy rounded-lg border border-dashed border-border py-2 hover:border-gold/60"
          >
            <Upload className="h-3.5 w-3.5" /> + Ajouter un autre document
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-border hover:border-gold/60 p-4 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2"
        >
          <Upload className="h-4 w-4" /> Déposez un fichier ici ou cliquez pour parcourir
        </button>
      )}
    </div>
  );
}

// =============================================================
// Exports partagés par les autres panneaux du Secrétariat
// =============================================================
// En-tête de panneau. La réunion traitée n'y est PAS répétée : la barre de contexte
// collante de SectionBrowser la porte déjà (titre, type, statut, date, lieu), et
// l'écrire deux fois brouillait la hiérarchie de la page.
export function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">{title}</h1>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

export function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <File className="h-10 w-10 text-muted-foreground mx-auto" />
      <div className="mt-3 text-sm text-muted-foreground">
        Aucune réunion ouverte. Revenez à la grille des réunions, ou créez-en une depuis « Créer une
        réunion ».
      </div>
    </div>
  );
}
