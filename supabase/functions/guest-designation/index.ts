// ⚠️ FONCTION RETIRÉE DU SERVICE — ARCHIVE (2026-08-10)
//
// Ce fichier est la copie du code qui tournait en production sous le slug
// `guest-designation` (version 2), récupéré depuis Supabase avant sa mise hors
// service : il n'avait jamais été versionné dans le dépôt, personne ne pouvait
// donc le relire alors qu'il s'exécutait avec la clé service_role.
//
// C'est la 1re génération du flux « désignation d'un invité mandataire »,
// remplacée depuis par `invite-request-validate` (2e gén., dormante) puis par
// `invite-guest` (3e gén., active — c'est elle qui est utilisée aujourd'hui).
// Différence notable : celle-ci générait un mot de passe côté serveur, alors
// que le flux actuel laisse l'invité créer le sien via un lien à usage unique.
//
// Conservé à titre documentaire uniquement. NE PAS REDÉPLOYER.
//
// ─────────────────────────────────────────────────────────────────────────────

// Edge Function: guest-designation
// Un membre du CA (administrateur) désigne un mandataire externe pour UNE
// réunion précise : crée un vrai compte (auth.users + profil role='invite')
// et la ligne `procurations` associée, atomiquement (rollback manuel si une
// étape échoue — pas de transaction cross-service entre Auth et Postgres).
// Contrairement à `admin-users` (réservée au super_admin, mot de passe
// statique partagé), un mot de passe aléatoire est généré à chaque appel :
// un mandataire externe mérite un secret propre, pas celui de tous les
// comptes internes.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function genererMotDePasse(): string {
  // Lisible (pas de caractères ambigus 0/O/1/l/I), suffisant pour un secret
  // transmis une seule fois et changé à la première connexion.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

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
  const { reunionId, email, nom, telephone } = body ?? {};
  if (!reunionId || !email || !nom) {
    return json({ error: "Champs requis manquants (réunion, email, nom)" }, 400);
  }

  try {
    // 1. L'appelant doit être administrateur ET convoqué à CETTE réunion. Une
    //    procuration est l'ALTERNATIVE à venir soi-même (comme l'excuse du
    //    PCA dans delegate_president_seance) — elle n'exige donc PAS d'avoir
    //    déjà confirmé sa présence ; elle est même bloquée par l'UI une fois
    //    confirmé (on ne délègue pas quand on siège soi-même).
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
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

    // 2. La réunion ne doit pas déjà être terminée.
    const { data: reunion } = await admin
      .from("reunions")
      .select("statut")
      .eq("id", reunionId)
      .single();
    if (!reunion || reunion.statut === "terminee") {
      return json({ error: "Cette réunion est déjà terminée" }, 409);
    }

    // 3. Créer le compte + profil 'invite'.
    const password = genererMotDePasse();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nom },
    });
    if (createError || !created.user) {
      return json({ error: createError?.message ?? "Échec de la création du compte" }, 400);
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: "invite",
        nom,
        telephone: telephone ?? null,
        must_change_password: true,
      })
      .eq("id", created.user.id);
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: profileError.message }, 400);
    }

    // 4. Créer/remplacer la procuration. Un membre qui redésigne un
    //    mandataire remplace le précédent (contrainte UNIQUE(reunion_id,
    //    de_user_id)) — l'ancien compte invité, lui, n'est pas supprimé.
    const { error: procError } = await admin.from("procurations").upsert(
      {
        reunion_id: reunionId,
        de_user_id: caller.id,
        vers_user_id: created.user.id,
        statut: "active",
      },
      { onConflict: "reunion_id,de_user_id" },
    );
    if (procError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: procError.message }, 400);
    }

    // 5. Le mandant est désormais excusé — cohérent avec la sémantique de
    //    delegate_president_seance (le PCA qui délègue passe aussi 'excused').
    //    Non bloquant : la procuration existe déjà si cette écriture échoue.
    await admin
      .from("convocations")
      .update({ statut: "excused" })
      .eq("reunion_id", reunionId)
      .eq("user_id", caller.id);

    return json({ guestId: created.user.id, password });
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
