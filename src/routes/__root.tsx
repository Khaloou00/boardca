import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { AppProvider } from "../lib/app-store";

import { Toaster } from "../components/ui/sonner";
import { useBootstrap } from "../hooks/useBootstrap";
import { enregistrerServiceWorker } from "../lib/pwa";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">Cette page n'existe pas.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Réessayer
          </button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm">
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // `viewport-fit=cover` : l'app peint sous l'encoche et la barre gestuelle
      // de l'iPhone ; les marges sont reprises en CSS via env(safe-area-inset-*).
      // `maximum-scale` n'est PAS bridé : brider le zoom casse l'accessibilité,
      // et le lecteur PDF a besoin du pincer-zoomer.
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      // Couleur de la barre système, en clair comme en sombre.
      { name: "theme-color", content: "#0D1B3E" },
      // iOS ignore le manifest : ces balises sont le seul moyen d'obtenir le
      // plein écran et le bon titre une fois l'app posée sur l'écran d'accueil.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "BoardCA" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "BoardCA" },
      { title: "BoardCA — Gouvernance du Conseil d'Administration BNETD" },
      {
        name: "description",
        content:
          "Plateforme SaaS de gouvernance pour le Conseil d'Administration du BNETD : planification, PV, votes, archives.",
      },
      { name: "author", content: "BNETD" },
      { property: "og:title", content: "BoardCA — Gouvernance CA BNETD" },
      {
        property: "og:description",
        content: "SaaS de gouvernance : réunions, PV, votes électroniques, Board Book mobile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "icon", href: "/icon-512.png", type: "image/png", sizes: "512x512" },
      // iOS n'utilise ni le manifest ni `rel=icon` pour l'écran d'accueil.
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Service worker : hors ligne, installabilité et notifications push.
  // La mise à jour n'est JAMAIS appliquée d'autorité — recharger l'app pendant
  // une signature de PV ou une saisie ferait perdre le travail en cours.
  useEffect(() => {
    enregistrerServiceWorker((appliquer) => {
      toast("Nouvelle version disponible", {
        description: "Rechargez pour l'appliquer.",
        duration: Infinity,
        action: { label: "Recharger", onClick: appliquer },
      });
    });
  }, []);

  useBootstrap(); // hydrate le profil Supabase + données cœur, ouvre les canaux Realtime
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Outlet />
        <Toaster position="top-right" />
      </AppProvider>
    </QueryClientProvider>
  );
}
