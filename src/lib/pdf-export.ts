import { jsPDF } from "jspdf";
import { sha256 } from "js-sha256";
import { assainirPdfTexte as A } from "./pv-pdf";

export type PvExportInput = {
  meetingTitle: string;
  meetingDate: string;
  meetingLocation: string;
  content: string;
  signatures: { name: string; at: string; image?: string }[];
  sealHash: string;
  sealedAt: string;
  password: string;
};

export function exportSignedPvPdf(input: PvExportInput): { fileName: string; hash: string } {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    encryption: {
      userPassword: input.password,
      ownerPassword: input.password + "-owner",
      userPermissions: ["print", "copy"],
    },
  });

  const marginX = 56;
  let y = 60;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(13, 27, 62); // navy
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setTextColor(201, 168, 76); // gold
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(A("BoardCA · BNETD — Procès-verbal officiel chiffré"), marginX, 23);

  y = 70;
  doc.setTextColor(13, 27, 62);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(A(input.meetingTitle), marginX, y);
  y += 18;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(A(`Date : ${input.meetingDate}   ·   Lieu : ${input.meetingLocation}`), marginX, y);
  y += 20;

  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(1);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 20;

  // Body
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  const bodyLines = doc.splitTextToSize(A(input.content), pageWidth - marginX * 2);
  for (const line of bodyLines) {
    if (y > pageHeight - 140) {
      doc.addPage();
      y = 60;
    }
    doc.text(line, marginX, y);
    y += 14;
  }

  // Signatures
  if (y > pageHeight - 200) {
    doc.addPage();
    y = 60;
  }
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 27, 62);
  doc.setFontSize(12);
  doc.text(A("Signatures certifiées"), marginX, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const colW = (pageWidth - marginX * 2 - 20) / 2;
  const sigH = 70;
  let col = 0;
  input.signatures.forEach((s) => {
    if (y > pageHeight - sigH - 40) {
      doc.addPage();
      y = 60;
      col = 0;
    }
    const x = marginX + col * (colW + 20);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(x, y, colW, sigH, 4, 4, "S");
    if (s.image) {
      try {
        doc.addImage(s.image, "PNG", x + 6, y + 4, colW - 12, sigH - 26);
      } catch (e) {
        // Ignore invalid signature images
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(13, 27, 62);
    doc.text(A(s.name), x + 6, y + sigH - 12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text(A(`Signe a ${s.at}`), x + 6, y + sigH - 3);
    if (col === 1) {
      y += sigH + 10;
      col = 0;
    } else {
      col = 1;
    }
  });
  if (col === 1) y += sigH + 10;

  // Seal block
  if (y > pageHeight - 130) {
    doc.addPage();
    y = 60;
  }
  y += 18;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, 70, 6, 6, "FD");
  doc.setTextColor(6, 95, 70);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Scellage cryptographique", marginX + 12, y + 18);
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  const hashLines = doc.splitTextToSize(
    `SHA-256 : ${input.sealHash}`,
    pageWidth - marginX * 2 - 24,
  );
  doc.text(hashLines, marginX + 12, y + 34);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Horodaté le ${input.sealedAt} · Document chiffré AES ·  mot de passe requis`,
    marginX + 12,
    y + 58,
  );

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${i} / ${pages} · BoardCA — Confidentiel`, marginX, pageHeight - 24);
  }

  const fileName = `PV-${input.meetingTitle.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40)}-signe.pdf`;
  doc.save(fileName);

  const contentHash = sha256(`${input.meetingTitle}|${input.content}|${input.sealHash}`);
  return { fileName, hash: contentHash };
}
