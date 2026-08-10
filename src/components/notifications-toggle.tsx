// Interrupteur d'activation des notifications push.
//
// À placer sur un écran de réglages : l'autorisation ne peut être demandée que
// sur un geste explicite (voir `activerPush`).
import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  activerPush,
  desactiverPush,
  etatPush,
  iosSansInstallation,
  type EtatPush,
} from "@/lib/push";

export function NotificationsToggle() {
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [iosAInstaller, setIosAInstaller] = useState(false);

  useEffect(() => {
    setIosAInstaller(iosSansInstallation());
    etatPush().then(setEtat);
  }, []);

  if (etat === null) return null;

  const basculer = async () => {
    setOccupe(true);
    try {
      if (etat === "actif") {
        setEtat(await desactiverPush());
        toast.success("Notifications désactivées sur cet appareil");
      } else {
        const nouveau = await activerPush();
        setEtat(nouveau);
        if (nouveau === "actif") toast.success("Notifications activées sur cet appareil");
        else if (nouveau === "refuse")
          toast.error("Notifications bloquées", {
            description: "Réautorisez-les dans les réglages de votre navigateur.",
          });
      }
    } catch (e) {
      toast.error("Action impossible", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setOccupe(false);
    }
  };

  // Sur iPhone, la Push API n'existe pas tant que l'app n'est pas sur l'écran
  // d'accueil : dire « non supporté » serait faux et décourageant.
  if (etat === "non-supporte" && iosAInstaller) {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
            <Smartphone className="h-4 w-4 text-gold" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-navy">Notifications</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Sur iPhone, installez d'abord BoardCA sur votre écran d'accueil
              (Partager → Sur l'écran d'accueil). Safari ne délivre pas les
              notifications depuis un onglet.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (etat === "non-supporte") {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 p-4 text-xs text-slate-500">
        Ce navigateur ne gère pas les notifications.
      </div>
    );
  }

  const actif = etat === "actif";
  return (
    <button
      onClick={basculer}
      disabled={occupe || etat === "refuse"}
      className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 active:scale-[0.99] transition disabled:opacity-70"
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
            actif ? "bg-emerald-100" : "bg-slate-100"
          }`}
        >
          {occupe ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : actif ? (
            <Bell className="h-4 w-4 text-emerald-600" />
          ) : (
            <BellOff className="h-4 w-4 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-navy">Notifications sur cet appareil</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {etat === "refuse"
              ? "Bloquées — à réautoriser dans les réglages du navigateur"
              : actif
                ? "Convocations, scrutins et PV à signer vous sont notifiés"
                : "Activer pour être prévenu des convocations et des votes"}
          </div>
        </div>
        <div
          className={`h-6 w-11 rounded-full p-0.5 shrink-0 transition ${
            actif ? "bg-emerald-500" : "bg-slate-200"
          }`}
        >
          <div
            className={`h-5 w-5 rounded-full bg-white shadow transition ${actif ? "translate-x-5" : ""}`}
          />
        </div>
      </div>
    </button>
  );
}
