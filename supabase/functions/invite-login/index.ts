// Edge Function: invite-login
// Connexion "sans mot de passe" pour le rôle invité (mandataire de procuration) :
// email seul côté client, suivi d'un écran biométrique cosmétique (Face ID) dans
// `auth.tsx`. Ici, service-role, on génère un jeton de lien magique via l'API
// Admin — jamais envoyé par email, juste renvoyé au client qui l'échange
// immédiatement contre une vraie session via `supabase.auth.verifyOtp`. Accès
// public (pas de JWT) : c'est le point d'entrée de connexion lui-même.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Message générique unique pour tout échec : ne jamais laisser deviner quels
// emails existent en base ou quel est leur statut exact.
const ERREUR_GENERIQUE = "Compte invité introuvable ou non autorisé";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Méthode non autorisée" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return json({ error: ERREUR_GENERIQUE }, 403);

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("role, statut")
      .eq("email", email)
      .maybeSingle();
    // `statut` bascule à 'suspendu' par le job private.expirer_invites_obsoletes()
    // une fois la fenêtre de 2 jours après clôture dépassée : ce contrôle suffit,
    // pas besoin d'une colonne "validé" séparée.
    if (!profile || profile.role !== "invite" || profile.statut !== "actif") {
      return json({ error: ERREUR_GENERIQUE }, 403);
    }

    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !link) return json({ error: ERREUR_GENERIQUE }, 403);

    return json({ hashedToken: link.properties.hashed_token });
  } catch {
    return json({ error: ERREUR_GENERIQUE }, 403);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
