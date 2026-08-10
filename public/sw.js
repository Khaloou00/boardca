/* BoardCA — Service Worker
 *
 * Écrit à la main plutôt que généré par vite-plugin-pwa : le plugin s'exécute
 * par environnement dans le build multi-environnements de TanStack Start et
 * n'émettait jamais le fichier (manifest produit, service worker absent —
 * constaté au build du 2026-08-10). Les fichiers de `public/` sont, eux,
 * copiés verbatim dans `dist/client/` quel que soit le framework.
 *
 * PRINCIPE DE SÛRETÉ : rien de ce qui vient de Supabase n'est mis en cache.
 * Les réponses REST sont filtrées par RLS pour l'utilisateur courant ; les
 * resservir depuis un cache partagé exposerait les données d'un membre à un
 * autre sur le même appareil. Idem pour l'authentification. Seuls les
 * ASSETS STATIQUES de notre propre origine sont mis en cache.
 */

const VERSION = "boardca-v1";
const CACHE_ASSETS = `${VERSION}-assets`;
const CACHE_PAGES = `${VERSION}-pages`;

// Coquille minimale disponible hors ligne.
const PRECACHE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_PAGES)
      // `reload` : ne pas peupler le cache depuis le cache HTTP du navigateur.
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" })))))
      // On n'active PAS tout de suite : voir le message SKIP_WAITING plus bas.
      .then(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const noms = await caches.keys();
      await Promise.all(noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
      // Accélère la navigation au premier chargement.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

// La page décide QUAND appliquer la mise à jour : on ne recharge jamais
// l'application sous les doigts de quelqu'un en pleine signature de PV.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** Tout ce qui ne doit jamais transiter par le cache. */
function horsCache(url, request) {
  // Supabase : REST (RLS), Auth, Realtime, Storage (documents confidentiels).
  if (/\.supabase\.(co|in)$/.test(url.hostname)) return true;
  // Toute origine tierce (polices Google, etc.) : laissée au cache HTTP natif.
  if (url.origin !== self.location.origin) return true;
  // Seules les lectures sont cachables.
  if (request.method !== "GET") return true;
  return false;
}

/** Fichiers versionnés par le build : leur nom change à chaque déploiement. */
function estAssetImmuable(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    /\.(js|mjs|css|woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (horsCache(url, request)) return; // laissé au réseau, sans interception

  // 1. Navigations : réseau d'abord (contenu frais), repli sur la coquille.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          const reseau = await fetch(request);
          const cache = await caches.open(CACHE_PAGES);
          cache.put("/", reseau.clone()).catch(() => undefined);
          return reseau;
        } catch {
          const cache = await caches.open(CACHE_PAGES);
          return (
            (await cache.match(request)) ??
            (await cache.match("/")) ??
            new Response(
              "<!doctype html><meta charset=utf-8><title>Hors ligne</title>" +
                "<body style='font-family:system-ui;padding:2rem;text-align:center'>" +
                "<h1>Hors ligne</h1><p>BoardCA n'a pas pu joindre le serveur.</p>",
              { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
            )
          );
        }
      })(),
    );
    return;
  }

  // 2. Assets versionnés : cache d'abord (leur nom change à chaque build).
  if (estAssetImmuable(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_ASSETS);
        const enCache = await cache.match(request);
        if (enCache) return enCache;
        const reseau = await fetch(request);
        if (reseau.ok) cache.put(request, reseau.clone()).catch(() => undefined);
        return reseau;
      })(),
    );
  }
});

/* ── Notifications push ──────────────────────────────────────────────────
 * Le contenu reste NEUTRE : un PV, un scrutin ou une convocation sont des
 * informations sensibles, et une notification s'affiche sur un écran
 * verrouillé. Le détail ne se lit que dans l'application, après connexion.
 */
self.addEventListener("push", (event) => {
  let charge = {};
  try {
    charge = event.data ? event.data.json() : {};
  } catch {
    charge = { titre: "BoardCA", message: event.data ? event.data.text() : "" };
  }

  const titre = charge.titre || "BoardCA";
  const options = {
    body: charge.message || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    lang: "fr",
    // `tag` dédoublonne : une même ressource ne s'empile pas en 5 notifications.
    tag: charge.ressourceId || charge.type || "boardca",
    renotify: true,
    data: { url: charge.url || "/mobile", type: charge.type ?? null },
  };

  event.waitUntil(
    self.registration.showNotification(titre, options).then(async () => {
      // Pastille de compteur sur l'icône (Android/Chrome, iOS installé).
      if (typeof charge.nonLus === "number" && self.navigator?.setAppBadge) {
        try {
          await self.navigator.setAppBadge(charge.nonLus);
        } catch {
          /* non critique */
        }
      }
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = event.notification.data?.url || "/mobile";
  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Réutiliser une fenêtre déjà ouverte plutôt que d'en empiler une nouvelle.
      for (const f of fenetres) {
        if (new URL(f.url).origin === self.location.origin) {
          await f.focus();
          if ("navigate" in f) await f.navigate(cible).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(cible);
    })(),
  );
});
