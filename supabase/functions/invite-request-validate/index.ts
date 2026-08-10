// Edge Function: invite-request-validate
// La Secrétaire (ou le super_admin) valide une demande d'invité externe créée
// par un membre du CA (`demandes_invite`, statut 'en_attente'). Contrairement à
// l'ancien `guest-designation`, le compte n'existe pas avant cette validation,
// et n'a AUCUN mot de passe : la connexion invité se fait uniquement par email
// (voir `invite-login`), donc aucun secret à transmettre ici.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
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

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
  } = await callerClient.auth.getUser();
  if (!caller) return json({ error: "Non authentifié" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();
  if (callerProfile?.role !== "secretaire" && callerProfile?.role !== "super_admin") {
    return json({ error: "Réservé à la Secrétaire du CA" }, 403);
  }

  const body = await req.json().catch(() => null);
  const { demandeId } = body ?? {};
  if (!demandeId) return json({ error: "Identifiant de la demande manquant" }, 400);

  try {
    const { data: demande } = await admin
      .from("demandes_invite")
      .select("id, reunion_id, de_user_id, nom, prenom, email, statut")
      .eq("id", demandeId)
      .single();
    if (!demande) return json({ error: "Demande introuvable" }, 404);
    if (demande.statut !== "en_attente") {
      return json({ error: "Cette demande a déjà été traitée" }, 409);
    }

    // Réutilise un profil existant si l'email a déjà un compte (créé entre-
    // temps par un autre chemin) — évite les doublons plutôt que d'échouer.
    const { data: existant } = await admin
      .from("profiles")
      .select("id")
      .eq("email", demande.email)
      .maybeSingle();

    let versUserId = existant?.id;
    if (!versUserId) {
      // Aucun mot de passe : ce rôle ne se connecte que via `invite-login`
      // (email + lien magique généré côté serveur, jamais envoyé par mail).
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: demande.email,
        email_confirm: true,
        user_metadata: { nom: `${demande.nom} ${demande.prenom}` },
      });
      if (createError || !created.user) {
        return json({ error: createError?.message ?? "Échec de la création du compte" }, 400);
      }
      const { error: profileError } = await admin
        .from("profiles")
        .update({ role: "invite", nom: `${demande.nom} ${demande.prenom}` })
        .eq("id", created.user.id);
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: profileError.message }, 400);
      }
      versUserId = created.user.id;
    }

    const { error: procError } = await admin.from("procurations").upsert(
      {
        reunion_id: demande.reunion_id,
        de_user_id: demande.de_user_id,
        vers_user_id: versUserId,
        statut: "active",
      },
      { onConflict: "reunion_id,de_user_id" },
    );
    if (procError) return json({ error: procError.message }, 400);

    // Non bloquant : la procuration existe déjà si cette écriture échoue.
    await admin
      .from("convocations")
      .update({ statut: "excused" })
      .eq("reunion_id", demande.reunion_id)
      .eq("user_id", demande.de_user_id);

    const { error: demandeError } = await admin
      .from("demandes_invite")
      .update({
        statut: "validee",
        vers_user_id: versUserId,
        decided_at: new Date().toISOString(),
        decided_by: caller.id,
      })
      .eq("id", demandeId);
    if (demandeError) return json({ error: demandeError.message }, 400);

    return json({ versUserId });
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
