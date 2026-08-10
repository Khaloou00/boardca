// Bouton « Installer l'application ».
//
// Deux mondes, un seul composant :
//  - Chrome / Edge / Android émettent `beforeinstallprompt` : on capte
//    l'événement et on déclenche l'invite native au clic.
//  - iOS / Safari n'émettent RIEN et n'ont pas d'API d'installation : la seule
//    voie est « Partager → Sur l'écran d'accueil ». On affiche donc la marche à
//    suivre. Ce n'est pas cosmétique : sur iPhone, l'installation est la
//    CONDITION d'existence des notifications push (16.4+, jamais dans un onglet).
//
// Le bouton disparaît si l'application est déjà installée.
import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

type PromptInstall = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function estDejaInstallee() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS n'implémente pas display-mode : il expose `navigator.standalone`.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function estIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS se déclare « Macintosh » : on le distingue au tactile.
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

export function InstallButton({ className = "" }: { className?: string }) {
  const [invite, setInvite] = useState<PromptInstall | null>(null);
  const [installee, setInstallee] = useState(false);
  const [aideIOS, setAideIOS] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstallee(estDejaInstallee());
    setIos(estIOS());

    const surInvite = (e: Event) => {
      e.preventDefault(); // sans ça, Chrome affiche sa propre bannière
      setInvite(e as PromptInstall);
    };
    const surInstallation = () => {
      setInstallee(true);
      setInvite(null);
    };
    window.addEventListener("beforeinstallprompt", surInvite);
    window.addEventListener("appinstalled", surInstallation);
    return () => {
      window.removeEventListener("beforeinstallprompt", surInvite);
      window.removeEventListener("appinstalled", surInstallation);
    };
  }, []);

  // Déjà installée, ou navigateur sans aucune voie d'installation : on n'affiche rien.
  if (installee) return null;
  if (!invite && !ios) return null;

  const installer = async () => {
    if (ios && !invite) return setAideIOS(true);
    if (!invite) return;
    await invite.prompt();
    const { outcome } = await invite.userChoice;
    if (outcome === "accepted") setInstallee(true);
    setInvite(null); // l'événement n'est utilisable qu'une fois
  };

  return (
    <>
      <button
        onClick={installer}
        className={
          className ||
          "inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold/20 transition"
        }
      >
        <Download className="h-4 w-4 shrink-0" />
        Installer l'application
      </button>

      {aideIOS && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setAideIOS(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-bold text-navy">Installer BoardCA sur votre iPhone</div>
              <button onClick={() => setAideIOS(false)} aria-label="Fermer" className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  1
                </span>
                <span className="flex items-center gap-1.5">
                  Touchez <Share className="h-4 w-4 text-navy" /> en bas de l'écran
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  2
                </span>
                <span className="flex items-center gap-1.5">
                  Choisissez <Plus className="h-4 w-4 text-navy" /> « Sur l'écran d'accueil »
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                  3
                </span>
                <span>Confirmez avec « Ajouter »</span>
              </li>
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Sur iPhone, cette étape est indispensable pour recevoir les notifications
              de convocation et de vote : Safari ne les délivre pas depuis un onglet.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
