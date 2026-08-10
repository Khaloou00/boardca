// Edge Function: push-send
//
// Transporte une notification métier vers les appareils d'un utilisateur.
//
// Appelée par le trigger `trg_push_notification` (pg_net) à chaque insertion
// dans `notifications`. Ce point d'entrée unique couvre TOUTES les notifications
// existantes — convocation, Board Book, scrutin ouvert/clos, PV à signer,
// action, consultation, délégation, jeton — sans qu'aucun des 10 triggers
// métier n'ait eu à être modifié.
//
// CONTENU VOLONTAIREMENT NEUTRE : une notification s'affiche sur un écran
// verrouillé, potentiellement devant des tiers. Le titre reste générique, le
// détail ne se lit qu'après authentification dans l'application.
//
// Les abonnements périmés (404/410 du service de push) sont supprimés au fil de
// l'eau : sans ça la table se remplit d'appareils morts et chaque envoi ralentit.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Charge = {
  userId?: string;
  titre?: string;
  message?: string;
  type?: string;
  ressourceId?: string;
  url?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Clés VAPID + secret d'appel : lus en base, jamais embarqués dans le code.
  const { data: secrets } = await admin
    .from("app_secrets")
    .select("key, value")
    .in("key", ["vapid_public_key", "vapid_private_key", "vapid_subject", "push_hook_secret"]);
  const conf = Object.fromEntries((secrets ?? []).map((s) => [s.key, s.value]));

  // `verify_jwt` est désactivé (l'appelant est Postgres via pg_net, il ne porte
  // pas de JWT) : ce secret partagé est donc la SEULE barrière. Sans lui,
  // n'importe qui pourrait envoyer une notification à n'importe quel utilisateur.
  //
  // Il est lu dans `app_secrets`, exactement là où le trigger le prend : les
  // deux côtés ne peuvent pas diverger. Ne pas le remplacer par une variable
  // d'environnement sans la créer — la garde renverrait 401 à chaque appel.
  if (!conf.push_hook_secret || req.headers.get("x-push-secret") !== conf.push_hook_secret) {
    return json({ error: "Non autorisé" }, 401);
  }

  const body = (await req.json().catch(() => null)) as Charge | null;
  if (!body?.userId) return json({ error: "userId requis" }, 400);

  if (!conf.vapid_public_key || !conf.vapid_private_key) {
    return json({ error: "Clés VAPID absentes de app_secrets" }, 500);
  }
  webpush.setVapidDetails(
    conf.vapid_subject ?? "mailto:admin@bnetd.ci",
    conf.vapid_public_key,
    conf.vapid_private_key,
  );

  const { data: abonnements } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", body.userId);

  if (!abonnements?.length) return json({ envoyes: 0, motif: "aucun appareil abonné" });

  // Compteur de non-lus : sert à la pastille sur l'icône de l'application.
  const { count: nonLus } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", body.userId)
    .eq("lu", false);

  const charge = JSON.stringify({
    titre: body.titre ?? "BoardCA",
    message: body.message ?? "",
    type: body.type ?? null,
    ressourceId: body.ressourceId ?? null,
    url: body.url ?? "/mobile",
    nonLus: nonLus ?? 0,
  });

  let envoyes = 0;
  const perimes: string[] = [];

  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          charge,
          { TTL: 60 * 60 * 24 }, // 24 h : au-delà, la notification n'a plus d'intérêt
        );
        envoyes++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404/410 = l'utilisateur a désinstallé l'app ou révoqué l'autorisation.
        if (code === 404 || code === 410) perimes.push(a.id);
      }
    }),
  );

  if (perimes.length) {
    await admin.from("push_subscriptions").delete().in("id", perimes);
  }
  if (envoyes) {
    await admin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", body.userId);
  }

  return json({ envoyes, perimesSupprimes: perimes.length });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
