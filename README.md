# BoardCA — BNETD

Board Portal de gouvernance pour Conseil d'Administration. Digitalise le cycle
complet des réunions du CA — préparation, Board Book, convocations, présences,
votes, PV signé et archives — dans une interface unique multi-rôles.

> **Données en mémoire — pas de backend.** Tout l'état (utilisateurs, réunions,
> documents, votes, actions, journal d'audit) vit dans un store React et est
> réinitialisé à chaque rechargement. Aucune base de données n'est requise.

## Prérequis

- Node.js ≥ 20
- npm (fourni avec Node)

## Installation

```bash
npm install
```

## Scripts

```bash
npm run dev        # serveur de dev sur http://localhost:8080
npm run build      # build de production
npm run preview    # prévisualise le build
npm run lint       # ESLint
npm run format     # Prettier --write
```

## Stack

- **Framework / SSR** : [TanStack Start](https://tanstack.com/start) (React 19, TypeScript)
- **Routing** : TanStack Router (routes fichier dans `src/routes`)
- **Build** : Vite 8
- **Styling** : Tailwind CSS v4 + composants shadcn/ui (Radix)
- **Graphiques** : Recharts
- **State** : Context React (`src/lib/app-store.tsx`) — source unique de vérité
- **Divers** : react-hook-form + zod, jsPDF (export PDF), js-sha256 (chaîne d'audit)

## Structure

```
src/
  routes/          Routes TanStack (/, /auth, /super-admin, /secretary, /mobile, /actions)
    __root.tsx     Shell HTML, providers, error/404 boundaries
  components/
    ui/            Primitives shadcn/ui réutilisables
    super-admin/   Panneaux de l'espace Super Administrateur
    secretary/     Panneaux de l'espace Secrétaire du CA
    mobile/        Mockup iPhone + app Administrateur
  lib/
    app-store.tsx  Store global + données de seed (BNETD)
    pdf-export.ts  Génération PDF (Board Book, PV)
    signature.ts   signature certifiée
    error-*.ts     Gestion d'erreurs SSR
  server.ts        Entrée serveur SSR (wrapper d'erreurs)
  start.ts         Middleware TanStack Start
```

## Rôles

| Route          | Profil                     | Interface        |
| -------------- | -------------------------- | ---------------- |
| `/super-admin` | Super Administrateur (DSI) | Desktop          |
| `/secretary`   | Secrétaire du CA           | Desktop          |
| `/mobile`      | Administrateur (membre)    | Mockup iPhone    |
| `/actions`     | Responsable d'Action       | Desktop / Mobile |

---

© 2026 BNETD · BoardCA
