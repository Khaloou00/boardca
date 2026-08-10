import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { sha256 } from "js-sha256";
import { useBoardStore } from "@/store/useBoardStore";

export type Role = "super_admin" | "secretary" | "admin" | "action_manager";

export const ROLE_META: Record<
  Role,
  { label: string; short: string; color: string; path: string; description: string }
> = {
  super_admin: {
    label: "Super Administrateur",
    short: "Super Admin",
    color: "from-red-500 to-red-700",
    path: "/super-admin",
    description: "Gestion système, utilisateurs, comités, audit",
  },
  secretary: {
    label: "Secrétaire du CA",
    short: "Secrétaire",
    color: "from-navy to-navy-light",
    path: "/secretary",
    description: "Réunions, PV, votes, ordre du jour",
  },
  admin: {
    label: "Membre du CA",
    short: "Membre du CA",
    color: "from-gold to-yellow-600",
    path: "/mobile",
    description: "Board Book, votes, annotations (mobile)",
  },
  action_manager: {
    label: "Responsable d'Action",
    short: "Resp. Action",
    color: "from-emerald-500 to-emerald-700",
    path: "/actions",
    description: "Suivi et mise à jour des actions",
  },
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  committee?: string;
  avatar: string;
  status: "active" | "suspended";
  phone?: string;
  qualite?: string;
  committees?: string[];
  lastLogin?: string;
  presences?: number;
  absences?: number;
};

export type AgendaItem = { id: string; title: string; duration: number; rapporteur: string };
export type DocFile = {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  category?: string;
  pages?: number | null;
  pointOJ?: number;
  addedBy?: string;
  read?: boolean;
  content?: string;
  type?: "PDF" | "XLSX" | "DOCX" | "PPTX";
};

export type Resolution = {
  id: string;
  texte: string;
  vote: { oui: number; non: number; abs: number };
  statut: "Adoptée" | "Rejetée" | "En attente";
};

export type Meeting = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: "ordinaire" | "extraordinaire" | "comite";
  status: "brouillon" | "planifiee" | "en_cours" | "terminee" | "archivee";
  agenda: AgendaItem[];
  documents: DocFile[];
  invitees: string[];
  attendance: Record<string, "present" | "absent" | "procuration">;
  proxies: Record<string, string>;
  boardBookReady: boolean;
  convocationsSent: boolean;
  pv?: string;
  duration?: string;
  presentIds?: string[];
  absentIds?: string[];
  quorumOk?: boolean;
  pvSigned?: boolean;
  pvDate?: string | null;
  resolutions?: Resolution[];
  boardBookStatus?: "brouillon" | "genere" | "envoye";
  boardBookHistory?: BoardBookVersion[];
  convocationHistory?: ConvocationSend[];
};

export type ConvocationSend = {
  id: string;
  sentAt: string;
  sentBy: string;
  sentByName: string;
  recipientCount: number;
  boardBookVersion?: number;
  channel: "email";
};

export type BoardBookVersion = {
  id: string;
  version: number;
  generatedAt: string;
  generatedBy: string;
  generatedByName: string;
  pages: number;
  sizeMB: string;
  status: "genere" | "envoye";
  sentAt?: string;
  docSnapshot: {
    id: string;
    name: string;
    type: string;
    size: string;
    pointOJ?: number | null;
    pages?: number | null;
  }[];
  agendaSnapshot: { title: string; page: number }[];
};

export type ActionComment = { date: string; author: string; text: string };

export type Action = {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  progress: number;
  status: "todo" | "in_progress" | "done" | "late";
  meetingId?: string;
  description?: string;
  resolutionId?: string;
  assignedBy?: string;
  assignedAt?: string;
  priority?: "Haute" | "Normale" | "Basse";
  comments?: ActionComment[];
};

export type Vote = {
  id: string;
  question: string;
  open: boolean;
  votes: Record<string, "oui" | "non" | "abstention">;
};

export type AuditEntry = {
  id: string;
  ts: string;
  user: string;
  action: string;
  target: string;
  hash: string;
  prevHash: string;
  ip?: string;
};

export type Committee = {
  id: string;
  name: string;
  members: string[];
  description?: string;
  presidentId?: string;
  meetings2026?: number;
  nextMeeting?: string | null;
};

type State = {
  authed: boolean;
  currentUser: User | null;
  role: Role;
  users: User[];
  committees: Committee[];
  meetings: Meeting[];
  actions: Action[];
  votes: Vote[];
  audit: AuditEntry[];
  activeMeetingId: string | null;
};

type Ctx = State & {
  login: (role: Role) => void;
  logout: () => void;
  setRole: (r: Role) => void;
  addUser: (u: Omit<User, "id">) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  deleteUser: (id: string) => void;
  addMeeting: (m: Meeting) => void;
  updateMeeting: (id: string, patch: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  addAction: (a: Omit<Action, "id">) => void;
  updateAction: (id: string, patch: Partial<Action>) => void;
  deleteAction: (id: string) => void;
  addVote: (v: Omit<Vote, "id" | "votes" | "open">) => string;
  castVote: (voteId: string, userId: string, choice: "oui" | "non" | "abstention") => void;
  closeVote: (voteId: string) => void;
  log: (action: string, target: string) => void;
  setActiveMeetingId: (id: string | null) => void;
};

const AppCtx = createContext<Ctx | null>(null);

// ============= SEED — BNETD Côte d'Ivoire =============

const SEED_USERS: User[] = [
  {
    id: "USR-001",
    name: "Koné Ibrahim",
    avatar: "KI",
    email: "i.kone@finances.gouv.ci",
    role: "admin",
    status: "active",
    phone: "+225 07 08 12 34 56",
    qualite: "Représentant du Ministère des Finances",
    committees: ["COM-001", "COM-002"],
    committee: "Comité d'Audit",
    lastLogin: "2026-07-01T14:32:00",
    presences: 4,
    absences: 0,
  },
  {
    id: "USR-002",
    name: "Diabaté Awa",
    avatar: "DA",
    email: "a.diabate@bnetd.ci",
    role: "secretary",
    status: "active",
    phone: "+225 05 04 22 11 33",
    qualite: "Secrétaire Générale du Conseil",
    committees: [],
    committee: "Bureau",
    lastLogin: "2026-07-01T20:45:00",
    presences: 4,
    absences: 0,
  },
  {
    id: "USR-003",
    name: "Touré Mamadou",
    avatar: "TM",
    email: "m.toure@economie.gouv.ci",
    role: "admin",
    status: "active",
    phone: "+225 07 77 55 44 22",
    qualite: "Représentant du Ministère de l'Économie",
    committees: ["COM-002", "COM-003"],
    committee: "Comité Stratégique",
    lastLogin: "2026-06-30T09:15:00",
    presences: 3,
    absences: 1,
  },
  {
    id: "USR-004",
    name: "Bah Aliou",
    avatar: "BA",
    email: "a.bah@bnetd.ci",
    role: "admin",
    status: "active",
    phone: "+225 01 02 33 44 55",
    qualite: "Représentant du Personnel BNETD",
    committees: ["COM-003"],
    committee: "Comité RH",
    lastLogin: "2026-06-28T16:20:00",
    presences: 2,
    absences: 2,
  },
  {
    id: "USR-005",
    name: "Ouattara Seydou",
    avatar: "OS",
    email: "s.ouattara@presidence.ci",
    role: "admin",
    status: "active",
    phone: "+225 07 11 22 33 44",
    qualite: "Représentant de la Présidence de la République",
    committees: ["COM-002"],
    committee: "Comité Stratégique",
    lastLogin: "2026-07-01T08:55:00",
    presences: 4,
    absences: 0,
  },
  {
    id: "USR-006",
    name: "N'Guessan Kouamé",
    avatar: "NK",
    email: "k.nguessan@bnetd.ci",
    role: "action_manager",
    status: "active",
    phone: "+225 05 66 77 88 99",
    qualite: "Directeur Administratif et Financier — BNETD",
    committees: [],
    lastLogin: "2026-07-01T11:10:00",
    presences: 0,
    absences: 0,
  },
  {
    id: "USR-007",
    name: "Yao Désiré",
    avatar: "YD",
    email: "d.yao@equipement.gouv.ci",
    role: "admin",
    status: "active",
    phone: "+225 07 33 44 55 66",
    qualite: "Représentant du Ministère des Infrastructures",
    committees: ["COM-001"],
    committee: "Comité d'Audit",
    lastLogin: "2026-06-29T14:00:00",
    presences: 3,
    absences: 1,
  },
  {
    id: "USR-008",
    name: "Coulibaly Fatou",
    avatar: "CF",
    email: "f.coulibaly@bnetd.ci",
    role: "admin",
    status: "active",
    phone: "+225 01 55 66 77 88",
    qualite: "Représentant du Conseil d'État",
    committees: ["COM-001", "COM-003"],
    committee: "Comité d'Audit",
    lastLogin: "2026-06-27T10:30:00",
    presences: 4,
    absences: 0,
  },
  {
    id: "USR-009",
    name: "Traoré Issouf",
    avatar: "TI",
    email: "i.traore@cour-comptes.ci",
    role: "admin",
    status: "active",
    phone: "+225 07 99 00 11 22",
    qualite: "Représentant de la Cour des Comptes",
    committees: ["COM-001"],
    committee: "Comité d'Audit",
    lastLogin: "2026-07-01T07:45:00",
    presences: 3,
    absences: 1,
  },
  {
    id: "USR-010",
    name: "Koffi Ama",
    avatar: "KA",
    email: "a.koffi@bnetd.ci",
    role: "admin",
    status: "active",
    phone: "+225 05 12 34 56 78",
    qualite: "Représentant du DG — BNETD",
    committees: ["COM-002", "COM-003"],
    committee: "Comité RH",
    lastLogin: "2026-06-30T18:00:00",
    presences: 4,
    absences: 0,
  },
  {
    id: "USR-011",
    name: "Meité Souleymane",
    avatar: "MS",
    email: "s.meite@plan.gouv.ci",
    role: "admin",
    status: "suspended",
    phone: "+225 07 44 55 66 77",
    qualite: "Représentant du Ministère du Plan",
    committees: ["COM-002"],
    committee: "Comité Stratégique",
    lastLogin: "2026-05-15T09:00:00",
    presences: 1,
    absences: 3,
  },
  {
    id: "USR-012",
    name: "Administrateur Système",
    avatar: "AS",
    email: "admin@bnetd.ci",
    role: "super_admin",
    status: "active",
    phone: "+225 27 20 20 20 00",
    qualite: "Direction des Systèmes d'Information — BNETD",
    committees: [],
    lastLogin: "2026-07-01T20:48:00",
    presences: 0,
    absences: 0,
  },
];

const SEED_COMMITTEES: Committee[] = [
  {
    id: "COM-001",
    name: "Comité d'Audit",
    description: "Supervision des comptes, audit interne et conformité réglementaire",
    presidentId: "USR-009",
    members: ["USR-001", "USR-007", "USR-008", "USR-009"],
    meetings2026: 2,
    nextMeeting: null,
  },
  {
    id: "COM-002",
    name: "Comité Stratégique",
    description: "Orientations stratégiques, plan de développement et grands projets",
    presidentId: "USR-003",
    members: ["USR-001", "USR-003", "USR-005", "USR-010", "USR-011"],
    meetings2026: 1,
    nextMeeting: "2026-07-22",
  },
  {
    id: "COM-003",
    name: "Comité RH & Rémunération",
    description: "Politique RH, grilles salariales, recrutements cadres et évaluation DG",
    presidentId: "USR-010",
    members: ["USR-003", "USR-004", "USR-008", "USR-010"],
    meetings2026: 1,
    nextMeeting: null,
  },
];

const ADMIN_IDS = SEED_USERS.filter((u) => u.role === "admin").map((u) => u.id);

const toAgenda = (items: string[]): AgendaItem[] =>
  items.map((title, i) => ({
    id: `oj${i + 1}`,
    title,
    duration: 15,
    rapporteur: i === 0 ? "Président" : "Secrétaire",
  }));

const attFrom = (
  present: string[],
  absent: string[],
  proxies: { de: string; vers: string }[] = [],
): Record<string, "present" | "absent" | "procuration"> => {
  const a: Record<string, "present" | "absent" | "procuration"> = {};
  present.forEach((id) => (a[id] = "present"));
  absent.forEach((id) => (a[id] = "absent"));
  proxies.forEach((p) => (a[p.de] = "procuration"));
  return a;
};

const proxyMap = (proxies: { de: string; vers: string }[]): Record<string, string> => {
  const m: Record<string, string> = {};
  proxies.forEach((p) => (m[p.de] = p.vers));
  return m;
};

const SEED_MEETINGS: Meeting[] = [
  {
    id: "REU-2026-01",
    title: "CA Ordinaire — 1er trimestre 2026",
    date: "2026-02-18",
    time: "09:00",
    duration: "3h15",
    location: "Salle de Conférence A — BNETD Plateau, Abidjan",
    type: "ordinaire",
    status: "terminee",
    agenda: toAgenda([
      "Approbation du PV de la session du 19 Novembre 2025",
      "Présentation des comptes annuels 2025",
      "Rapport d'activité 2025",
      "Budget primitif 2026",
      "Questions diverses",
    ]),
    documents: [],
    invitees: ADMIN_IDS,
    presentIds: [
      "USR-001",
      "USR-003",
      "USR-005",
      "USR-007",
      "USR-008",
      "USR-009",
      "USR-010",
      "USR-011",
    ],
    absentIds: ["USR-004"],
    attendance: attFrom(
      ["USR-001", "USR-003", "USR-005", "USR-007", "USR-008", "USR-009", "USR-010", "USR-011"],
      [],
      [{ de: "USR-004", vers: "USR-003" }],
    ),
    proxies: proxyMap([{ de: "USR-004", vers: "USR-003" }]),
    quorumOk: true,
    boardBookReady: true,
    convocationsSent: true,
    pvSigned: true,
    pvDate: "2026-02-25",
    resolutions: [
      {
        id: "R-2026-01-01",
        texte: "Approbation des comptes annuels 2025",
        vote: { oui: 8, non: 0, abs: 0 },
        statut: "Adoptée",
      },
      {
        id: "R-2026-01-02",
        texte: "Approbation du budget primitif 2026 : 12,4 milliards FCFA",
        vote: { oui: 7, non: 1, abs: 0 },
        statut: "Adoptée",
      },
      {
        id: "R-2026-01-03",
        texte: "Autorisation de recrutement de 15 cadres supérieurs",
        vote: { oui: 8, non: 0, abs: 0 },
        statut: "Adoptée",
      },
    ],
  },
  {
    id: "REU-2026-02",
    title: "CA Extraordinaire — Approbation Plan Stratégique 2026-2030",
    date: "2026-04-15",
    time: "14:30",
    duration: "2h00",
    location: "Salle de Conférence B — BNETD Plateau, Abidjan",
    type: "extraordinaire",
    status: "terminee",
    agenda: toAgenda([
      "Présentation du Plan Stratégique BNETD 2026-2030",
      "Vote d'approbation du plan stratégique",
      "Autorisation de lancement des chantiers prioritaires",
    ]),
    documents: [],
    invitees: ADMIN_IDS,
    presentIds: ["USR-001", "USR-003", "USR-004", "USR-005", "USR-008", "USR-009", "USR-010"],
    absentIds: ["USR-007", "USR-011"],
    attendance: attFrom(
      ["USR-001", "USR-003", "USR-004", "USR-005", "USR-008", "USR-009", "USR-010"],
      ["USR-007", "USR-011"],
    ),
    proxies: {},
    quorumOk: true,
    boardBookReady: true,
    convocationsSent: true,
    pvSigned: true,
    pvDate: "2026-04-20",
    resolutions: [
      {
        id: "R-2026-02-01",
        texte: "Approbation du Plan Stratégique BNETD 2026-2030",
        vote: { oui: 7, non: 0, abs: 0 },
        statut: "Adoptée",
      },
      {
        id: "R-2026-02-02",
        texte: "Autorisation de lancement du projet Carte Numérique du Territoire",
        vote: { oui: 6, non: 1, abs: 0 },
        statut: "Adoptée",
      },
    ],
  },
  {
    id: "REU-2026-03",
    title: "CA Ordinaire — 2ème trimestre 2026",
    date: "2026-06-25",
    time: "09:00",
    duration: "3h45",
    location: "Salle de Conférence A — BNETD Plateau, Abidjan",
    type: "ordinaire",
    status: "terminee",
    agenda: toAgenda([
      "Approbation du PV du CA du 15 Avril 2026",
      "Rapport financier Q2 2026",
      "Point d'avancement Plan Stratégique 2026-2030",
      "Renouvellement contrat prestataire DSI",
      "Attribution action : Audit externe avant 30 Septembre",
      "Questions diverses",
    ]),
    documents: [],
    invitees: ADMIN_IDS,
    presentIds: [
      "USR-001",
      "USR-003",
      "USR-005",
      "USR-007",
      "USR-008",
      "USR-009",
      "USR-010",
      "USR-004",
    ],
    absentIds: ["USR-011"],
    attendance: attFrom(
      ["USR-001", "USR-003", "USR-005", "USR-007", "USR-008", "USR-009", "USR-010", "USR-004"],
      ["USR-011"],
    ),
    proxies: {},
    quorumOk: true,
    boardBookReady: true,
    convocationsSent: true,
    pvSigned: false,
    pvDate: null,
    resolutions: [
      {
        id: "R-2026-03-01",
        texte: "Approbation du rapport financier Q2 2026",
        vote: { oui: 8, non: 0, abs: 0 },
        statut: "Adoptée",
      },
      {
        id: "R-2026-03-02",
        texte: "Renouvellement contrat prestataire DSI — 3 ans",
        vote: { oui: 5, non: 2, abs: 1 },
        statut: "Adoptée",
      },
      {
        id: "R-2026-03-03",
        texte: "Lancement d'un audit externe avant le 30 Septembre 2026",
        vote: { oui: 8, non: 0, abs: 0 },
        statut: "Adoptée",
      },
      {
        id: "R-2026-03-04",
        texte: "Mise à jour de la politique RSE avant le 15 Octobre 2026",
        vote: { oui: 7, non: 0, abs: 1 },
        statut: "Adoptée",
      },
    ],
  },
  {
    id: "REU-2026-04",
    title: "CA Ordinaire — 3ème trimestre 2026",
    date: "2026-07-15",
    time: "09:00",
    duration: "4h00",
    location: "Salle de Conférence A — BNETD Plateau, Abidjan",
    type: "ordinaire",
    status: "planifiee",
    agenda: toAgenda([
      "Approbation du PV du CA du 25 Juin 2026",
      "Rapport financier Q3 2026 — premiers résultats",
      "Point d'avancement audit externe (R-2026-03-03)",
      "Examen du budget modificatif Q3",
      "Rapport d'avancement Plan Stratégique 2026-2030",
      "Questions diverses",
    ]),
    documents: [
      {
        id: "DOC-001",
        name: "Rapport_Financier_Q3_2026_preliminaire.pdf",
        size: "1.2 MB",
        type: "PDF",
        uploadedAt: "2026-07-01T10:00:00",
        pages: 24,
        category: "Rapports Financiers",
        pointOJ: 2,
        addedBy: "USR-002",
        read: false,
        content: `RAPPORT FINANCIER — Q3 2026 (PRÉLIMINAIRE)
BNETD — Bureau National d'Études Techniques et de Développement
Plateau, Abidjan — Juillet 2026

RÉSULTATS FINANCIERS — PREMIER SEMESTRE 2026

Chiffre d'affaires S1 2026 : 6,8 milliards FCFA
• T1 2026 : 3,1 milliards FCFA (conforme budget)
• T2 2026 : 3,7 milliards FCFA (+19% vs T1)

Charges d'exploitation S1 : 4,9 milliards FCFA
• Charges de personnel : 2,8 milliards FCFA
• Charges opérationnelles : 1,4 milliards FCFA
• Charges DSI : 0,7 milliards FCFA

Résultat net S1 : 1,9 milliard FCFA
Trésorerie disponible : 1,1 milliard FCFA

ÉCART BUDGÉTAIRE NOTABLE
Charges DSI : dépassement de 12% (85M FCFA)
Cause : renouvellement anticipé licences logicielles
Action corrective : arbitrage budgétaire Q3 soumis
au vote (point 4 de l'ordre du jour)

PERSPECTIVES Q3 2026
Objectif CA : 3,4 milliards FCFA
Projets en cours : 47 marchés actifs
Taux d'exécution contrats : 78%`,
      },
      {
        id: "DOC-002",
        name: "PV_CA_Ordinaire_25_Juin_2026_BROUILLON.pdf",
        size: "890 KB",
        type: "PDF",
        uploadedAt: "2026-06-30T18:00:00",
        pages: 12,
        category: "Procès-verbaux",
        pointOJ: 1,
        addedBy: "USR-002",
        read: false,
        content: `PROCÈS-VERBAL — BROUILLON
CA Ordinaire — 25 Juin 2026
BNETD Plateau, Salle de Conférence A

PRÉSENTS : Koné Ibrahim, Touré Mamadou, Ouattara Seydou,
Yao Désiré, Coulibaly Fatou, Traoré Issouf, Koffi Ama, Bah Aliou

ABSENT : Meité Souleymane (non excusé)

SÉANCE OUVERTE À 09H22 par Mme Diabaté Awa, Secrétaire du Conseil.

POINT 1 — Approbation du PV du 15 Avril 2026
Le PV est approuvé à l'unanimité sans observation.

POINT 2 — Rapport financier Q2 2026
M. N'Guessan Kouamé, DAF, présente les résultats...`,
      },
      {
        id: "DOC-003",
        name: "Budget_Modificatif_Q3_2026.xlsx",
        size: "340 KB",
        type: "XLSX",
        uploadedAt: "2026-07-01T11:30:00",
        pages: null,
        category: "Budgets & Prévisions",
        pointOJ: 4,
        addedBy: "USR-002",
        read: false,
      },
    ],
    invitees: ADMIN_IDS,
    presentIds: [],
    absentIds: [],
    attendance: {},
    proxies: {},
    quorumOk: false,
    boardBookReady: true,
    convocationsSent: true,
    pvSigned: false,
    pvDate: null,
    resolutions: [],
  },
  {
    id: "REU-2026-05",
    title: "Comité Stratégique — Revue mi-parcours",
    date: "2026-07-22",
    time: "14:00",
    duration: "2h30",
    location: "Salle Stratégie — BNETD Plateau, 3ème étage",
    type: "comite",
    status: "planifiee",
    agenda: toAgenda([
      "Revue mi-parcours Plan Stratégique 2026-2030",
      "Tableau de bord des indicateurs stratégiques",
      "Arbitrages budgétaires second semestre",
      "Préparation du rapport annuel 2026",
    ]),
    documents: [],
    invitees: SEED_COMMITTEES.find((c) => c.id === "COM-002")!.members,
    presentIds: [],
    absentIds: [],
    attendance: {},
    proxies: {},
    quorumOk: false,
    boardBookReady: false,
    convocationsSent: true,
    pvSigned: false,
    pvDate: null,
    resolutions: [],
  },
  {
    id: "REU-2026-06",
    title: "CA Ordinaire — 4ème trimestre 2026 (Prévisionnel)",
    date: "2026-11-19",
    time: "09:00",
    duration: "4h00",
    location: "Salle de Conférence A — BNETD Plateau, Abidjan",
    type: "ordinaire",
    status: "planifiee",
    agenda: [],
    documents: [],
    invitees: ADMIN_IDS,
    presentIds: [],
    absentIds: [],
    attendance: {},
    proxies: {},
    quorumOk: false,
    boardBookReady: false,
    convocationsSent: false,
    pvSigned: false,
    pvDate: null,
    resolutions: [],
  },
];

const SEED_ACTIONS: Action[] = [
  {
    id: "ACT-001",
    resolutionId: "R-2026-03-03",
    title: "Lancement de l'audit externe BNETD 2026",
    description:
      "Sélectionner et mandater un cabinet d'audit externe agréé. Lancer la mission avant le 30 Septembre 2026. Produire un rapport intermédiaire avant le CA de Juillet.",
    assignee: "USR-006",
    assignedBy: "USR-002",
    assignedAt: "2026-06-26",
    dueDate: "2026-09-30",
    priority: "Haute",
    progress: 45,
    status: "in_progress",
    meetingId: "REU-2026-03",
    comments: [
      {
        date: "2026-06-28",
        author: "N'Guessan Kouamé",
        text: "3 cabinets contactés : Deloitte CI, Ernst & Young CI, KPMG CI. En attente de propositions.",
      },
      {
        date: "2026-07-05",
        author: "N'Guessan Kouamé",
        text: "Propositions reçues. Analyse comparative en cours. Décision prévue le 10 Juillet.",
      },
    ],
  },
  {
    id: "ACT-002",
    resolutionId: "R-2026-03-04",
    title: "Mise à jour de la politique RSE du BNETD",
    description:
      "Réviser et mettre à jour la politique de Responsabilité Sociale et Environnementale du BNETD. Intégrer les nouveaux standards UEMOA. Soumettre au CA pour validation avant le 15 Octobre 2026.",
    assignee: "USR-006",
    assignedBy: "USR-002",
    assignedAt: "2026-06-26",
    dueDate: "2026-10-15",
    priority: "Normale",
    progress: 60,
    status: "in_progress",
    meetingId: "REU-2026-03",
    comments: [
      {
        date: "2026-07-02",
        author: "N'Guessan Kouamé",
        text: "Document de référence RSE 2022 récupéré. Benchmark avec les standards UEMOA en cours.",
      },
    ],
  },
  {
    id: "ACT-003",
    resolutionId: "R-2026-01-03",
    title: "Recrutement de 15 cadres supérieurs BNETD",
    description:
      "Lancer la procédure de recrutement de 15 cadres supérieurs validée en CA de Février 2026. Profils : ingénieurs, juristes, financiers. Clôture des candidatures : 30 Juin 2026.",
    assignee: "USR-006",
    assignedBy: "USR-002",
    assignedAt: "2026-02-20",
    dueDate: "2026-06-30",
    priority: "Haute",
    progress: 100,
    status: "done",
    meetingId: "REU-2026-01",
    comments: [
      {
        date: "2026-06-15",
        author: "N'Guessan Kouamé",
        text: "15 candidats retenus. Contrats signés. Intégration prévue le 1er Août 2026.",
      },
    ],
  },
];

const AUDIT_SEED: Array<Omit<AuditEntry, "hash" | "prevHash">> = [
  {
    id: "LOG-020",
    ts: "2026-02-15T08:00:00",
    user: "Administrateur Système",
    action: "Initialisation plateforme",
    target: "BoardCA BNETD v1.0",
    ip: "197.234.1.1",
  },
  {
    id: "LOG-019",
    ts: "2026-04-01T09:30:00",
    user: "Administrateur Système",
    action: "Création utilisateur",
    target: "USR-009 — Traoré Issouf",
    ip: "197.234.1.1",
  },
  {
    id: "LOG-018",
    ts: "2026-04-10T11:00:00",
    user: "Diabaté Awa",
    action: "Génération Board Book",
    target: "REU-2026-02 — 3 documents · 48 pages",
    ip: "197.234.12.45",
  },
  {
    id: "LOG-017",
    ts: "2026-04-15T09:10:00",
    user: "Bah Aliou",
    action: "Scan QR présence",
    target: "REU-2026-02",
    ip: "197.234.22.44",
  },
  {
    id: "LOG-016",
    ts: "2026-04-15T16:35:00",
    user: "Traoré Issouf",
    action: "Vote électronique",
    target: "R-2026-02-01 → OUI",
    ip: "197.234.55.12",
  },
  {
    id: "LOG-015",
    ts: "2026-04-20T14:20:00",
    user: "Coulibaly Fatou",
    action: "signature certifiée PV",
    target: "PV_CA_15_Avril_2026.pdf",
    ip: "197.234.77.89",
  },
  {
    id: "LOG-014",
    ts: "2026-05-15T09:00:00",
    user: "Meité Souleymane",
    action: "Connexion réussie",
    target: "Auth",
    ip: "41.202.33.67",
  },
  {
    id: "LOG-013",
    ts: "2026-06-20T10:00:00",
    user: "Diabaté Awa",
    action: "Envoi convocations",
    target: "REU-2026-03 → 9 destinataires",
    ip: "197.234.12.45",
  },
  {
    id: "LOG-012",
    ts: "2026-06-25T08:57:00",
    user: "Ouattara Seydou",
    action: "Scan QR présence",
    target: "REU-2026-03",
    ip: "41.202.100.55",
  },
  {
    id: "LOG-011",
    ts: "2026-06-25T09:04:00",
    user: "Koné Ibrahim",
    action: "Scan QR présence",
    target: "REU-2026-03",
    ip: "197.234.88.12",
  },
  {
    id: "LOG-010",
    ts: "2026-06-25T13:45:00",
    user: "Touré Mamadou",
    action: "Vote électronique",
    target: "R-2026-03-02 → NON",
    ip: "197.234.99.34",
  },
  {
    id: "LOG-009",
    ts: "2026-06-25T13:47:00",
    user: "Koné Ibrahim",
    action: "Vote électronique",
    target: "R-2026-03-02 → OUI",
    ip: "197.234.88.12",
  },
  {
    id: "LOG-008",
    ts: "2026-06-26T16:30:00",
    user: "Diabaté Awa",
    action: "Attribution action",
    target: "ACT-001 → N'Guessan Kouamé",
    ip: "197.234.12.45",
  },
  {
    id: "LOG-007",
    ts: "2026-06-29T14:00:00",
    user: "Yao Désiré",
    action: "Téléchargement Board Book",
    target: "REU-2026-03",
    ip: "197.234.44.21",
  },
  {
    id: "LOG-006",
    ts: "2026-06-30T09:15:00",
    user: "Touré Mamadou",
    action: "Annotation document",
    target: "Rapport_Financier_Q2.pdf — Page 8",
    ip: "197.234.99.34",
  },
  {
    id: "LOG-005",
    ts: "2026-06-30T18:00:00",
    user: "Koffi Ama",
    action: "Connexion réussie",
    target: "Auth",
    ip: "41.202.207.10",
  },
  {
    id: "LOG-004",
    ts: "2026-07-01T11:10:00",
    user: "N'Guessan Kouamé",
    action: "Mise à jour avancement action",
    target: "ACT-001 → 45%",
    ip: "197.234.55.78",
  },
  {
    id: "LOG-003",
    ts: "2026-07-01T14:32:00",
    user: "Koné Ibrahim",
    action: "Connexion réussie",
    target: "Auth",
    ip: "197.234.88.12",
  },
  {
    id: "LOG-002",
    ts: "2026-07-01T20:32:00",
    user: "Diabaté Awa",
    action: "Upload document",
    target: "Budget_Modificatif_Q3_2026.xlsx",
    ip: "197.234.12.45",
  },
  {
    id: "LOG-001",
    ts: "2026-07-01T20:48:00",
    user: "Diabaté Awa",
    action: "Consultation Board Book",
    target: "REU-2026-04",
    ip: "197.234.12.45",
  },
];

const buildAudit = (): AuditEntry[] => {
  // AUDIT_SEED is newest-first; hash chronologically then re-reverse.
  const chrono = [...AUDIT_SEED].reverse();
  const out: AuditEntry[] = [];
  let prev = "GENESIS";
  chrono.forEach((e) => {
    const hash = sha256(`${prev}|${e.ts}|${e.user}|${e.action}|${e.target}`);
    out.push({ ...e, prevHash: prev, hash });
    prev = hash;
  });
  return out.reverse();
};

const now = () => new Date().toISOString();

// Jeu de démo en mémoire VIDÉ (2026-07-08) : il affichait des réunions, comités,
// utilisateurs et documents fictifs sur les pages pas encore migrées sur Supabase,
// alors que la base est la seule source de vérité. Les panneaux concernés gèrent
// déjà l'absence de réunion (`if (!meeting) return <Empty />`).
// Les constantes SEED_* restent en place comme référence de forme des données.
const SEED: State = {
  authed: false,
  currentUser: null,
  role: "secretary",
  users: [],
  committees: [],
  meetings: [],
  actions: [],
  votes: [],
  audit: [],
  activeMeetingId: null,
};

let idCounter = 1000;
const nid = () => `id${++idCounter}`;

// L'identité affichée par les pages non migrées vient désormais de la vraie session
// Supabase, plus d'une persona figée du jeu de démo (qui affichait toujours le même
// utilisateur quel que soit le compte réellement authentifié).
function legacyUserFromProfile(role: Role): User {
  const p = useBoardStore.getState().profile;
  return {
    id: p?.id ?? "unknown",
    name: p?.nom ?? "Utilisateur",
    email: p?.email ?? "",
    role,
    avatar: p?.initiales ?? "?",
    status: "active",
    qualite: p?.qualite,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(SEED);

  const value = useMemo<Ctx>(
    () => ({
      ...s,
      login: (role) => {
        const user = legacyUserFromProfile(role);
        setS((p) => {
          const prev = p.audit[0]?.hash ?? "GENESIS";
          const ts = now();
          const action = "Connexion 2FA + biométrie";
          const target = "Système";
          const hash = sha256(`${prev}|${ts}|${user.name}|${action}|${target}`);
          const entry: AuditEntry = {
            id: nid(),
            ts,
            user: user.name,
            action,
            target,
            hash,
            prevHash: prev,
          };
          return { ...p, authed: true, currentUser: user, role, audit: [entry, ...p.audit] };
        });
      },
      logout: () => setS((p) => ({ ...p, authed: false, currentUser: null })),
      setRole: (role) => {
        const user = legacyUserFromProfile(role);
        setS((p) => ({ ...p, role, currentUser: user, authed: true }));
      },
      addUser: (u) => setS((p) => ({ ...p, users: [...p.users, { ...u, id: nid() }] })),
      updateUser: (id, patch) =>
        setS((p) => ({ ...p, users: p.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
      deleteUser: (id) =>
        setS((p) => ({
          ...p,
          users: p.users.filter((u) => u.id !== id),
          committees: p.committees.map((c) => ({
            ...c,
            members: c.members.filter((m) => m !== id),
            presidentId: c.presidentId === id ? undefined : c.presidentId,
          })),
          meetings: p.meetings.map((m) => ({
            ...m,
            invitees: m.invitees.filter((i) => i !== id),
            presentIds: m.presentIds?.filter((i) => i !== id),
            absentIds: m.absentIds?.filter((i) => i !== id),
          })),
        })),
      addMeeting: (m) => setS((p) => ({ ...p, meetings: [m, ...p.meetings] })),
      updateMeeting: (id, patch) =>
        setS((p) => ({
          ...p,
          meetings: p.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),
      deleteMeeting: (id) =>
        setS((p) => ({
          ...p,
          meetings: p.meetings.filter((m) => m.id !== id),
          actions: p.actions.map((a) => (a.meetingId === id ? { ...a, meetingId: undefined } : a)),
        })),
      addAction: (a) => setS((p) => ({ ...p, actions: [...p.actions, { ...a, id: nid() }] })),
      updateAction: (id, patch) =>
        setS((p) => ({
          ...p,
          actions: p.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      deleteAction: (id) => setS((p) => ({ ...p, actions: p.actions.filter((a) => a.id !== id) })),
      addVote: (v) => {
        const id = nid();
        setS((p) => ({ ...p, votes: [...p.votes, { ...v, id, open: true, votes: {} }] }));
        return id;
      },
      castVote: (voteId, userId, choice) =>
        setS((p) => ({
          ...p,
          votes: p.votes.map((v) =>
            v.id === voteId ? { ...v, votes: { ...v.votes, [userId]: choice } } : v,
          ),
        })),
      closeVote: (voteId) =>
        setS((p) => ({
          ...p,
          votes: p.votes.map((v) => (v.id === voteId ? { ...v, open: false } : v)),
        })),
      log: (action, target) =>
        setS((p) => {
          const prev = p.audit[0]?.hash ?? "GENESIS";
          const ts = now();
          const user = p.currentUser?.name ?? "Système";
          const hash = sha256(`${prev}|${ts}|${user}|${action}|${target}`);
          const entry: AuditEntry = { id: nid(), ts, user, action, target, hash, prevHash: prev };
          return { ...p, audit: [entry, ...p.audit] };
        }),
      setActiveMeetingId: (id) => setS((p) => ({ ...p, activeMeetingId: id })),
    }),
    [s],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}
