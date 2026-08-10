// Archives — historique en LECTURE SEULE.
// Le dossier d'archive d'une séance (PV, émargement, votes, convocations, actions) vit
// désormais dans `archive-reunion.ts`, sous l'identifiant de la réunion. Ne reste ici que
// la liste des PV scellés, utilisée par l'onglet Archives du PV (secrétariat et mobile).
import { supabase } from "@/lib/supabase";

export interface PvArchive {
  id: string;
  reunionId: string;
  reunionTitre: string;
  date: string;
  statut: string;
  hash: string | null;
  archiveAt: string | null;
  scellePar: string | null; // le PCA (seule signature portée au PV)
  accords: number; // signatures des membres = accords
}

// Le PV ne porte QUE la signature du PCA ; les signatures des membres valent accord.
export async function fetchPvArchives(): Promise<PvArchive[]> {
  const { data } = await supabase
    .from("pv")
    .select(
      "id, reunion_id, statut, hash_document, archive_at, version, reunions(titre, date_reunion), signatures(user_id, pv_version, profiles(nom, est_president_ca))",
    )
    .in("statut", ["signe", "archive"]);
  return (data ?? [])
    .map((p: any) => {
      // Ne compter que les signatures de la version qui a effectivement scellé le
      // PV — un renvoi avant scellement laisse d'anciennes manches en base
      // (immuables) qui ne doivent pas gonfler le compte d'accords.
      const sigs = (p.signatures ?? []).filter((s: any) => s.pv_version === p.version);
      const pca = sigs.find((s: any) => s.profiles?.est_president_ca);
      return {
        id: p.id,
        reunionId: p.reunion_id,
        reunionTitre: p.reunions?.titre ?? "Séance",
        date: p.reunions?.date_reunion ?? "",
        statut: p.statut,
        hash: p.hash_document,
        archiveAt: p.archive_at,
        scellePar: pca?.profiles?.nom ?? null,
        accords: sigs.length,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
