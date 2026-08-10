import { jsPDF } from "jspdf";
import { htmlVersTexte } from "./pv-format";

// Rend le procès-verbal en PDF LISIBLE (non chiffré), pour que les membres le
// consultent et l'annotent comme le Board Book. À ne pas confondre avec
// `exportSignedPvPdf` (pdf-export.ts) qui produit le PDF FINAL, chiffré et signé.
//
// La sortie est déterministe : même contenu → même mise en page → mêmes offsets de
// texte. C'est indispensable pour que les annotations (ancrées sur un offset de
// caractère) tombent au même endroit pour tous les membres.

export type PvSignatureQualifiee = {
  nom: string;
  date: string;
  /** Fac-similé manuscrit (data URL) — absent si signature OTP/biométrie. */
  image?: string | null;
  methode?: string;
};

export type PvPdfInput = {
  titre: string;
  date: string;
  lieu: string;
  /** Contenu HTML du PV (éditeur riche). */
  contenuHtml: string;
  /** Signature(s) qualifiée(s) apposée(s) au bas du document. Sur le PV scellé,
   *  c'est celle du PCA : les approbations des membres n'y figurent pas. */
  signatures?: PvSignatureQualifiee[];
};

const NAVY: [number, number, number] = [13, 27, 62];
const GOLD: [number, number, number] = [201, 168, 76];

// La police Helvetica de jsPDF est encodée WinAnsi : les glyphes typographiques
// (apostrophe courbe, tirets long/moyen, exposant « ᵉ », espaces insécables…) n'y
// existent pas. Non seulement ils s'affichent de travers (« 3ᵉ » → « 3I »), mais
// jsPDF calcule alors une largeur FAUSSE — d'où le texte qui déborde du cadre.
// On les ramène à leurs équivalents ASCII/WinAnsi AVANT toute mesure.
const REMPLACEMENTS: [RegExp, string][] = [
  [/[‘’‚′]/g, "'"], // ‘ ’ ‚ ′
  [/[“”„″]/g, '"'], // “ ” „ ″
  [/[–—―]/g, "-"], // – — ―
  [/…/g, "..."], // …
  [/[\u00A0\u202F\u2007\u2009\u200A]/g, " "], // espaces insécables / fines
  [/ᵉ/g, "e"], // ᵉ (exposant e)
  [/ʳ/g, "r"], // ʳ (exposant r)
];

export function assainirPdfTexte(s: string): string {
  let out = s.normalize("NFC");
  for (const [re, rep] of REMPLACEMENTS) out = out.replace(re, rep);
  // Filet de sécurité : tout caractère hors Latin-1 imprimable, hormis les retours
  // à la ligne, est retiré — sinon la mesure de largeur reste faussée.
  return out.replace(/[^\t\n\r\x20-\xFF]/g, "");
}
const assainir = assainirPdfTexte;

export function genererPvPdf(input: PvPdfInput): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marge = 56;
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  const dispo = largeur - marge * 2;
  let y = 0;

  // Bandeau d'en-tête
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, largeur, 40, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(assainir("BNETD · Conseil d'Administration — Procès-verbal"), marge, 25);

  y = 74;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  for (const ligne of doc.splitTextToSize(assainir(input.titre), dispo)) {
    doc.text(ligne, marge, y);
    y += 20;
  }

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  for (const ligne of doc.splitTextToSize(
    assainir(`Date : ${input.date}     Lieu : ${input.lieu}`),
    dispo,
  )) {
    doc.text(ligne, marge, y);
    y += 14;
  }
  y += 4;

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(marge, y, largeur - marge, y);
  y += 22;

  // Corps : texte structuré (les titres du PV ressortent en gras majuscules,
  // htmlVersTexte les ayant déjà mis en capitales).
  const texte = htmlVersTexte(input.contenuHtml);
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);

  for (const paragraphe of texte.split("\n")) {
    const ligneSaine = assainir(paragraphe);
    if (ligneSaine.trim() === "") {
      y += 8;
      continue;
    }
    // Une ligne toute en capitales (hors puce) est un titre de section du PV.
    const estTitre = ligneSaine === ligneSaine.toUpperCase() && /[A-ZÀ-Ý]/.test(ligneSaine);
    doc.setFont("helvetica", estTitre ? "bold" : "normal");
    if (estTitre) doc.setTextColor(...NAVY);
    else doc.setTextColor(20, 20, 20);
    for (const ligne of doc.splitTextToSize(ligneSaine, dispo)) {
      if (y > hauteur - 60) {
        doc.addPage();
        y = 60;
      }
      doc.text(ligne, marge, y);
      y += 15;
    }
  }

  // Signature(s) qualifiée(s) — la signature du PCA scelle le procès-verbal.
  if (input.signatures && input.signatures.length > 0) {
    if (y > hauteur - 170) {
      doc.addPage();
      y = 60;
    } else {
      y += 24;
    }
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1);
    doc.line(marge, y, largeur - marge, y);
    y += 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(assainir("Signature du Président du Conseil d'Administration"), marge, y);
    y += 8;

    for (const s of input.signatures) {
      const cadreH = 78;
      if (y > hauteur - cadreH - 30) {
        doc.addPage();
        y = 60;
      }
      const cadreW = 240;
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.8);
      doc.roundedRect(marge, y + 8, cadreW, cadreH, 4, 4, "S");
      if (s.image) {
        try {
          doc.addImage(s.image, "PNG", marge + 8, y + 14, cadreW - 16, cadreH - 34);
        } catch {
          // image invalide : on laisse le cadre vide
        }
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...NAVY);
      doc.text(assainir(s.nom), marge + 8, y + cadreH - 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(assainir(`Scellé le ${s.date}`), marge + 8, y + cadreH + 4);
      y += cadreH + 22;
    }
  }

  return doc.output("blob");
}

/** Blob URL prêt pour pdf.js. À révoquer par l'appelant (URL.revokeObjectURL). */
export function genererPvPdfUrl(input: PvPdfInput): string {
  return URL.createObjectURL(genererPvPdf(input));
}
