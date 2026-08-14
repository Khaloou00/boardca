// Edge Function: request-password-reset
// Point d'entrée PUBLIC (aucune session requise) pour « mot de passe oublié ».
// Ne révèle JAMAIS si un email correspond à un compte : la réponse est
// identique (succès générique) que le compte existe ou non, que l'envoi ait
// réussi ou non — sinon l'écran deviendrait un oracle pour lister les emails
// valides du Conseil. Un throttle (`password_reset_requests`, 3 min par
// email) empêche l'email-bombing d'un compte réel par appels répétés.
//
// Envoie un CODE (OTP), pas un lien : l'invité le saisit lui-même sur /auth,
// vérifié côté client par `supabase.auth.verifyOtp({ email, token, type:
// "recovery" })`. `admin.generateLink` sert uniquement à FAIRE GÉNÉRER ce
// code par Supabase (`properties.email_otp`) — le lien lui-même
// (`action_link`) n'est jamais utilisé ni envoyé. Ce projet génère des codes
// à 8 chiffres (pas 6) : ne jamais borner la saisie côté client à une
// longueur fixe, un `maxLength` trop court a rendu le code impossible à
// saisir en entier le 2026-08-14.
//
// Utilise le template EmailJS GÉNÉRIQUE (`emailjs_template_id_generique`,
// champs to_email/to_name/titre/message), pas un template dédié : le plan
// gratuit EmailJS est plafonné à 2 templates, et le premier est déjà pris par
// invite-guest/procuration-notify. Ce template générique est fait pour être
// réutilisé par tout futur besoin d'email transactionnel, sans jamais avoir à
// en recréer un troisième.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COOLDOWN_MS = 3 * 60 * 1000;

const REPONSE_GENERIQUE = {
  ok: true,
  message: "Si un compte existe avec cette adresse, un code de vérification vient d'être envoyé.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json(REPONSE_GENERIQUE);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nom")
      .eq("email", email)
      .maybeSingle();
    if (!profile) return json(REPONSE_GENERIQUE);

    const { data: recent } = await admin
      .from("password_reset_requests")
      .select("requested_at")
      .eq("email", email)
      .maybeSingle();
    if (recent && Date.now() - new Date(recent.requested_at).getTime() < COOLDOWN_MS) {
      return json(REPONSE_GENERIQUE);
    }
    await admin
      .from("password_reset_requests")
      .upsert({ email, requested_at: new Date().toISOString() });

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
      console.error("request-password-reset: configuration EmailJS (générique) incomplète");
      return json(REPONSE_GENERIQUE);
    }

    // generateLink sert uniquement à faire produire le code par Supabase ;
    // seul `properties.email_otp` est utilisé, jamais `action_link`.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (linkError || !link) {
      console.error("request-password-reset: échec generateLink", linkError?.message);
      return json(REPONSE_GENERIQUE);
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
          to_name: profile.nom ?? "",
          titre: "Réinitialisation de mot de passe",
          message: `Bonjour ${profile.nom ?? ""},\n\nVoici votre code de vérification pour réinitialiser votre mot de passe BoardCA :\n\n${code}\n\nCe code est valable une seule fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        },
      }),
    });
    if (!resp.ok) {
      console.error("request-password-reset: échec envoi EmailJS", await resp.text().catch(() => ""));
    }
    return json(REPONSE_GENERIQUE);
  } catch (err) {
    console.error("request-password-reset: erreur interne", err);
    return json(REPONSE_GENERIQUE);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
