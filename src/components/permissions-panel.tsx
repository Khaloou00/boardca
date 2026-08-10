// Panneau d'autorisations de l'appareil.
//
// Chaque permission est demandée SÉPARÉMENT, sur un geste explicite, et après
// avoir expliqué à quoi elle sert. Ce n'est pas de la politesse : Chrome et
// Safari pénalisent durablement un site qui réclame la caméra ou les
// notifications au chargement, et un refus est difficile à rattraper — seul
// l'utilisateur peut revenir en arrière, depuis les réglages du navigateur.
//
// La géolocalisation reste FACULTATIVE : elle n'est pas nécessaire pour
// émarger (c'est le QR affiché en séance qui atteste la présence), elle sert
// seulement à horodater le lieu si l'institution le souhaite.
import { useEffect, useState } from "react";
import { Bell, Camera, Check, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { activerPush, etatPush, iosSansInstallation, type EtatPush } from "@/lib/push";

type Etat = "inconnu" | "accorde" | "refuse" | "a-demander";

function etatVersLibelle(e: Etat) {
  return e === "accorde" ? "Autorisé" : e === "refuse" ? "Refusé" : "Non configuré";
}

export function PermissionsPanel() {
  const [camera, setCamera] = useState<Etat>("inconnu");
  const [position, setPosition] = useState<Etat>("inconnu");
  const [notifs, setNotifs] = useState<EtatPush | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [iosAInstaller, setIosAInstaller] = useState(false);

  // `navigator.permissions` permet de LIRE un état sans rien demander : on
  // n'affiche donc jamais une invite juste pour savoir où on en est.
  useEffect(() => {
    setIosAInstaller(iosSansInstallation());
    etatPush().then(setNotifs);
    const lire = async (nom: PermissionName, set: (e: Etat) => void) => {
      try {
        const s = await navigator.permissions.query({ name: nom });
        set(s.state === "granted" ? "accorde" : s.state === "denied" ? "refuse" : "a-demander");
      } catch {
        set("a-demander"); // Safari n'expose pas toutes les permissions à la lecture
      }
    };
    lire("camera" as PermissionName, setCamera);
    lire("geolocation" as PermissionName, setPosition);
  }, []);

  const demanderCamera = async () => {
    setEnCours("camera");
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      // On coupe aussitôt : le but était d'obtenir l'autorisation, pas de filmer.
      flux.getTracks().forEach((t) => t.stop());
      setCamera("accorde");
      toast.success("Caméra autorisée", { description: "Le scan du QR de présence est prêt." });
    } catch {
      setCamera("refuse");
      toast.error("Caméra refusée", {
        description: "À réautoriser dans les réglages du navigateur.",
      });
    } finally {
      setEnCours(null);
    }
  };

  const demanderNotifs = async () => {
    setEnCours("notifs");
    try {
      const e = await activerPush();
      setNotifs(e);
      if (e === "actif") toast.success("Notifications activées");
      else if (e === "refuse")
        toast.error("Notifications refusées", {
          description: "À réautoriser dans les réglages du navigateur.",
        });
    } catch (e) {
      toast.error("Activation impossible", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setEnCours(null);
    }
  };

  const demanderPosition = () => {
    setEnCours("position");
    navigator.geolocation.getCurrentPosition(
      () => {
        setPosition("accorde");
        setEnCours(null);
        toast.success("Position autorisée");
      },
      () => {
        setPosition("refuse");
        setEnCours(null);
        toast.error("Position refusée");
      },
      { timeout: 10000 },
    );
  };

  const lignes = [
    {
      cle: "camera",
      icone: Camera,
      titre: "Caméra",
      role: "Scanner le QR code affiché en séance pour confirmer votre présence.",
      etat: camera,
      libelle: etatVersLibelle(camera),
      action: demanderCamera,
      requis: true,
    },
    {
      cle: "notifs",
      icone: Bell,
      titre: "Notifications",
      role: "Être prévenu d'une convocation, d'un scrutin ouvert ou d'un PV à signer.",
      etat:
        notifs === "actif"
          ? ("accorde" as Etat)
          : notifs === "refuse"
            ? ("refuse" as Etat)
            : ("a-demander" as Etat),
      libelle:
        notifs === "non-supporte" && iosAInstaller
          ? "Installez d'abord l'app"
          : notifs === "non-supporte"
            ? "Non gérée par ce navigateur"
            : etatVersLibelle(
                notifs === "actif" ? "accorde" : notifs === "refuse" ? "refuse" : "a-demander",
              ),
      action: demanderNotifs,
      requis: true,
      desactive: notifs === "non-supporte",
    },
    {
      cle: "position",
      icone: MapPin,
      titre: "Position",
      role: "Facultatif : horodater le lieu de votre émargement, si votre institution le demande.",
      etat: position,
      libelle: etatVersLibelle(position),
      action: demanderPosition,
      requis: false,
    },
  ];

  return (
    <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="text-sm font-semibold text-navy">Autorisations de l'appareil</div>
        <div className="text-xs text-slate-500 mt-0.5">
          Accordées une seule fois, révocables à tout moment dans les réglages du navigateur.
        </div>
      </div>

      {lignes.map((l, i) => (
        <div
          key={l.cle}
          className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-slate-100" : ""}`}
        >
          <div
            className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
              l.etat === "accorde"
                ? "bg-emerald-100"
                : l.etat === "refuse"
                  ? "bg-red-50"
                  : "bg-slate-100"
            }`}
          >
            <l.icone
              className={`h-4 w-4 ${
                l.etat === "accorde"
                  ? "text-emerald-600"
                  : l.etat === "refuse"
                    ? "text-red-500"
                    : "text-slate-400"
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-navy flex items-center gap-1.5">
              {l.titre}
              {!l.requis && (
                <span className="text-[9px] uppercase tracking-wider text-slate-400 border border-slate-200 rounded px-1">
                  facultatif
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{l.role}</div>
          </div>

          {l.etat === "accorde" ? (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <Check className="h-3.5 w-3.5" /> {l.libelle}
            </span>
          ) : l.etat === "refuse" ? (
            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-red-500">
              <X className="h-3.5 w-3.5" /> {l.libelle}
            </span>
          ) : (
            <button
              onClick={l.action}
              disabled={!!enCours || l.desactive}
              className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {enCours === l.cle ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : l.desactive ? (
                l.libelle
              ) : (
                "Autoriser"
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
