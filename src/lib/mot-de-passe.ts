// Politique de mot de passe, commune à TOUS les écrans qui en font choisir un.
//
// Elle vivait en double : `/auth/invite` appliquait une vraie règle (longueur,
// casse, chiffre, caractère spécial) tandis que `/auth` se contentait de
// « 8 caractères minimum ». Résultat concret le 2026-08-10 : deux membres,
// invités à choisir leur mot de passe, ont retapé `0101010101` — l'ancien mot
// de passe de démonstration, lisible dans l'historique public du dépôt. Il a
// été accepté, et leurs comptes sont redevenus ouverts à quiconque lit le code.
//
// D'où deux principes :
//  1. une seule définition de la règle, importée partout ;
//  2. une liste d'exclusion explicite — la robustesse formelle ne suffit pas,
//     un mot de passe publiquement connu doit être refusé même s'il coche
//     toutes les cases.

export type Critere = { ok: boolean; label: string };

/**
 * Mots de passe interdits parce que PUBLIQUEMENT CONNUS pour ce projet, ou
 * trop évidents. La comparaison ignore la casse.
 *
 * `0101010101` a été le mot de passe partagé des 10 comptes et figure dans
 * l'historique git du dépôt public : il ne doit plus jamais être réutilisable.
 */
const INTERDITS = [
  "0101010101",
  "boardca",
  "bnetd",
  "password",
  "motdepasse",
  "azerty",
  "qwerty",
  "12345678",
  "123456789",
  "1234567890",
];

function estInterdit(pwd: string): boolean {
  const p = pwd.trim().toLowerCase();
  if (INTERDITS.includes(p)) return true;
  // Un mot de passe qui ne fait que répéter un motif court (0101010101,
  // abababab…) n'apporte aucune entropie réelle.
  return /^(.{1,3})\1{2,}$/.test(p);
}

export function evaluerMotDePasse(pwd: string): { criteres: Critere[]; valide: boolean } {
  const criteres: Critere[] = [
    { ok: pwd.length >= 8, label: "Au moins 8 caractères" },
    { ok: /[a-z]/.test(pwd), label: "Une minuscule" },
    { ok: /[A-Z]/.test(pwd), label: "Une majuscule" },
    { ok: /[0-9]/.test(pwd), label: "Un chiffre" },
    { ok: /[^A-Za-z0-9]/.test(pwd), label: "Un caractère spécial (!@#$…)" },
    { ok: pwd.length > 0 && !estInterdit(pwd), label: "Pas un mot de passe courant ou déjà diffusé" },
  ];
  return { criteres, valide: criteres.every((c) => c.ok) };
}

/** Message court, pour les écrans qui n'affichent pas la liste des critères. */
export function premierDefaut(pwd: string): string | null {
  const { criteres } = evaluerMotDePasse(pwd);
  return criteres.find((c) => !c.ok)?.label ?? null;
}
