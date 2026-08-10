import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

// Standard TanStack Start + Vite config.
// The `@/*` alias (from tsconfig.json paths) is resolved natively via
// resolve.tsconfigPaths — Vite 8 recommends this over the vite-tsconfig-paths plugin.
export default defineConfig({
  server: {
    port: 8080,
  },
  resolve: {
    tsconfigPaths: true,
  },
  // NOTE 2026-08-10 : `vite-plugin-pwa` a été retiré. Dans le build
  // multi-environnements de TanStack Start il s'exécutait par environnement
  // sans jamais accrocher la fin du build client : le manifest était produit
  // (deux fois, jusque dans dist/server/) mais AUCUN service worker n'était
  // émis. Le service worker et le manifest sont désormais des fichiers de
  // `public/`, copiés verbatim — voir public/sw.js et src/lib/pwa.ts.
  plugins: [
    tailwindcss(),
    tanstackStart({
      // Redirect the bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      // Mode SPA. Les 6 routes de l'application sont TOUTES en `ssr: false` :
      // le rendu serveur ne servait donc à rien, mais il faisait produire au build
      // un serveur Nitro sans le moindre `index.html` — d'où le 404 de Vercel, qui
      // ne trouvait aucun fichier à servir.
      // En SPA, le build émet une coquille HTML statique : n'importe quel
      // hébergeur de fichiers la sert, et le service worker n'a plus à composer
      // avec un rendu serveur.
      spa: {
        enabled: true,
        // La coquille est pré-rendue depuis cette route puis réutilisée pour
        // toutes les autres (le routeur prend la main côté navigateur).
        // `outputPath` reçoit l'extension .html en suffixe : le donner à "/"
        // produit un fichier nommé « .html », invisible et inutilisable.
        prerender: { enabled: true, crawlLinks: false, outputPath: "/index.html" },
      },
    }),
    viteReact(),
  ],
});
