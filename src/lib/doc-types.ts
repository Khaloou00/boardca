import type { DocType } from "@/types/domain";

// L'upload accepte TOUS les formats. L'extension sert seulement à ranger le
// fichier dans une famille d'affichage ; un format inconnu tombe sur `autre`,
// il reste consultable via une URL signée.
const EXT_TO_TYPE: Record<string, DocType> = {
  pdf: "pdf",
  doc: "docx",
  docx: "docx",
  odt: "docx",
  rtf: "docx",
  ppt: "pptx",
  pptx: "pptx",
  odp: "pptx",
  xls: "xlsx",
  xlsx: "xlsx",
  csv: "xlsx",
  ods: "xlsx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  svg: "image",
  heic: "image",
  heif: "image",
  tif: "image",
  tiff: "image",
};

export function extensionDe(nom: string): string {
  return nom.split(".").pop()?.toLowerCase() ?? "";
}

/** Type d'affichage d'un fichier, d'après son extension puis son type MIME. */
export function docTypeDepuisFichier(nom: string, mime?: string): DocType {
  const parExt = EXT_TO_TYPE[extensionDe(nom)];
  if (parExt) return parExt;
  // Repli sur le MIME : une image sans extension reste une image.
  if (mime?.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return "autre";
}

/** Normalise une valeur venue de la base (texte libre) vers un DocType connu. */
export function normaliserDocType(valeur: string): DocType {
  return valeur === "pdf" ||
    valeur === "docx" ||
    valeur === "pptx" ||
    valeur === "xlsx" ||
    valeur === "image"
    ? valeur
    : "autre";
}

export const TYPE_LABEL: Record<DocType, string> = {
  pdf: "PDF",
  docx: "Document",
  pptx: "Présentation",
  xlsx: "Tableau",
  image: "Image",
  autre: "Fichier",
};

/** Pastille d'extension affichée dans les listes (Board Book mobile). */
export const TYPE_BADGE: Record<DocType, { bg: string; label: string }> = {
  pdf: { bg: "bg-[#DC2626]", label: "PDF" },
  docx: { bg: "bg-[#2563EB]", label: "DOC" },
  pptx: { bg: "bg-[#EA580C]", label: "PPT" },
  xlsx: { bg: "bg-[#16A34A]", label: "XLS" },
  image: { bg: "bg-[#7C3AED]", label: "IMG" },
  autre: { bg: "bg-[#64748B]", label: "FIC" },
};
