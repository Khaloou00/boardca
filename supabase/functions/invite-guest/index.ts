// Edge Function: invite-guest
// Un membre du CA (administrateur) désigne DIRECTEMENT un mandataire externe
// pour une réunion précise — remplace le flow demandes_invite/invite-request-
// validate (validation par la Secrétaire) : incohérent, un membre du CA n'a
// pas à demander la permission de la Secrétaire pour choisir son propre
// mandataire. Crée le compte + la procuration atomiquement, PUIS envoie un
// vrai email d'invitation via EmailJS (REST, pas le SDK navigateur — accessToken
// = Private Key requis pour un appel serveur-à-serveur, EmailJS bloque sinon).
//
// Authentification de l'invité (2026-08-05) : le compte est créé SANS mot de
// passe — c'est l'invité lui-même qui en choisit un, jamais le système. Le
// lien envoyé par email embarque un jeton à usage unique (magiclink Supabase,
// généré ICI à la création — pas régénéré à la volée par une edge function
// séparée comme l'ancien `invite-login`). Ce jeton n'est consommé que lorsque
// l'invité clique explicitement sur « Accéder à mon espace invité » côté
// client (jamais au simple chargement de la page) : un scanner de sécurité de
// messagerie qui pré-charge le lien ne déclenche plus aucune vérification
// d'OTP, donc ne peut plus invalider le jeton avant l'ouverture réelle. Une
// fois le jeton vérifié, l'invité DOIT créer son mot de passe personnel
// (`must_change_password=true`, même mécanisme que les comptes créés par le
// Super Admin) avant d'accéder à l'application.
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
  const { reunionId, email, nom, prenom, motif } = body ?? {};
  if (!reunionId || !email || !nom || !prenom) {
    return json({ error: "Champs requis manquants (réunion, nom, prénom, email)" }, 400);
  }
  const emailNorm = String(email).trim().toLowerCase();
  const nomComplet = `${String(nom).trim()} ${String(prenom).trim()}`.trim();

  try {
    // 1. L'appelant doit être administrateur, convoqué à CETTE réunion, et pas
    //    déjà confirmé (la procuration est l'ALTERNATIVE à venir soi-même).
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, nom")
      .eq("id", caller.id)
      .single();
    if (callerProfile?.role !== "administrateur") {
      return json({ error: "Réservé aux membres du CA" }, 403);
    }

    const { data: convocation } = await admin
      .from("convocations")
      .select("statut")
      .eq("reunion_id", reunionId)
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!convocation) {
      return json({ error: "Vous n'êtes pas convoqué à cette réunion" }, 403);
    }
    if (convocation.statut === "confirmed") {
      return json(
        { error: "Vous avez déjà confirmé votre présence : annulez-la avant de déléguer" },
        409,
      );
    }

    const { data: reunion } = await admin
      .from("reunions")
      .select("titre, date_reunion, statut")
      .eq("id", reunionId)
      .single();
    if (!reunion || reunion.statut === "terminee") {
      return json({ error: "Cette réunion est déjà terminée" }, 409);
    }

    // 2. Réutilise un profil existant si l'email a déjà un compte (évite les
    //    doublons). `must_change_password` est remis à `true` à CHAQUE
    //    désignation, y compris pour un invité déjà connu ailleurs — plus
    //    simple et plus sûr que de deviner s'il a déjà défini le sien.
    const { data: existant } = await admin
      .from("profiles")
      .select("id")
      .eq("email", emailNorm)
      .maybeSingle();

    let guestId = existant?.id as string | undefined;
    if (!guestId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: emailNorm,
        email_confirm: true,
        user_metadata: { nom: nomComplet },
      });
      if (createError || !created.user) {
        return json({ error: createError?.message ?? "Échec de la création du compte" }, 400);
      }
      const { error: profileError } = await admin
        .from("profiles")
        .update({ role: "invite", nom: nomComplet, must_change_password: true })
        .eq("id", created.user.id);
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: profileError.message }, 400);
      }
      guestId = created.user.id;
    } else {
      await admin.from("profiles").update({ must_change_password: true }).eq("id", guestId);
    }

    // 3. Procuration + excuse du mandant (un membre qui redésigne remplace le
    //    précédent mandataire, UNIQUE(reunion_id, de_user_id)).
    const { error: procError } = await admin.from("procurations").upsert(
      { reunion_id: reunionId, de_user_id: caller.id, vers_user_id: guestId, statut: "active" },
      { onConflict: "reunion_id,de_user_id" },
    );
    if (procError) return json({ error: procError.message }, 400);

    await admin
      .from("convocations")
      .update({ statut: "excused" })
      .eq("reunion_id", reunionId)
      .eq("user_id", caller.id);

    // 4. Jeton d'accès à usage unique (consommé côté client seulement au clic
    //    sur « Accéder à mon espace invité », jamais au chargement de la page).
    const { data: secrets } = await admin
      .from("app_secrets")
      .select("key, value")
      .in("key", [
        "emailjs_service_id",
        "emailjs_template_id",
        "emailjs_public_key",
        "emailjs_private_key",
        "site_url",
      ]);
    const val = (k: string) => secrets?.find((s) => s.key === k)?.value;
    const siteUrl = val("site_url") ?? "";

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: emailNorm,
    });
    if (linkError || !link) {
      return json({ error: linkError?.message ?? "Échec de la génération du lien d'accès" }, 400);
    }
    const lien = `${siteUrl}/auth/invite?email=${encodeURIComponent(emailNorm)}&token=${encodeURIComponent(link.properties.hashed_token)}`;

    // 5. Email d'invitation réel via EmailJS — non bloquant : le compte, la
    //    procuration et le lien existent déjà si l'envoi échoue (le lien est
    //    alors retourné au client pour être communiqué manuellement).
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const serviceId = val("emailjs_service_id");
      const templateId = val("emailjs_template_id");
      const publicKey = val("emailjs_public_key");
      const privateKey = val("emailjs_private_key");

      if (serviceId && templateId && publicKey && privateKey) {
        const dateLabel = reunion.date_reunion
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
              to_email: emailNorm,
              to_name: nomComplet,
              mandant_nom: callerProfile?.nom ?? "Un membre du Conseil d'Administration",
              reunion_titre: reunion.titre ?? "une séance du Conseil",
              reunion_date: dateLabel ? `Séance du ${dateLabel}` : "Date à confirmer",
              motif: motif ? String(motif) : "Non précisé",
              lien,
            },
          }),
        });
        emailSent = resp.ok;
        if (!resp.ok) emailError = await resp.text().catch(() => "Échec de l'envoi");
      } else {
        emailError = "Configuration EmailJS incomplète";
      }
    } catch (e) {
      emailError = e instanceof Error ? e.message : "Erreur d'envoi de l'email";
    }

    return json({ guestId, emailSent, emailError, lien });
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
