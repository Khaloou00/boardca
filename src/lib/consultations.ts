import { supabase } from "./supabase";

// Trace au journal d'audit (`audit_log`). Best-effort : une consultation réussie
// ne doit pas échouer parce que la trace n'a pas pu s'écrire.
const tracer = (action: string, ressource?: string) =>
  supabase.rpc("log_event", { p_action: action, p_ressource: ressource }).then(
    () => undefined,
    () => undefined,
  );

// Consultation écrite hors séance (migration 031). Le secrétariat ouvre une
// question, chaque administrateur répond UNE fois (réponse immuable, pas de
// policy UPDATE/DELETE), et la clôture est calculée par le serveur.

export type Choix = "oui" | "non" | "abstention";
export type ConsultationStatut = "ouverte" | "close";
export type ConsultationResultat = "adoptee" | "rejetee";

export interface ConsultationReponse {
  id: string;
  consultationId: string;
  userId: string;
  choix: Choix;
  motivation?: string;
  createdAt: string;
  auteurNom?: string;
}

export interface Consultation {
  id: string;
  question: string;
  contexte?: string;
  deadline: string;
  statut: ConsultationStatut;
  resultat?: ConsultationResultat;
  ouvertePar?: string;
  createdAt: string;
  closedAt?: string;
  reponses: ConsultationReponse[];
}

type LigneReponse = {
  id: string;
  consultation_id: string;
  user_id: string;
  choix: string;
  motivation: string | null;
  created_at: string;
  profiles?: { nom: string } | null;
};

type Ligne = {
  id: string;
  question: string;
  contexte: string | null;
  deadline: string;
  statut: string;
  resultat: string | null;
  ouverte_par: string | null;
  created_at: string;
  closed_at: string | null;
  consultation_reponses?: LigneReponse[];
};

const mapReponse = (r: LigneReponse): ConsultationReponse => ({
  id: r.id,
  consultationId: r.consultation_id,
  userId: r.user_id,
  choix: r.choix as Choix,
  motivation: r.motivation ?? undefined,
  createdAt: r.created_at,
  auteurNom: r.profiles?.nom,
});

const mapConsultation = (c: Ligne): Consultation => ({
  id: c.id,
  question: c.question,
  contexte: c.contexte ?? undefined,
  deadline: c.deadline,
  statut: c.statut as ConsultationStatut,
  resultat: (c.resultat as ConsultationResultat) ?? undefined,
  ouvertePar: c.ouverte_par ?? undefined,
  createdAt: c.created_at,
  closedAt: c.closed_at ?? undefined,
  reponses: (c.consultation_reponses ?? []).map(mapReponse),
});

const SELECT =
  "*, consultation_reponses(*, profiles!consultation_reponses_user_id_fkey(nom))";

export async function fetchConsultations(): Promise<Consultation[]> {
  const { data, error } = await supabase
    .from("consultations")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Ligne[]).map(mapConsultation);
}

/** Secrétariat uniquement (RLS `cons_write_priv`). Notifie les administrateurs. */
export async function ouvrirConsultation(input: {
  question: string;
  contexte?: string;
  deadline: string;
  ouvertePar: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("consultations")
    .insert({
      question: input.question,
      contexte: input.contexte || null,
      deadline: input.deadline,
      ouverte_par: input.ouvertePar,
    })
    .select("id")
    .single();
  if (error) throw error;
  await tracer("Ouverture consultation écrite", input.question);
  return data.id;
}

/** Une seule réponse par membre, définitive, et refusée après la date limite. */
export async function repondreConsultation(
  consultationId: string,
  userId: string,
  choix: Choix,
  motivation?: string,
): Promise<void> {
  const { error } = await supabase.from("consultation_reponses").insert({
    consultation_id: consultationId,
    user_id: userId,
    choix,
    motivation: motivation?.trim() || null,
  });
  if (error) throw error;
  await tracer("Réponse consultation écrite", `${consultationId} → ${choix.toUpperCase()}`);
}

/** Le résultat est décidé par le serveur, jamais par le client. */
export async function cloturerConsultation(consultationId: string): Promise<{
  resultat: ConsultationResultat;
  oui: number;
  non: number;
  abstention: number;
  reponses: number;
  administrateurs: number;
  seuilParticipation: number;
}> {
  const { data, error } = await supabase.rpc("close_consultation", {
    p_consultation_id: consultationId,
  });
  if (error) throw error;
  const r = data as any;
  await tracer("Clôture consultation écrite", `${consultationId} → ${r?.resultat ?? "?"}`);
  return r;
}

/** Dépouillement local — les réponses sont lisibles par tout membre authentifié. */
export function decompte(c: Consultation) {
  const oui = c.reponses.filter((r) => r.choix === "oui").length;
  const non = c.reponses.filter((r) => r.choix === "non").length;
  const abstention = c.reponses.filter((r) => r.choix === "abstention").length;
  return { oui, non, abstention, total: c.reponses.length };
}

export const echue = (c: Consultation) =>
  c.deadline < new Date().toLocaleDateString("en-CA");

/** Ouverte ET dans les délais : seul cas où le serveur acceptera une réponse. */
export const peutRepondre = (c: Consultation) => c.statut === "ouverte" && !echue(c);
