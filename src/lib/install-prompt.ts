// Capture de `beforeinstallprompt`, AU CHARGEMENT DU MODULE.
//
// Le navigateur émet cet événement très tôt, souvent avant que React n'ait
// monté quoi que ce soit. Un écouteur posé dans un `useEffect` arrive donc
// régulièrement trop tard et ne le voit jamais passer — le bouton d'installation
// reste alors invisible sans raison apparente. (Même famille de piège que
// l'événement `load` pour le service worker.)
//
// Ce module s'importe depuis la racine de l'application : son effet de bord
// s'exécute dès l'évaluation du bundle d'entrée, donc au plus tôt.

export type InvitationInstallation = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let invitation: InvitationInstallation | null = null;
let installee = false;
const abonnes = new Set<() => void>();

function prevenir() {
  for (const f of abonnes) f();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // sinon Chrome affiche sa propre bannière
    invitation = e as InvitationInstallation;
    prevenir();
  });
  window.addEventListener("appinstalled", () => {
    installee = true;
    invitation = null; // l'événement n'est utilisable qu'une fois
    prevenir();
  });
}

export function invitationDisponible(): InvitationInstallation | null {
  return invitation;
}

export function consommerInvitation() {
  invitation = null;
  prevenir();
}

export function marquerInstallee() {
  installee = true;
  prevenir();
}

export function dejaInstallee(): boolean {
  if (typeof window === "undefined") return false;
  return (
    installee ||
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS n'implémente pas display-mode ; il expose `navigator.standalone`.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function surChangement(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/** Plateforme, pour donner la bonne marche à suivre quand l'invite native manque. */
export function plateforme(): "ios" | "android" | "bureau" {
  if (typeof navigator === "undefined") return "bureau";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return "ios";
  if (/android/i.test(ua)) return "android";
  return "bureau";
}
