import { jsPDF } from "jspdf";

// Export d'un tableau d'archives. Les données sont déjà aplaties en chaînes par
// l'appelant (colonne.valeur) : ce module ne connaît rien au métier.

export interface TableauExport {
  titre: string;
  sousTitre?: string;
  entetes: string[];
  lignes: string[][];
}

const horodatage = () => new Date().toISOString().slice(0, 10);

const nomFichier = (titre: string, ext: string) =>
  `${titre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents décomposés
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${horodatage()}.${ext}`;

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

/** Point-virgule + BOM : Excel en locale française ouvre le fichier sans réglage. */
export function exporterCsv({ titre, entetes, lignes }: TableauExport) {
  const echapper = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [entetes, ...lignes].map((l) => l.map(echapper).join(";")).join("\n");
  telecharger(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), nomFichier(titre, "csv"));
}

const NAVY: [number, number, number] = [13, 27, 62];
const GOLD: [number, number, number] = [201, 168, 76];
const GRIS: [number, number, number] = [110, 120, 135];

/** Tronque à la largeur disponible, en ajoutant une ellipse. */
function ajuster(doc: jsPDF, texte: string, largeur: number): string {
  if (doc.getTextWidth(texte) <= largeur) return texte;
  let bout = texte;
  while (bout.length > 1 && doc.getTextWidth(`${bout}…`) > largeur) bout = bout.slice(0, -1);
  return `${bout}…`;
}

export function exporterPdf(tableau: TableauExport) {
  construirePdf(tableau).save(nomFichier(tableau.titre, "pdf"));
}

/** Séparé de `exporterPdf` : `doc.save()` n'existe qu'au navigateur, la
 *  construction du document se teste hors navigateur. */
export function construirePdf({ titre, sousTitre, entetes, lignes }: TableauExport): jsPDF {
  // Paysage : une archive a beaucoup de colonnes, et on préfère les garder toutes
  // lisibles plutôt que de les écraser sur un portrait.
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const largeurPage = doc.internal.pageSize.getWidth();
  const hauteurPage = doc.internal.pageSize.getHeight();
  const marge = 40;
  const largeurUtile = largeurPage - 2 * marge;

  // La première colonne (l'intitulé) reçoit le double de la place des autres.
  const parts = entetes.map((_, i) => (i === 0 ? 2 : 1));
  const total = parts.reduce((a, b) => a + b, 0);
  const largeurs = parts.map((p) => (p / total) * largeurUtile);

  let y = 0;

  const enTetePage = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, largeurPage, 46, "F");
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BoardCA · BNETD — Archives du Conseil d'Administration", marge, 20);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.text(titre, marge, 37);

    y = 70;
    if (sousTitre) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GRIS);
      doc.text(sousTitre, marge, y);
      y += 16;
    }

    // Bandeau d'en-tête de colonnes
    doc.setFillColor(240, 243, 247);
    doc.rect(marge, y - 10, largeurUtile, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    let x = marge;
    entetes.forEach((h, i) => {
      doc.text(ajuster(doc, h.toUpperCase(), largeurs[i] - 8), x + 4, y + 2);
      x += largeurs[i];
    });
    y += 20;
  };

  enTetePage();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  lignes.forEach((ligne, index) => {
    if (y > hauteurPage - 50) {
      doc.addPage();
      enTetePage();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
    }
    if (index % 2 === 1) {
      doc.setFillColor(249, 250, 252);
      doc.rect(marge, y - 9, largeurUtile, 16, "F");
    }
    let x = marge;
    ligne.forEach((cellule, i) => {
      doc.setTextColor(...(i === 0 ? NAVY : GRIS));
      if (i === 0) doc.setFont("helvetica", "bold");
      doc.text(ajuster(doc, String(cellule ?? "—"), largeurs[i] - 8), x + 4, y + 1);
      if (i === 0) doc.setFont("helvetica", "normal");
      x += largeurs[i];
    });
    y += 16;
  });

  // Pied de page : provenance et pagination, sur chaque feuille.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(
      `Extrait le ${new Date().toLocaleString("fr-FR")} · ${lignes.length} entrée(s) · document en lecture seule`,
      marge,
      hauteurPage - 20,
    );
    doc.text(`${p} / ${pages}`, largeurPage - marge, hauteurPage - 20, { align: "right" });
  }

  return doc;
}
