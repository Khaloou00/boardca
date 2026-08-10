// Lecture de QR code par la caméra.
//
// Deux moteurs :
//  - `BarcodeDetector`, natif sur Chrome/Edge (Android et bureau) : rapide,
//    accéléré matériellement, aucun octet à télécharger ;
//  - `jsQR` en repli, importé DYNAMIQUEMENT pour que Safari et Firefox soient
//    servis sans alourdir le bundle de ceux qui n'en ont pas besoin.
//
// La caméra exige un contexte sécurisé (HTTPS ou localhost) : c'est acquis
// depuis la mise en ligne.

export type ResultatScan = { texte: string };

/** Format du QR de présence, produit par le secrétariat. */
export const PREFIXE_PRESENCE = "BOARDCA:PRESENCE:";

export function extraireReunionId(texte: string): string | null {
  if (!texte.startsWith(PREFIXE_PRESENCE)) return null;
  const id = texte.slice(PREFIXE_PRESENCE.length).trim();
  // Un identifiant de réunion est un UUID : on refuse tout le reste plutôt que
  // d'envoyer n'importe quoi au serveur.
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

type Detecteur = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

async function creerDetecteurNatif(): Promise<Detecteur | null> {
  const BD = (globalThis as unknown as { BarcodeDetector?: any }).BarcodeDetector;
  if (!BD) return null;
  try {
    const formats: string[] = await BD.getSupportedFormats();
    if (!formats.includes("qr_code")) return null;
    return new BD({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

export type OptionsScan = {
  video: HTMLVideoElement;
  onResultat: (r: ResultatScan) => void;
  onErreur?: (e: Error) => void;
};

/**
 * Démarre la caméra et scrute chaque image jusqu'à trouver un QR.
 * Renvoie une fonction d'arrêt — À APPELER IMPÉRATIVEMENT : sans elle, la
 * caméra reste allumée (voyant du téléphone, batterie) après la fermeture
 * de l'écran.
 */
export async function demarrerScan({
  video,
  onResultat,
  onErreur,
}: OptionsScan): Promise<() => void> {
  let flux: MediaStream | null = null;
  let anime = 0;
  let actif = true;

  const arreter = () => {
    actif = false;
    if (anime) cancelAnimationFrame(anime);
    flux?.getTracks().forEach((t) => t.stop());
    flux = null;
  };

  try {
    flux = await navigator.mediaDevices.getUserMedia({
      // `environment` = caméra arrière : c'est elle qui vise l'écran du QR.
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = flux;
    // `playsInline` : sans lui, iOS ouvre le lecteur vidéo en plein écran.
    video.setAttribute("playsinline", "true");
    await video.play();

    const natif = await creerDetecteurNatif();
    let jsQR: typeof import("jsqr").default | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;

    if (!natif) {
      jsQR = (await import("jsqr")).default;
      canvas = document.createElement("canvas");
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    }

    const boucle = async () => {
      if (!actif) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          if (natif) {
            const codes = await natif.detect(video);
            if (codes.length && codes[0].rawValue) {
              onResultat({ texte: codes[0].rawValue });
              return; // un seul résultat suffit : l'appelant décide de la suite
            }
          } else if (jsQR && canvas && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, image.width, image.height, {
              inversionAttempts: "dontInvert",
            });
            if (code?.data) {
              onResultat({ texte: code.data });
              return;
            }
          }
        } catch {
          /* image illisible : on retente à la suivante */
        }
      }
      anime = requestAnimationFrame(boucle);
    };
    anime = requestAnimationFrame(boucle);
  } catch (e) {
    arreter();
    const err = e as DOMException;
    // Messages explicites : « erreur caméra » ne dit pas quoi faire.
    if (err?.name === "NotAllowedError")
      onErreur?.(new Error("Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur."));
    else if (err?.name === "NotFoundError")
      onErreur?.(new Error("Aucune caméra détectée sur cet appareil."));
    else if (err?.name === "NotReadableError")
      onErreur?.(new Error("La caméra est déjà utilisée par une autre application."));
    else onErreur?.(new Error(err?.message || "Impossible d'ouvrir la caméra."));
  }

  return arreter;
}
