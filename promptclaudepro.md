# Contexte du projet et Objectif
Tu interviens sur le projet "BoardCA", une application SaaS de gouvernance du Conseil d'Administration du BNETD. Le stack technique est basé sur React, TanStack Router, Tailwind CSS, Zustand, et Supabase (Auth, Postgres, Edge Functions).

L'objectif de cette tâche est de **refondre le flux de création d'utilisateur et d'invitation**. Actuellement, le Super Administrateur crée un mot de passe temporaire pour le nouvel utilisateur depuis l'interface d'administration. Nous voulons supprimer cela au profit d'un flux d'invitation sécurisé par email, similaire à un "Magic Link".

## Exigences Fonctionnelles

### 1. Modification du formulaire "Nouvel utilisateur" (Super Admin)
Le formulaire de création d'utilisateur (probablement situé dans la gestion des utilisateurs, ex: `src/components/...`) doit être épuré.
- **Champs à conserver** : 
  - Nom complet (requis)
  - Email (requis)
  - Rôle (requis)
  - Téléphone (optionnel)
  - Qualité (ex. Représentant du Ministère des Finances) (optionnel)
- **Champ à supprimer** : "Mot de passe initial" et son bouton "Générer". Le Super Administrateur ne doit plus gérer ni voir de mot de passe.
- **Logique de création** : Au lieu de créer l'utilisateur avec un mot de passe via l'API (ex: `supabase.auth.admin.createUser`), le système doit générer et envoyer un lien d'invitation. Tu peux utiliser `supabase.auth.admin.inviteUserByEmail` si disponible, ou créer l'utilisateur sans mot de passe puis générer un Magic Link / Recovery Link qui lui est envoyé par email (idéalement via une Edge Function Supabase ou le template d'email d'invitation de Supabase).

### 2. Le flux d'Activation côté Invité (Route `/auth/invite`)
L'utilisateur reçoit un email l'invitant à rejoindre le BoardCA.
- En cliquant sur le lien dans l'email, il est redirigé vers l'application (probablement une route comme `/auth/invite`).
- **Écran d'activation** : 
  - Le champ "Email" doit être pré-rempli avec l'adresse de l'utilisateur (ou identifié grâce au token du Magic Link).
  - L'utilisateur clique sur un bouton "Activer mon compte" (ce qui vérifie l'existence et la validité du token/utilisateur).
- **Création du mot de passe** : 
  - Une fois l'activation validée, afficher un formulaire demandant de créer le mot de passe (champs : "Nouveau mot de passe" et "Confirmer le mot de passe").
  - L'utilisateur doit pouvoir afficher/masquer son mot de passe (icône œil).
  - Valider que les mots de passe correspondent et respectent les règles de sécurité, puis mettre à jour le mot de passe de l'utilisateur (`supabase.auth.updateUser({ password })`).

### 3. Les Connexions Ultérieures (Login classique & OTP/Magic Link)
Une fois le compte activé et le mot de passe créé, pour les prochaines connexions sur `/auth` :
- L'utilisateur saisit son **Email** et son **Mot de passe**.
- **Double vérification / Flexibilité (OTP ou Lien)** : Le système de connexion doit permettre une connexion via Mot de passe. S'il l'oublie, ou pour des raisons de sécurité, le système doit pouvoir lui proposer de s'authentifier (ou de valider sa connexion) via un OTP (code à 6 chiffres) envoyé par email, ou un lien direct (Magic Link) pour avoir accès à son espace. Assure-toi que la page de connexion offre clairement ces options ("Mot de passe oublié", ou "Se connecter avec un code").

## Instructions Techniques et Directives pour le Code

1. **Recherche préalable** : Analyse les composants existants, notamment la modale de création d'utilisateur, la route `/auth/invite.tsx`, et le store Zustand (`useBoardStore`).
2. **Supabase Auth** : Assure-toi de configurer correctement l'appel API pour l'invitation. Gère les cas où un utilisateur existe déjà (pour ne pas écraser ses données).
3. **UI/UX** : Respecte le design system existant (Tailwind, icônes Lucide-react). Utilise les composants existants comme `<Field>`, `<button>`, et les fonctions de notification (`toast` de `sonner`).
4. **Sécurité** : 
   - Le token de l'URL ne doit pas fuiter.
   - Le mot de passe ne doit être mis à jour que si l'utilisateur est bien authentifié via le lien d'invitation (session temporaire).
5. **Nettoyage** : Supprime le code mort lié à l'ancienne génération de mot de passe par le Super Admin (fonctions de génération aléatoire, affichage du mot de passe en clair pour l'admin, etc.).

Prends le temps d'analyser l'architecture avant de faire tes modifications, et procède étape par étape. Commence par la modification du formulaire côté Super Admin, puis adapte le flux de réception côté Invité.
