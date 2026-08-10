// État de navigation de l'app mobile : type de vue et persistance d'un
// rafraîchissement à l'autre. Extrait de `admin-app.tsx` pour que les écrans
// (désormais dans des fichiers séparés) puissent typer leur prop `nav`.

// Liste runtime ET type dérivés l'un de l'autre : la vue restaurée après un
// rafraîchissement doit être validée à l'exécution, et cette forme interdit
// que les deux divergent (même dispositif que `SECTION_KEYS` côté Secrétariat).
export const TABS = [
  "home",
  "boardbook",
  "vote",
  "discussions",
  "pca",
  "notifs",
  "profile",
] as const;
export type Tab = (typeof TABS)[number];
export type View = { tab: Tab; sub?: string; data?: any };

/** Signature de la fonction de navigation passée en prop à chaque écran. */
export type Nav = (v: View) => void;

// Écran courant de l'app mobile, conservé d'un rafraîchissement à l'autre.
// Sans cela, un simple F5 ramenait toujours à l'Accueil, y compris en pleine
// signature de PV. La vue complète est mémorisée (onglet + sous-écran + son
// contexte), et RATTACHÉE À L'UTILISATEUR : pendant une démo on bascule d'un
// profil à l'autre (RoleSwitcher), et restaurer l'écran d'un membre dans la
// session d'un autre n'aurait aucun sens.
export const CLE_VUE = "mobile-view";

export function lireVueEnregistree(): { userId?: string; view: View } | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(CLE_VUE);
    if (!brut) return null;
    const parse = JSON.parse(brut) as { userId?: string; view?: View };
    // Une vue écrite par une version antérieure (onglet renommé/supprimé
    // depuis) ne doit pas produire un écran blanc : on la rejette.
    if (!parse?.view || !TABS.includes(parse.view.tab)) return null;
    return { userId: parse.userId, view: parse.view };
  } catch {
    return null; // JSON corrompu : on repart de l'Accueil
  }
}
