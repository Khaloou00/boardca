// Abonnement de l'appareil aux notifications push.
//
// L'autorisation DOIT être demandée sur un geste explicite de l'utilisateur :
// Chrome pénalise durablement les sites qui la réclament au chargement, et iOS
// la refuse purement et simplement. D'où une fonction `activerPush()` appelée
// depuis un bouton, jamais depuis un effet de montage.
import { supabase } from "@/lib/supabase";

export type EtatPush =
  | "non-supporte" // navigateur sans Push API (ou iOS pas installé sur l'écran d'accueil)
  | "refuse" // l'utilisateur a bloqué : seul lui peut revenir en arrière, via les réglages
  | "actif"
  | "inactif";

export function pushSupporte(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * iOS n'expose la Push API QUE si l'application est installée sur l'écran
 * d'accueil (16.4+) — jamais dans un onglet Safari. Le distinguer permet
 * d'afficher « installez d'abord l'app » plutôt qu'un « non supporté »
 * décourageant et faux.
 */
export function iosSansInstallation(): boolean {
  if (typeof window === "undefined") return false;
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const installee =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !installee;
}

export async function etatPush(): Promise<EtatPush> {
  if (!pushSupporte()) return "non-supporte";
  if (Notification.permission === "denied") return "refuse";
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  return abo ? "actif" : "inactif";
}

/**
 * La clé publique VAPID voyage en base64url ; l'API la veut en octets.
 * On alloue explicitement un `ArrayBuffer` : `Uint8Array.from` produit un
 * `Uint8Array<ArrayBufferLike>`, que `applicationServerKey` refuse (il exige un
 * tampon non partagé).
 */
function base64UrlVersOctets(base64: string): Uint8Array<ArrayBuffer> {
  const complet = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const brut = atob(complet);
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

export async function activerPush(): Promise<EtatPush> {
  if (!pushSupporte()) return "non-supporte";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "refuse" : "inactif";

  const reg = await navigator.serviceWorker.ready;

  // Clé lue au serveur : elle peut être remplacée sans redéployer le front.
  const { data: cle, error } = await supabase.rpc("get_vapid_public_key");
  if (error || !cle) throw new Error("Clé de notification indisponible");

  const abo =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      // Sans ça, le navigateur refuse : une notification push doit toujours
      // être visible par l'utilisateur, pas silencieuse.
      userVisibleOnly: true,
      applicationServerKey: base64UrlVersOctets(cle),
    }));

  const brut = abo.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) throw new Error("Session expirée");

  // `endpoint` est unique : se réabonner depuis le même appareil met à jour la
  // ligne au lieu d'en empiler une nouvelle.
  const { error: err } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: session.user.id,
      endpoint: brut.endpoint!,
      p256dh: brut.keys!.p256dh!,
      auth: brut.keys!.auth!,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: "endpoint" },
  );
  if (err) throw err;

  return "actif";
}

export async function desactiverPush(): Promise<EtatPush> {
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  if (abo) {
    // On retire d'abord la ligne : si le désabonnement navigateur échoue, mieux
    // vaut un appareil qui ne reçoit plus rien qu'un envoi vers un mort.
    await supabase.from("push_subscriptions").delete().eq("endpoint", abo.endpoint);
    await abo.unsubscribe();
  }
  return "inactif";
}

/**
 * À la déconnexion : cet appareil ne doit plus recevoir les notifications du
 * compte qui s'en va — sinon le suivant qui l'utilise verrait passer les
 * convocations et les PV de son prédécesseur.
 */
export async function nettoyerPushALaDeconnexion(): Promise<void> {
  try {
    await desactiverPush();
  } catch {
    /* jamais bloquant pour une déconnexion */
  }
}
