# Migrations — état du versionnage

## ⚠️ Ce dossier est INCOMPLET

Au 2026-08-10, la base compte **68 migrations appliquées**, mais elles n'existaient
**que dans le cloud Supabase** : le projet n'a jamais eu de dossier `migrations/`.
Le schéma de la base n'était donc ni versionné, ni relisible, ni reproductible —
pas d'environnement de recette possible, pas de retour arrière.

Seules les **3 migrations du 2026-08-10** sont présentes ici : ce sont les seules
dont le SQL n'existait nulle part ailleurs au moment de les écrire.

## Rapatrier les 65 autres

Le SQL complet est stocké en base (`supabase_migrations.schema_migrations`,
colonne `statements`, ~167 kB au total). La façon propre de le récupérer :

```bash
brew install supabase/tap/supabase   # ou : npm i -g supabase
supabase login
supabase link --project-ref yxprzegttqhussmmaggr
supabase db pull                     # écrit les 68 fichiers dans ce dossier
```

Une fois fait, `git add supabase/migrations && git commit` — et le schéma est
enfin sous contrôle de version au même titre que le code.

## Convention

`<version>_<nom>.sql`, où `version` est l'horodatage `AAAAMMJJhhmmss` utilisé
par Supabase pour l'ordonnancement. Ne jamais renommer ni réécrire une migration
déjà appliquée : en ajouter une nouvelle qui corrige.
