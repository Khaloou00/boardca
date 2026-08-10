// Fonctions utilitaires de l'app mobile, extraites de `admin-app.tsx`.
// Pures et sans état : aucune raison de vivre dans le composant.

/** "à l'instant" / "12 min" / "3 h" / "5 j" — horodatage court des notifications. */
export function relativeTimeShort(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

// NOTE : `randomHash` n'est appelée nulle part dans l'application (code mort
// repéré lors de l'extraction du 2026-08-10, conservée à l'identique pour ne
// rien changer au comportement). À supprimer si aucun usage n'est prévu.
export function randomHash(seed = "") {
  const chars = "abcdef0123456789";
  let s = seed;
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s.slice(0, 12);
}
