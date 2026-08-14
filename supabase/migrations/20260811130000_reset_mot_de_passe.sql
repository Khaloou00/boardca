-- Throttle des demandes de réinitialisation de mot de passe : empêche qu'un
-- appel répété à l'edge function `request-password-reset` inonde la boîte
-- d'un compte réel (email-bombing) ou serve d'oracle pour deviner quels
-- emails existent. Accès service-role uniquement (RLS activée, aucune
-- policy — même posture que `app_secrets`).
create table public.password_reset_requests (
  email text primary key,
  requested_at timestamptz not null default now()
);

alter table public.password_reset_requests enable row level security;
