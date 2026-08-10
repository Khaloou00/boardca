import { File, FileText, FileSpreadsheet, Presentation, Image as ImageIcon } from "lucide-react";
import type { DocType } from "@/types/domain";

export const MAX_BYTES = 25 * 1024 * 1024;

// Forme minimale partagée par un fichier en attente d'envoi (wizard de création
// de réunion) et un document déjà enregistré en base.
export type DocLike = { id: string; nom: string; type: DocType; tailleBytes: number };

export function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

export function fileIcon(type: DocType, cls = "h-4 w-4") {
  if (type === "xlsx") return <FileSpreadsheet className={`${cls} text-emerald-600`} />;
  if (type === "pptx") return <Presentation className={`${cls} text-amber-600`} />;
  if (type === "image") return <ImageIcon className={`${cls} text-violet-600`} />;
  if (type === "autre") return <File className={`${cls} text-slate-500`} />;
  if (type === "docx") return <FileText className={`${cls} text-blue-600`} />;
  return <FileText className={`${cls} text-red-500`} />;
}
