// Edge Function: send-login-otp
// 2FA obligatoire : après une connexion email + mot de passe réussie
// (session déjà valide), envoie un code de vérification par email. La
// connexion ne se termine réellement (entrée dans l'application) qu'une fois
// ce code saisi et vérifié côté client (`supabase.auth.verifyOtp`).
//
// Contrairement à `request-password-reset` (public, réponse générique), cette
// fonction est AUTHENTIFIÉE : l'appelant a déjà prouvé son mot de passe, donc
// pas de risque d'énumération à couvrir. L'email n'est JAMAIS lu depuis le
// corps de la requête — uniquement depuis la session vérifiée
// (`caller.email`), même posture que `procuration-notify`
// (`de_user_id = caller.id`, jamais un champ client).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COOLDOWN_MS = 3 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

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
  if (!caller?.email) return json({ error: "Non authentifié" }, 401);

  const email = caller.email.toLowerCase();
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: recent } = await admin
      .from("password_reset_requests")
      .select("requested_at")
      .eq("email", email)
      .maybeSingle();
    if (recent && Date.now() - new Date(recent.requested_at).getTime() < COOLDOWN_MS) {
      return json({ ok: true });
    }
    await admin
      .from("password_reset_requests")
      .upsert({ email, requested_at: new Date().toISOString() });

    const { data: profile } = await admin
      .from("profiles")
      .select("nom")
      .eq("id", caller.id)
      .maybeSingle();

    const { data: secrets } = await admin
      .from("app_secrets")
      .select("key, value")
      .in("key", [
        "emailjs_service_id",
        "emailjs_template_id_generique",
        "emailjs_public_key",
        "emailjs_private_key",
      ]);
    const val = (k: string) => secrets?.find((s) => s.key === k)?.value;
    const serviceId = val("emailjs_service_id");
    const templateId = val("emailjs_template_id_generique");
    const publicKey = val("emailjs_public_key");
    const privateKey = val("emailjs_private_key");

    if (!serviceId || !templateId || !publicKey || !privateKey) {
      console.error("send-login-otp: configuration EmailJS (générique) incomplète");
      return json({ ok: true });
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (linkError || !link) {
      console.error("send-login-otp: échec generateLink", linkError?.message);
      return json({ ok: true });
    }
    const code = link.properties.email_otp;

    const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: email,
          to_name: profile?.nom ?? "",
          titre: "Code de connexion",
          message: `Bonjour ${profile?.nom ?? ""},\n\nVoici votre code de vérification pour terminer votre connexion à BoardCA :\n\n${code}\n\nCe code est valable une seule fois. Si vous n'êtes pas à l'origine de cette connexion, changez votre mot de passe immédiatement.`,
        },
      }),
    });
    if (!resp.ok) {
      console.error("send-login-otp: échec envoi EmailJS", await resp.text().catch(() => ""));
    }
    return json({ ok: true });
  } catch (err) {
    console.error("send-login-otp: erreur interne", err);
    return json({ ok: true });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
