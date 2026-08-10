// Edge Function: admin-users
// Crée ou supprime un vrai compte utilisateur (auth.users + profil). Réservé au super_admin.
// La clé service_role ne quitte jamais le navigateur : elle ne vit que dans cette fonction,
// injectée automatiquement par la plateforme (SUPABASE_SERVICE_ROLE_KEY).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_PASSWORD = "BoardCA2026!";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Le navigateur envoie un préflight OPTIONS avant tout POST cross-origin.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Méthode non autorisée" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Non authentifié" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client scopé à l'appelant : sert uniquement à l'identifier et vérifier son rôle.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
  } = await callerClient.auth.getUser();
  if (!caller) return json({ error: "Non authentifié" }, 401);

  const { data: callerProfile } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();
  if (callerProfile?.role !== "super_admin") {
    return json({ error: "Réservé au Super Administrateur" }, 403);
  }

  // Client admin (service_role) : seule cette fonction peut créer/supprimer des comptes auth.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const body = await req.json().catch(() => null);
  if (!body?.action) return json({ error: "Requête invalide" }, 400);

  try {
    if (body.action === "create") {
      const { email, nom, role, telephone, qualite } = body;
      if (!email || !nom || !role) return json({ error: "Champs requis manquants" }, 400);

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { nom },
      });
      if (createError || !created.user) {
        return json({ error: createError?.message ?? "Échec de la création du compte" }, 400);
      }

      // Le trigger on_auth_user_created a déjà inséré un profil par défaut ; on le complète.
      const { error: updateError } = await admin
        .from("profiles")
        .update({ role, telephone, qualite })
        .eq("id", created.user.id);
      if (updateError) return json({ error: updateError.message }, 400);

      return json({ id: created.user.id });
    }

    if (body.action === "delete") {
      const { id } = body;
      if (!id) return json({ error: "Identifiant manquant" }, 400);
      const { error: deleteError } = await admin.auth.admin.deleteUser(id);
      if (deleteError) return json({ error: deleteError.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erreur interne" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
