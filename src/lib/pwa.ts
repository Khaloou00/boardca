// Enregistrement du service worker (`public/sw.js`) et gestion des mises à jour.
//
// Écrit à la main plutôt que via `virtual:pwa-register` : vite-plugin-pwa
// n'émettait aucun service worker dans le build multi-environnements de
// TanStack Start (manifest produit, sw absent — constaté le 2026-08-10).
// Voir l'en-tête de `public/sw.js`.

/** Une nouvelle version est prête et attend d'être appliquée. */
export type SurMiseAJour = (appliquer: () => void) => void;

export function enregistrerServiceWorker(surMiseAJour?: SurMiseAJour) {
  if (typeof window === "undefined") return; // rendu serveur
  if (!("serviceWorker" in navigator)) return; // navigateur sans support
  // Le service worker exige HTTPS — sauf sur localhost, autorisé pour le dev.
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      const proposer = (attendant: ServiceWorker) => {
        // On n'applique JAMAIS la mise à jour d'autorité : recharger l'app en
        // pleine signature de PV ou en pleine saisie ferait perdre le travail.
        // C'est l'utilisateur qui décide, via l'invite passée en callback.
        surMiseAJour?.(() => {
          attendant.postMessage("SKIP_WAITING");
          // Le nouveau SW prend la main → on recharge une seule fois.
          let recharge = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (recharge) return;
            recharge = true;
            window.location.reload();
          });
        });
      };

      // Cas 1 : une version attend déjà (onglet rouvert après un déploiement).
      if (registration.waiting && navigator.serviceWorker.controller) {
        proposer(registration.waiting);
      }

      // Cas 2 : une version arrive pendant que l'app est ouverte.
      registration.addEventListener("updatefound", () => {
        const nouveau = registration.installing;
        if (!nouveau) return;
        nouveau.addEventListener("statechange", () => {
          // `controller` non nul = ce n'est pas la première installation, donc
          // il s'agit bien d'une mise à jour et pas du tout premier démarrage.
          if (nouveau.state === "installed" && navigator.serviceWorker.controller) {
            proposer(nouveau);
          }
        });
      });

      // Une PWA reste ouverte des jours : sans cela, une mise à jour ne serait
      // détectée qu'au prochain démarrage à froid.
      setInterval(() => registration.update().catch(() => undefined), 60 * 60 * 1000);
    } catch {
      // Un échec d'enregistrement ne doit jamais empêcher l'app de fonctionner.
    }
  });
}
