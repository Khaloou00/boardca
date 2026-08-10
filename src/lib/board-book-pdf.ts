import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Génération d'un PDF unique du Board Book — EN PLUS du format « ordre du jour +
// fichiers séparés » (qui reste inchangé). Le PDF comprend :
//   • une couverture ;
//   • un SOMMAIRE dynamique (les points de l'ordre du jour + leur page réelle) ;
//   • le corps : chaque point de l'ordre du jour, suivi des fichiers qui lui sont
//     rattachés (PDF incorporés page à page, images en pleine page, autres formats
//     réduits à une page de renvoi vers le fichier d'origine).

const A4 = { w: 595.28, h: 841.89 };
const MARGE = 56;
const NAVY = rgb(0.05, 0.106, 0.243);
const GOLD = rgb(0.788, 0.659, 0.298);
const GRIS = rgb(0.42, 0.45, 0.5);
const GRIS_CLAIR = rgb(0.85, 0.87, 0.9);

export interface FichierBoardBook {
  nom: string;
  type: string; // DocType (pdf/image/docx/…)
  bytes: ArrayBuffer;
}
export interface SectionBoardBook {
  titre: string;
  position: number;
  fichiers: FichierBoardBook[];
}

const estPdf = (f: { nom: string; type: string }) =>
  f.type === "pdf" || f.nom.toLowerCase().endsWith(".pdf");
const estImage = (f: { nom: string; type: string }) =>
  f.type === "image" || /\.(png|jpe?g|jpg)$/i.test(f.nom);

// Découpe un texte pour qu'il tienne dans une largeur donnée (retour à la ligne).
function decouper(texte: string, font: PDFFont, taille: number, largeur: number): string[] {
  const mots = texte.split(/\s+/);
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (font.widthOfTextAtSize(essai, taille) > largeur && courante) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = essai;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

// Tronque un texte à une largeur avec « … ».
function tronquer(texte: string, font: PDFFont, taille: number, largeur: number): string {
  if (font.widthOfTextAtSize(texte, taille) <= largeur) return texte;
  let t = texte;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, taille) > largeur) t = t.slice(0, -1);
  return `${t}…`;
}

export async function genererBoardBookPdf(params: {
  titre: string;
  date: string;
  sections: SectionBoardBook[];
}): Promise<{ bytes: Uint8Array; pages: number }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // 1) Pré-analyse : charge les sources PDF et compte les pages de chaque section,
  //    pour connaître les numéros de page AVANT de dessiner le sommaire.
  const prep = await Promise.all(
    params.sections.map(async (s) => {
      const fichiers = await Promise.all(
        s.fichiers.map(async (f) => {
          if (estPdf(f)) {
            try {
              const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
              return { f, kind: "pdf" as const, src, pages: src.getPageCount() || 1 };
            } catch {
              return { f, kind: "autre" as const, src: null, pages: 1 };
            }
          }
          if (estImage(f)) return { f, kind: "image" as const, src: null, pages: 1 };
          return { f, kind: "autre" as const, src: null, pages: 1 };
        }),
      );
      const pages = 1 + fichiers.reduce((n, x) => n + x.pages, 0); // 1 = page de titre du point
      return { titre: s.titre, position: s.position, fichiers, pages };
    }),
  );

  const ENTREES_PAR_PAGE = 24;
  const tocPages = Math.max(1, Math.ceil(prep.length / ENTREES_PAR_PAGE));
  // Page de départ (1-indexée dans le PDF final) de chaque section.
  let curseur = 1 /* couverture */ + tocPages;
  const departs = prep.map((s) => {
    const debut = curseur + 1;
    curseur += s.pages;
    return debut;
  });

  // 2) Couverture.
  const couv = doc.addPage([A4.w, A4.h]);
  couv.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: GOLD });
  couv.drawText("BOARD BOOK", { x: MARGE, y: A4.h - 150, size: 12, font: bold, color: GOLD });
  for (const [i, ligne] of decouper(params.titre, bold, 26, A4.w - MARGE * 2).entries()) {
    couv.drawText(ligne, { x: MARGE, y: A4.h - 185 - i * 32, size: 26, font: bold, color: NAVY });
  }
  couv.drawText(`Séance du ${params.date}`, {
    x: MARGE,
    y: A4.h - 300,
    size: 13,
    font,
    color: GRIS,
  });
  couv.drawText(`${prep.length} point(s) à l'ordre du jour`, {
    x: MARGE,
    y: A4.h - 322,
    size: 11,
    font,
    color: GRIS,
  });

  // 3) Sommaire dynamique.
  let idx = 0;
  for (let p = 0; p < tocPages; p++) {
    const page = doc.addPage([A4.w, A4.h]);
    let y = A4.h - MARGE;
    if (p === 0) {
      page.drawText("Sommaire", { x: MARGE, y: y - 6, size: 20, font: bold, color: NAVY });
      page.drawRectangle({ x: MARGE, y: y - 18, width: 42, height: 3, color: GOLD });
      y -= 52;
    }
    for (; idx < prep.length && idx < (p + 1) * ENTREES_PAR_PAGE; idx++) {
      const s = prep[idx];
      const num = `${s.position}.`;
      page.drawText(num, { x: MARGE, y, size: 11, font: bold, color: GOLD });
      const largeurTitre = A4.w - MARGE * 2 - 30 - 40;
      const titre = tronquer(s.titre, font, 11, largeurTitre);
      page.drawText(titre, { x: MARGE + 26, y, size: 11, font, color: NAVY });
      const numPage = String(departs[idx]);
      const lp = font.widthOfTextAtSize(numPage, 11);
      page.drawText(numPage, { x: A4.w - MARGE - lp, y, size: 11, font, color: GRIS });
      // Points de conduite entre le titre et le numéro.
      const xDebut = MARGE + 26 + font.widthOfTextAtSize(titre, 11) + 6;
      const xFin = A4.w - MARGE - lp - 6;
      if (xFin > xDebut) {
        page.drawLine({
          start: { x: xDebut, y: y + 3 },
          end: { x: xFin, y: y + 3 },
          thickness: 0.5,
          color: GRIS_CLAIR,
          dashArray: [1, 2],
        });
      }
      y -= 26;
    }
  }

  // 4) Corps : chaque point + ses fichiers.
  const pageTitrePoint = (s: (typeof prep)[number]) => {
    const page = doc.addPage([A4.w, A4.h]);
    page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: NAVY });
    page.drawText(`POINT ${s.position}`, {
      x: MARGE,
      y: A4.h / 2 + 40,
      size: 12,
      font: bold,
      color: GOLD,
    });
    decouper(s.titre, bold, 22, A4.w - MARGE * 2).forEach((ligne, i) => {
      page.drawText(ligne, { x: MARGE, y: A4.h / 2 - i * 28, size: 22, font: bold, color: NAVY });
    });
    const n = s.fichiers.length;
    page.drawText(n === 0 ? "Aucun document rattaché" : `${n} document(s) rattaché(s)`, {
      x: MARGE,
      y: A4.h / 2 - 60,
      size: 11,
      font,
      color: GRIS,
    });
  };

  const pageRenvoi = (f: FichierBoardBook) => {
    const page = doc.addPage([A4.w, A4.h]);
    const lignes = decouper(
      `Document joint : ${f.nom}. Ce format n'est pas incorporable au PDF ; le fichier d'origine reste disponible séparément dans le Board Book.`,
      font,
      12,
      A4.w - MARGE * 2,
    );
    lignes.forEach((ligne, i) => {
      page.drawText(ligne, {
        x: MARGE,
        y: A4.h - MARGE - 40 - i * 18,
        size: 12,
        font,
        color: GRIS,
      });
    });
  };

  const dessinerImage = async (page: PDFPage, f: FichierBoardBook) => {
    try {
      const img = /\.png$/i.test(f.nom) ? await doc.embedPng(f.bytes) : await doc.embedJpg(f.bytes);
      const maxW = A4.w - MARGE * 2;
      const maxH = A4.h - MARGE * 2 - 24;
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * ratio;
      const h = img.height * ratio;
      page.drawImage(img, { x: (A4.w - w) / 2, y: (A4.h - h) / 2 - 12, width: w, height: h });
      page.drawText(tronquer(f.nom, font, 9, maxW), {
        x: MARGE,
        y: MARGE - 20,
        size: 9,
        font,
        color: GRIS,
      });
    } catch {
      pageRenvoi(f);
    }
  };

  for (const s of prep) {
    pageTitrePoint(s);
    for (const item of s.fichiers) {
      if (item.kind === "pdf" && item.src) {
        try {
          const copiees = await doc.copyPages(item.src, item.src.getPageIndices());
          copiees.forEach((pg) => doc.addPage(pg));
        } catch {
          pageRenvoi(item.f);
        }
      } else if (item.kind === "image") {
        const page = doc.addPage([A4.w, A4.h]);
        await dessinerImage(page, item.f);
      } else {
        pageRenvoi(item.f);
      }
    }
  }

  const bytes = await doc.save();
  return { bytes, pages: doc.getPageCount() };
}
