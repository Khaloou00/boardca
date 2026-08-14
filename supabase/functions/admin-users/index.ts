// Edge Function: admin-users
// Crée ou supprime un vrai compte utilisateur (auth.users + profil). Réservé au super_admin.
// La clé service_role ne quitte jamais le navigateur : elle ne vit que dans cette fonction,
// injectée automatiquement par la plateforme (SUPABASE_SERVICE_ROLE_KEY).
//
// Création SANS mot de passe (2026-08-14) : jusqu'ici le compte était créé avec un mot de
// passe codé en dur et IDENTIQUE pour tout le monde (`DEFAULT_PASSWORD`), quel que soit ce
// que le Super Admin saisissait dans le formulaire — champ cosmétique, jamais lu ici. Même
// défaut structurel que l'ancien `0101010101` partagé. Remplacé par le mécanisme déjà en
// place pour les invités externes (`invite-guest`) : compte créé sans mot de passe, lien
// d'activation à usage unique envoyé par email, c'est le nouvel utilisateur qui choisit son
// propre mot de passe sur /auth/invite.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
      const emailNorm = String(email).trim().toLowerCase();

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: emailNorm,
        email_confirm: true,
        user_metadata: { nom },
      });
      if (createError || !created.user) {
        return json({ error: createError?.message ?? "Échec de la création du compte" }, 400);
      }

      // Le trigger on_auth_user_created a déjà inséré un profil par défaut ; on le complète.
      // `must_change_password` posé explicitement, sans compter sur le défaut du trigger :
      // sans mot de passe posé par personne, c'est ce drapeau qui déclenche la création du
      // mot de passe personnel dès l'activation.
      const { error: updateError } = await admin
        .from("profiles")
        .update({ role, telephone, qualite, must_change_password: true })
        .eq("id", created.user.id);
      if (updateError) return json({ error: updateError.message }, 400);

      // Lien d'activation à usage unique — même mécanique que invite-guest : le jeton n'est
      // vérifié que sur un clic explicite côté client, jamais au chargement de la page.
      const { data: secrets } = await admin
        .from("app_secrets")
        .select("key, value")
        .in("key", [
          "emailjs_service_id",
          "emailjs_template_id_generique",
          "emailjs_public_key",
          "emailjs_private_key",
          "site_url",
        ]);
      const val = (k: string) => secrets?.find((s) => s.key === k)?.value;
      const siteUrl = val("site_url") ?? "";

      let emailSent = false;
      let emailError: string | undefined;
      let lien: string | undefined;
      try {
        const { data: link, error: linkError } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: emailNorm,
        });
        if (linkError || !link) {
          emailError = linkError?.message ?? "Échec de la génération du lien d'activation";
        } else {
          lien = `${siteUrl}/auth/invite?email=${encodeURIComponent(emailNorm)}&token=${encodeURIComponent(link.properties.hashed_token)}&type=activation`;

          const serviceId = val("emailjs_service_id");
          const templateId = val("emailjs_template_id_generique");
          const publicKey = val("emailjs_public_key");
          const privateKey = val("emailjs_private_key");

          if (serviceId && templateId && publicKey && privateKey) {
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
                  to_name: nom,
                  titre: "Bienvenue chez BoardCA",
                  message: `Bonjour ${nom},\n\nVotre compte BoardCA a été créé. Activez-le et créez votre mot de passe personnel via ce lien :\n\n${lien}\n\nCe lien est à usage unique.`,
                },
              }),
            });
            emailSent = resp.ok;
            if (!resp.ok) emailError = await resp.text().catch(() => "Échec de l'envoi");
          } else {
            emailError = "Configuration EmailJS incomplète";
          }
        }
      } catch (e) {
        emailError = e instanceof Error ? e.message : "Erreur d'envoi de l'email";
      }

      return json({ id: created.user.id, emailSent, emailError, lien });
    }

    if (body.action === "delete") {
      const { id } = body;
      if (!id) return json({ error: "Identifiant manquant" }, 400);

      // GoTrue ne renvoie qu'une erreur générique et vide (`{"error":"{}"}`)
      // quand la suppression est bloquée par une contrainte de clé étrangère
      // (piège connu, voir mémoire du projet) — impossible d'en déduire la
      // cause après coup. On vérifie donc AVANT d'essayer si ce compte a un
      // historique dans une des tables qui référencent `profiles` SANS
      // cascade (délibéré : préserver la traçabilité d'un CA).
      const references: [string, string][] = [
        ["reunions", "created_by"],
        ["actions", "responsable_id"],
        ["actions", "assigne_par"],
        ["procurations", "de_user_id"],
        ["procurations", "vers_user_id"],
        ["documents", "uploaded_by"],
        ["discussions", "created_by"],
        ["discussion_messages", "auteur_id"],
        ["audit_log", "user_id"],
        ["pv_observations", "user_id"],
        ["board_books", "genere_par"],
        ["reports_seance", "reporte_par"],
        ["jetons_presence", "paye_par"],
        ["demandes_invite", "de_user_id"],
        ["demandes_invite", "vers_user_id"],
        ["demandes_invite", "decided_by"],
        ["action_commentaires", "auteur_id"],
        ["action_rapports", "auteur_id"],
        ["baremes_jetons", "updated_by"],
        ["annotations", "partage_avec_user_id"],
      ];
      const checks = await Promise.all(
        references.map(async ([table, column]) => {
          const { data } = await admin.from(table).select(column).eq(column, id).limit(1);
          return data && data.length > 0;
        }),
      );
      if (checks.some(Boolean)) {
        return json(
          {
            error:
              "Impossible de supprimer : ce compte a un historique (réunion créée, procuration, action, document, message, PV…). Suspendez-le plutôt — le compte reste tracé mais ne peut plus se connecter.",
          },
          409,
        );
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(id);
      if (deleteError) {
        return json({ error: deleteError.message || "Échec de la suppression" }, 400);
      }
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
