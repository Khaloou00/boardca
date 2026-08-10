// Invite flottante « Installer l'application ».
//
// Montée à la racine : elle suit l'utilisateur sur toutes les pages, y compris
// l'écran de connexion — c'est justement là que l'installation a le plus de
// sens, avant même d'entrer dans l'application.
//
// Trois règles pour qu'elle ne devienne pas une nuisance :
//  - elle disparaît définitivement une fois l'application installée ;
//  - un rejet est mémorisé et respecté pendant 7 jours ;
//  - elle se place au-dessus de la barre d'onglets sur /mobile, jamais dessus.
import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Download, X } from "lucide-react";
import {
  consommerInvitation,
  dejaInstallee,
  invitationDisponible,
  marquerInstallee,
  plateforme,
  surChangement,
} from "@/lib/install-prompt";
import { InstallButton } from "@/components/install-button";

const CLE_REJET = "install-invite-rejetee";
const DELAI_REPROPOSITION = 7 * 24 * 60 * 60 * 1000; // 7 jours

function rejetEncoreValide(): boolean {
  if (typeof window === "undefined") return true;
  const t = Number(window.localStorage.getItem(CLE_REJET) ?? 0);
  return Date.now() - t < DELAI_REPROPOSITION;
}

export function InstallFloating() {
  const [visible, setVisible] = useState(false);
  const [os, setOs] = useState<"ios" | "android" | "bureau">("bureau");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const evaluer = () => setVisible(!dejaInstallee() && !rejetEncoreValide());
    setOs(plateforme());
    // Petit délai : ne pas surgir dans la seconde où la page s'affiche.
    const t = setTimeout(evaluer, 2500);
    const off = surChangement(evaluer);
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);

  if (!visible) return null;

  const rejeter = () => {
    window.localStorage.setItem(CLE_REJET, String(Date.now()));
    setVisible(false);
  };

  const installer = async () => {
    const invite = invitationDisponible();
    if (!invite) return; // sans invite native, c'est InstallButton qui explique
    await invite.prompt();
    const { outcome } = await invite.userChoice;
    consommerInvitation();
    if (outcome === "accepted") {
      marquerInstallee();
      setVisible(false);
    }
  };

  // La barre d'onglets de l'app mobile est fixée en bas : on se pose au-dessus.
  const surMobile = pathname.startsWith("/mobile");

  return (
    <div
      className={`fixed z-[90] left-4 right-4 sm:left-auto sm:right-6 sm:w-[360px] ${
        surMobile ? "bottom-28" : "bottom-4 sm:bottom-6"
      }`}
      role="dialog"
      aria-label="Installer l'application"
    >
      <div className="rounded-2xl border border-gold/30 bg-white/95 backdrop-blur-md shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-navy flex items-center justify-center">
            <Download className="h-5 w-5 text-gold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-navy">Installer BoardCA</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {os === "ios"
                ? "Sur iPhone, l'installation est nécessaire pour recevoir les notifications de convocation et de vote."
                : "Accès direct depuis votre écran d'accueil, et notifications des convocations et des votes."}
            </div>
          </div>
          <button
            onClick={rejeter}
            aria-label="Plus tard"
            className="shrink-0 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {invitationDisponible() ? (
            <button
              onClick={installer}
              className="flex-1 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light transition"
            >
              Installer
            </button>
          ) : (
            // Pas d'invite native (Safari, Firefox, invite déjà consommée) :
            // InstallButton prend le relais et affiche la marche à suivre.
            <InstallButton className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-light transition" />
          )}
          <button
            onClick={rejeter}
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-navy"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
