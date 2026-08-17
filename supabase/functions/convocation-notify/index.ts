// Edge Function: convocation-notify
// Envoie un email de convocation à un membre du CA. Appelée par le trigger
// Postgres `notify_convocation` (AFTER INSERT ON convocations, via pg_net) —
// jamais par un client. Même mécanique que push-send : l'appelant est
// Postgres, qui ne porte pas de JWT utilisateur, donc authentification par
// secret partagé (en-tête x-push-secret), réutilise app_secrets.push_hook_secret
// plutôt que créer un 2e secret dédié.
//
// Ne fire QUE sur un vrai INSERT dans `convocations` (jamais sur un renvoi,
// qui fait un UPDATE via upsert) — même garantie que le push existant,
// gratuite car c'est le même trigger AFTER INSERT qui déclenche les deux.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: secrets } = await admin
    .from("app_secrets")
    .select("key, value")
    .in("key", [
      "push_hook_secret",
      "emailjs_service_id",
      "emailjs_template_id_generique",
      "emailjs_public_key",
      "emailjs_private_key",
      "site_url",
    ]);
  const val = (k: string) => secrets?.find((s) => s.key === k)?.value;

  // Seul Postgres (ou le super admin en test) connaît ce secret.
  if (!val("push_hook_secret") || req.headers.get("x-push-secret") !== val("push_hook_secret")) {
    return json({ error: "Non autorisé" }, 401);
  }

  const body = await req.json().catch(() => null);
  const userId = body?.userId as string | undefined;
  const reunionId = body?.reunionId as string | undefined;
  if (!userId || !reunionId) return json({ error: "userId et reunionId requis" }, 400);

  const [{ data: profile }, { data: reunion }] = await Promise.all([
    admin.from("profiles").select("email, nom").eq("id", userId).maybeSingle(),
    admin
      .from("reunions")
      .select("titre, date_reunion, heure, lieu, lien_visio")
      .eq("id", reunionId)
      .maybeSingle(),
  ]);
  if (!profile?.email || !reunion) {
    return json({ envoye: false, motif: "profil ou réunion introuvable" });
  }

  const serviceId = val("emailjs_service_id");
  const templateId = val("emailjs_template_id_generique");
  const publicKey = val("emailjs_public_key");
  const privateKey = val("emailjs_private_key");
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    return json({ envoye: false, motif: "configuration EmailJS incomplète" });
  }

  const dateLabel = reunion.date_reunion
    ? new Date(`${reunion.date_reunion}T12:00:00`).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "date à confirmer";
  const heureLabel = reunion.heure ? ` à ${String(reunion.heure).slice(0, 5)}` : "";
  const lieuLabel = reunion.lieu
    ? `\nLieu : ${reunion.lieu}`
    : reunion.lien_visio
      ? `\nVisio : ${reunion.lien_visio}`
      : "";
  const siteUrl = val("site_url") ?? "";

  try {
    const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: profile.email,
          to_name: profile.nom ?? "",
          titre: "Convocation à une séance du Conseil",
          // Le template affiche déjà "Bonjour {{to_name}}," avant {{message}} —
          // ne pas le répéter (piège documenté, voir admin-users/request-password-reset).
          message: `Vous êtes convoqué à la réunion « ${reunion.titre ?? "Séance du Conseil"} », le ${dateLabel}${heureLabel}.${lieuLabel}\n\nConnectez-vous à BoardCA pour confirmer votre présence :\n\n${siteUrl}/auth`,
        },
      }),
    });
    if (!resp.ok) {
      console.error("convocation-notify: échec envoi EmailJS", await resp.text().catch(() => ""));
    }
    return json({ envoye: resp.ok });
  } catch (e) {
    console.error("convocation-notify: erreur interne", e);
    return json({ envoye: false, motif: e instanceof Error ? e.message : "erreur réseau" });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
