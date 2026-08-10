import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
  plugins: [
    tailwindcss(),
    tanstackStart({
      // Redirect the bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    viteReact(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker.ts",
      registerType: "autoUpdate",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      },
      manifest: {
        name: "BoardCA BNETD",
        short_name: "BoardCA",
        description: "Solution digitale de pilotage du CA BNETD",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/Logo_bnetd_transparence.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/Logo_bnetd_transparence.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    }),
  ],
});
