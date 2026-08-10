// Bouton « Installer l'application ».
//
// Il s'affiche dès lors que l'application n'est PAS déjà installée — et non
// seulement quand le navigateur a émis `beforeinstallprompt`. Ce choix vient
// d'un constat : cet événement n'arrive jamais sur Safari et Firefox, il est
// consommé une seule fois par Chrome, et il peut partir avant même que React
// n'ait monté. Conditionner l'affichage à sa présence faisait donc disparaître
// le bouton sans explication.
//
// Deux comportements au clic :
//  - invite native disponible  → on la déclenche ;
//  - sinon                     → marche à suivre adaptée au navigateur.
import { useEffect, useState } from "react";
import { Download, Share, Plus, X, MoreVertical } from "lucide-react";
import {
  consommerInvitation,
  dejaInstallee,
  invitationDisponible,
  marquerInstallee,
  plateforme,
  surChangement,
} from "@/lib/install-prompt";

export function InstallButton({ className = "" }: { className?: string }) {
  const [installee, setInstallee] = useState(true); // on masque tant qu'on ne sait pas
  const [aide, setAide] = useState(false);
  const [os, setOs] = useState<"ios" | "android" | "bureau">("bureau");

  useEffect(() => {
    const relire = () => setInstallee(dejaInstallee());
    relire();
    setOs(plateforme());
    return surChangement(relire);
  }, []);

  if (installee) return null;

  const cliquer = async () => {
    const invite = invitationDisponible();
    if (!invite) return setAide(true); // pas d'invite native : on explique
    await invite.prompt();
    const { outcome } = await invite.userChoice;
    consommerInvitation();
    if (outcome === "accepted") marquerInstallee();
  };

  const etapes =
    os === "ios"
      ? [
          { icone: Share, texte: "Touchez le bouton Partager, en bas de l'écran" },
          { icone: Plus, texte: "Choisissez « Sur l'écran d'accueil »" },
          { icone: null, texte: "Confirmez avec « Ajouter »" },
        ]
      : os === "android"
        ? [
            { icone: MoreVertical, texte: "Ouvrez le menu du navigateur (⋮)" },
            { icone: Plus, texte: "Choisissez « Installer l'application »" },
            { icone: null, texte: "Confirmez avec « Installer »" },
          ]
        : [
            { icone: MoreVertical, texte: "Ouvrez le menu de Chrome (⋮), en haut à droite" },
            { icone: Download, texte: "Choisissez « Installer BoardCA… »" },
            { icone: null, texte: "Confirmez avec « Installer »" },
          ];

  return (
    <>
      <button
        onClick={cliquer}
        className={
          className ||
          "inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold hover:bg-gold/20 transition"
        }
      >
        <Download className="h-4 w-4 shrink-0" />
        Installer l'application
      </button>

      {aide && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setAide(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-bold text-navy">
                Installer BoardCA{os === "ios" ? " sur votre iPhone" : ""}
              </div>
              <button onClick={() => setAide(false)} aria-label="Fermer" className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              {etapes.map((e, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {e.icone && <e.icone className="h-4 w-4 shrink-0 text-navy" />}
                    {e.texte}
                  </span>
                </li>
              ))}
            </ol>
            {os === "ios" && (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                Sur iPhone, cette étape est indispensable pour recevoir les notifications
                de convocation et de vote : Safari ne les délivre pas depuis un onglet.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
