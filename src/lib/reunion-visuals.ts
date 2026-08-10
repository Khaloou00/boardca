// Code couleur unique des réunions, partagé par le calendrier, le tableau de bord
// et les grilles de sections du secrétariat : or brillant = CA extraordinaire,
// vert brillant = CA ordinaire. Une seule source pour éviter que les trois écrans
// dérivent chacun de leur côté.

const MOIS_COURT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

// `Reunion.date` est un "YYYY-MM-DD" : on le découpe à la main plutôt que de passer
// par un objet Date, qui décalerait la séance d'un jour selon le fuseau.
export const datePartsFr = (iso: string) => {
  const [annee, mois, jour] = iso.split("-").map(Number);
  return { jour, mois: MOIS_COURT[mois - 1] ?? "", annee };
};

export const dateFr = (iso: string) => {
  const p = datePartsFr(iso);
  return `${p.jour} ${p.mois} ${p.annee}`;
};

export type TypeMeta = {
  label: string;
  /** Couleur de remplissage (case du calendrier, filet de carte). */
  couleur: string;
  /** Texte lisible posé sur `couleur`. */
  texte: string;
  chip: string;
  halo: string;
  tuile: string;
  bordure: string;
};

const TYPES: Record<string, TypeMeta> = {
  ca_ordinaire: {
    label: "Ordinaire",
    couleur: "#00C853",
    texte: "#052E16",
    chip: "bg-[#00C853]/12 text-[#0A7A3C] ring-1 ring-inset ring-[#00C853]/40",
    halo: "hover:shadow-[0_18px_40px_-24px_rgba(0,200,83,0.55)]",
    tuile: "from-[#00C853] to-[#039B45]",
    bordure: "border-l-4 border-l-[#00C853]",
  },
  ca_extraordinaire: {
    label: "Extraordinaire",
    couleur: "#FFC300",
    texte: "#4A3800",
    chip: "bg-[#FFC300]/18 text-[#8A6A00] ring-1 ring-inset ring-[#FFC300]/60",
    halo: "hover:shadow-[0_18px_40px_-24px_rgba(255,195,0,0.65)]",
    tuile: "from-[#FFC300] to-[#E0A500]",
    bordure: "border-l-4 border-l-[#FFC300]",
  },
  comite: {
    label: "Comité",
    couleur: "#94A3B8",
    texte: "#1E293B",
    chip: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
    halo: "hover:shadow-[0_18px_40px_-24px_rgba(100,116,139,0.5)]",
    tuile: "from-slate-400 to-slate-500",
    bordure: "border-l-4 border-l-slate-300",
  },
};

export const typeMeta = (type: string): TypeMeta => TYPES[type] ?? TYPES.comite;

export type StatutMeta = { label: string; pastille: string; chip: string };

const STATUTS: Record<string, StatutMeta> = {
  planifiee: {
    label: "Planifiée",
    pastille: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
  },
  en_cours: {
    label: "En cours",
    pastille: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  },
  terminee: {
    label: "Terminée",
    pastille: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  },
};

export const statutMeta = (statut: string): StatutMeta | undefined => STATUTS[statut];
