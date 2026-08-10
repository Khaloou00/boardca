import { supabase } from "@/lib/supabase";

// Paramètres de gouvernance : barème des jetons de présence et paiement des jetons.
//
// Un seul montant par TYPE de séance : le jeton se mérite par la participation, quelle
// qu'en soit la forme (en salle, en visio, ou représenté par une procuration). Seule
// l'absence ne donne droit à rien.
//
// La table `baremes_jetons` reste, elle, indexée par (type_reunion, mode) — c'est ainsi
// que le trigger de clôture joint le barème à la ligne de présence. On écrit donc le même
// montant sur les trois modes présents ; le mode n'est plus une variable de décision, mais
// on garde la colonne, qui documente ce qui a été versé et pourquoi.

export type TypeReunion = "ca_ordinaire" | "ca_extraordinaire" | "comite";
export type ModeBareme = "presentiel" | "distance" | "procuration" | "absent";

/** Modes valant présence : ils reçoivent tous le montant du type de séance. */
export const MODES_PRESENTS: ModeBareme[] = ["presentiel", "distance", "procuration"];

export const TYPES_BAREME: { type: TypeReunion; label: string; aide: string }[] = [
  {
    type: "ca_extraordinaire",
    label: "CA Extraordinaire",
    aide: "Séance convoquée hors calendrier ordinaire",
  },
  {
    type: "ca_ordinaire",
    label: "CA Ordinaire",
    aide: "Séance du calendrier statutaire du Conseil",
  },
  // Les comités ne sont plus barémés ici : le Conseil ne crée que des séances
  // ordinaires et extraordinaires.
];

/** Barème : type de séance → montant du jeton, en FCFA. */
export type Bareme = Record<string, number>;

export async function fetchBareme(): Promise<Bareme> {
  const { data, error } = await supabase
    .from("baremes_jetons")
    .select("type_reunion, mode, montant");
  if (error) throw error;
  // Le montant d'un type est celui du présentiel (les trois modes présents portent la
  // même valeur ; on lit le plus grand pour rester juste si un barème historique diffère).
  const parType: Bareme = {};
  for (const r of data ?? []) {
    if (r.mode === "absent") continue;
    const m = Number(r.montant);
    parType[r.type_reunion] = Math.max(parType[r.type_reunion] ?? 0, m);
  }
  return parType;
}

/**
 * Écrit le barème : un montant par type, recopié sur chaque mode de présence.
 * La RLS `baremes_write` réserve l'écriture au secrétariat — un autre rôle est refusé
 * côté serveur, pas seulement dans l'interface.
 */
export async function saveBareme(lignes: { type: TypeReunion; montant: number }[]) {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase.from("baremes_jetons").upsert(
    lignes.flatMap((l) =>
      MODES_PRESENTS.map((mode) => ({
        type_reunion: l.type,
        mode,
        montant: l.montant,
        updated_at: new Date().toISOString(),
        updated_by: session.user?.id,
      })),
    ),
    { onConflict: "type_reunion,mode" },
  );
  if (error) throw error;
}

// ─── Paiement des jetons ─────────────────────────────────────────

export type JetonLigne = {
  id: string;
  reunionId: string;
  userId: string;
  mode: string;
  montant: number;
  paye: boolean;
  payeAt: string | null;
};

export type SeanceJetons = {
  reunionId: string;
  titre: string;
  date: string;
  type: string;
  lignes: JetonLigne[];
  total: number;
  totalPaye: number;
  totalAttente: number;
  nbAttente: number;
};

/**
 * Jetons par séance clôturée. Les jetons n'existent que pour les séances terminées
 * (générés par `trg_generate_jetons`), donc la présence d'une séance ici signifie
 * qu'elle est close et que sa rémunération est due.
 */
export async function fetchJetonsParSeance(): Promise<SeanceJetons[]> {
  const { data, error } = await supabase
    .from("jetons_presence")
    .select(
      "id, reunion_id, user_id, mode, montant, paye, paye_at, reunions(titre, date_reunion, type)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const parSeance = new Map<string, SeanceJetons>();
  for (const row of data ?? []) {
    const r = row.reunions as { titre: string; date_reunion: string; type: string } | null;
    if (!r) continue;
    const seance =
      parSeance.get(row.reunion_id) ??
      ({
        reunionId: row.reunion_id,
        titre: r.titre,
        date: r.date_reunion,
        type: r.type,
        lignes: [],
        total: 0,
        totalPaye: 0,
        totalAttente: 0,
        nbAttente: 0,
      } satisfies SeanceJetons);

    const montant = Number(row.montant);
    seance.lignes.push({
      id: row.id,
      reunionId: row.reunion_id,
      userId: row.user_id,
      mode: row.mode,
      montant,
      paye: row.paye,
      payeAt: row.paye_at,
    });
    seance.total += montant;
    if (row.paye) seance.totalPaye += montant;
    else if (montant > 0) {
      seance.totalAttente += montant;
      seance.nbAttente += 1;
    }
    parSeance.set(row.reunion_id, seance);
  }

  return [...parSeance.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Valide le paiement. `userIds` omis = toute la séance. Retourne le nombre de jetons payés. */
export async function validerPaiementJetons(
  reunionId: string,
  userIds?: string[],
): Promise<number> {
  const { data, error } = await supabase.rpc("valider_paiement_jetons", {
    p_reunion_id: reunionId,
    p_user_ids: userIds ?? undefined,
  });
  if (error) throw error; // message FR déjà utilisateur-final (raise exception côté RPC)
  return data ?? 0;
}
