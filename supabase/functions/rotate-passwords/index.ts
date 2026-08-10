// Edge Function: rotate-passwords
//
// Remplace le mot de passe de TOUS les comptes par un secret aléatoire distinct,
// et repositionne `must_change_password` pour forcer un choix personnel à la
// première connexion (mécanisme existant, migration 032).
//
// POURQUOI : jusqu'au 2026-08-10, les 10 comptes réels partageaient le même mot
// de passe de démonstration, écrit en clair dans le code source (`auth.tsx` et
// `role-switcher.tsx`). Ce mot de passe a circulé ; il doit être considéré comme
// compromis. Le retirer du code ne suffit pas : il faut le remplacer en base.
//
// SÉCURITÉ :
//  - réservée au super_admin (vérification du profil de l'appelant) ;
//  - les mots de passe générés ne sont renvoyés QU'UNE FOIS, dans la réponse à
//    cet appel, et ne sont stockés nulle part. Perdus = il faut relancer ;
//  - `dryRun: true` (défaut) liste les comptes concernés SANS rien modifier.
//
// APPEL (depuis un terminal, avec le JWT d'un super_admin) :
//   curl -X POST "$SUPABASE_URL/functions/v1/rotate-passwords" \
//     -H "Authorization: Bearer <jwt_super_admin>" \
//     -H "Content-Type: application/json" \
//     -d '{"dryRun": false}'
//
// À LANCER AU BON MOMENT : juste avant la mise en ligne, pas pendant le
// développement — tant que le mode démo (`VITE_DEMO_MODE=1`) est utilisé, le
// sélecteur de profil a besoin du mot de passe commun.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Alphabet sans caractères ambigus (0/O, 1/l/I) : ces secrets sont transmis à
// la main, souvent recopiés depuis un écran.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function genererMotDePasse(longueur = 16): string {
  const octets = crypto.getRandomValues(new Uint32Array(longueur));
  return Array.from(octets, (o) => ALPHABET[o % ALPHABET.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Non authentifié" }, 401);

  // Identité réelle de l'appelant (jamais un champ du corps de requête).
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
    .maybeSingle();
  if (callerProfile?.role !== "super_admin") {
    return json({ error: "Réservé au Super Administrateur" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  // Par défaut on ne touche à RIEN : il faut demander explicitement l'exécution.
  const dryRun = body?.dryRun !== false;
  // Permet d'épargner des comptes (ex. celui qui lance l'opération, pour ne pas
  // se déconnecter soi-même en cours de route).
  const exclure: string[] = Array.isArray(body?.exclure) ? body.exclure : [];

  const { data: profils, error } = await admin
    .from("profiles")
    .select("id, email, nom, role")
    .order("email");
  if (error) return json({ error: error.message }, 500);

  const cibles = (profils ?? []).filter((p) => p.email && !exclure.includes(p.email));

  if (dryRun) {
    return json({
      dryRun: true,
      message:
        "Aucune modification effectuée. Relancer avec {\"dryRun\": false} pour appliquer.",
      comptesConcernes: cibles.map((p) => ({ email: p.email, nom: p.nom, role: p.role })),
      total: cibles.length,
    });
  }

  const resultats: {
    email: string;
    nom: string | null;
    role: string;
    motDePasseTemporaire?: string;
    erreur?: string;
  }[] = [];

  for (const p of cibles) {
    const motDePasse = genererMotDePasse();
    const { error: errAuth } = await admin.auth.admin.updateUserById(p.id, {
      password: motDePasse,
    });
    if (errAuth) {
      resultats.push({ email: p.email!, nom: p.nom, role: p.role, erreur: errAuth.message });
      continue;
    }
    // Force le choix d'un mot de passe personnel à la première connexion.
    // Non bloquant : le mot de passe est déjà changé si cette écriture échoue.
    await admin.from("profiles").update({ must_change_password: true }).eq("id", p.id);
    resultats.push({
      email: p.email!,
      nom: p.nom,
      role: p.role,
      motDePasseTemporaire: motDePasse,
    });
  }

  return json({
    dryRun: false,
    avertissement:
      "Ces mots de passe ne sont affichés qu'une seule fois et ne sont stockés nulle part. " +
      "Transmettez-les par un canal sûr, puis effacez cette sortie.",
    resultats,
    total: resultats.length,
    echecs: resultats.filter((r) => r.erreur).length,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
