import { useState } from "react";

// Onglet actif des espaces Secrétariat / Super Admin, conservé d'un
// rafraîchissement à l'autre. Sans cela, un simple F5 (ou un rechargement
// provoqué par l'outil de dev) renvoyait systématiquement au « Tableau de
// bord », quel que soit l'écran ouvert.
//
// Persisté en `localStorage`, comme le repli des barres latérales
// (`sec-nav-collapsed` / `sa-nav-collapsed`) et le choix téléphone/tablette
// (`mobile-preview-appareil`) — même convention, aucun schéma d'URL à
// introduire.
//
// La valeur relue est TOUJOURS validée contre la liste des sections
// réellement existantes : une clé écrite par une version antérieure de l'app
// (section renommée ou supprimée depuis) ne doit pas rendre un écran vide,
// mais retomber proprement sur la section par défaut.
export function useSectionPersistante<T extends string>(
  cleStockage: string,
  sectionsValides: readonly T[],
  defaut: T,
): [T, (s: T) => void] {
  const [section, setSectionState] = useState<T>(() => {
    if (typeof window === "undefined") return defaut; // rendu serveur : pas de localStorage
    const enregistre = window.localStorage.getItem(cleStockage);
    return sectionsValides.includes(enregistre as T) ? (enregistre as T) : defaut;
  });

  const setSection = (s: T) => {
    setSectionState(s);
    if (typeof window !== "undefined") window.localStorage.setItem(cleStockage, s);
  };

  return [section, setSection];
}
