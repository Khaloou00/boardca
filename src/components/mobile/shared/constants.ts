// Constantes partagées de l'app mobile, dans leur propre module pour que
// les écrans puissent les importer sans dépendre de `admin-app.tsx`
// (ce qui créerait un import circulaire).
import { Bell, BookOpen, ClipboardCheck, Coins, Crown, FileSignature, FileText,
  MailCheck, MessageSquare, Send, Vote as VoteIcon } from "lucide-react";
import type { NotificationType } from "@/lib/notifications";

// Rendu d'une notification selon l'événement métier qui l'a produite.
export const NOTIF_META: Record<NotificationType, { icon: any; color: string }> = {
  convocation: { icon: Send, color: "bg-navy text-white" },
  vote: { icon: VoteIcon, color: "bg-navy text-white" },
  pv: { icon: FileSignature, color: "bg-gold text-gold-foreground" },
  action: { icon: ClipboardCheck, color: "bg-emerald-500 text-white" },
  document: { icon: FileText, color: "bg-sky-500 text-white" },
  board_book: { icon: BookOpen, color: "bg-emerald-500 text-white" },
  discussion: { icon: MessageSquare, color: "bg-slate-600 text-white" },
  jeton: { icon: Coins, color: "bg-gold text-gold-foreground" },
  delegation: { icon: Crown, color: "bg-navy text-white" },
  consultation: { icon: MailCheck, color: "bg-amber-500 text-white" },
};
// Un type ajouté en base (contrainte `notifications_type_check`) mais pas encore
// ici ne doit pas faire tomber tout l'écran Alertes : on retombe sur une cloche.
export const metaDe = (type: string) =>
  NOTIF_META[type as NotificationType] ?? { icon: Bell, color: "bg-slate-500 text-white" };
export const AGENDA_POINTS = [
  { n: 1, title: "Approbation du PV du 25 Juin 2026", pages: 8, file: "PV Juin 2026" },
  { n: 2, title: "Rapport financier Q3 2026", pages: 24, file: "Rapport financier Q3" },
  { n: 3, title: "Plan Stratégique 2026-2030", pages: 32, file: "Plan Stratégique" },
  { n: 4, title: "Budget modificatif Q3", pages: 18, file: "Budget modificatif" },
  { n: 5, title: "Questions diverses", pages: 4, file: "Questions diverses" },
];
