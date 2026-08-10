// Edge Function: procuration-notify
// Un membre du CA désigne comme mandataire une PERSONNE DÉJÀ DANS LE SYSTÈME
// (autre membre du CA, Secrétaire, invité déjà validé lors d'une réunion
// antérieure) — ce chemin (`addProcuration`, INSERT client direct dans
// `procurations`, RLS `proc_write_self`) ne passait par aucune edge function
// et donc n'envoyait jamais d'email : seule la désignation d'un NOUVEL invité
// externe (edge fn `invite-guest`) alertait par email. Cette fonction comble
// l'écart : appelée par le client juste après un `addProcuration` réussi, elle
// retrouve la procuration active tout juste créée par l'appelant et envoie un
// email d'alerte (EmailJS, même config que `invite-guest`) au mandataire —
// avec un lien vers la connexion normale (`/auth`), pas `/auth/invite`,
// puisque cette personne a déjà un compte et son propre mot de passe.
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

  const body = await req.json().catch(() => null);
  const { reunionId } = body ?? {};
  if (!reunionId) return json({ error: "Réunion requise" }, 400);

  try {
    // On ne notifie que pour LA procuration que l'appelant vient lui-même de
    // poser (jamais pour le compte d'un tiers) : de_user_id = caller.id.
    const { data: procuration } = await admin
      .from("procurations")
      .select("vers_user_id")
      .eq("reunion_id", reunionId)
      .eq("de_user_id", caller.id)
      .eq("statut", "active")
      .maybeSingle();
    if (!procuration) {
      return json({ error: "Aucune procuration active trouvée pour cette réunion" }, 404);
    }

    const [{ data: mandataire }, { data: mandant }, { data: reunion }, { data: secrets }] =
      await Promise.all([
        admin.from("profiles").select("email, nom").eq("id", procuration.vers_user_id).single(),
        admin.from("profiles").select("nom").eq("id", caller.id).single(),
        admin.from("reunions").select("titre, date_reunion").eq("id", reunionId).single(),
        admin
          .from("app_secrets")
          .select("key, value")
          .in("key", [
            "emailjs_service_id",
            "emailjs_template_id",
            "emailjs_public_key",
            "emailjs_private_key",
            "site_url",
          ]),
      ]);
    if (!mandataire?.email) return json({ error: "Mandataire introuvable" }, 404);

    const val = (k: string) => secrets?.find((s) => s.key === k)?.value;
    const serviceId = val("emailjs_service_id");
    const templateId = val("emailjs_template_id");
    const publicKey = val("emailjs_public_key");
    const privateKey = val("emailjs_private_key");
    const siteUrl = val("site_url") ?? "";

    if (!serviceId || !templateId || !publicKey || !privateKey) {
      return json({ emailSent: false, emailError: "Configuration EmailJS incomplète" });
    }

    const dateLabel = reunion?.date_reunion
      ? new Date(`${reunion.date_reunion}T12:00:00`).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

    const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: mandataire.email,
          to_name: mandataire.nom,
          mandant_nom: mandant?.nom ?? "Un membre du Conseil d'Administration",
          reunion_titre: reunion?.titre ?? "une séance du Conseil",
          reunion_date: dateLabel ? `Séance du ${dateLabel}` : "Date à confirmer",
          motif: "Non précisé",
          lien: `${siteUrl}/auth`,
        },
      }),
    });
    const emailSent = resp.ok;
    const emailError = emailSent ? undefined : await resp.text().catch(() => "Échec de l'envoi");
    return json({ emailSent, emailError });
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
