// ScannerScreen — lecture RÉELLE du QR de présence par la caméra.
//
// Le bouton « Simuler le scan » a été retiré : il enregistrait une présence
// « présentiel » sans la moindre vérification, ce qui vaut jeton de présence et
// figure au procès-verbal. Il n'avait sa place qu'en démonstration.
//
// Le QR affiché en séance par le secrétariat encode `BOARDCA:PRESENCE:<id>`.
// On refuse tout autre contenu, et on refuse un QR qui ne correspond pas à la
// séance en cours — sans quoi la photo d'un QR d'une autre réunion suffirait.
import { useEffect, useRef, useState } from "react";
import { Corner, TopBar } from "../shared/ui-components";
import { AlertCircle, Camera, CheckCircle2, Loader2 } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";
import { demarrerScan, extraireReunionId } from "@/lib/qr-scanner";
import type { View } from "../shared/view-state";

export function ScannerScreen({ nav }: { nav: (v: View) => void }) {
  const {
    isGuest,
    mandantPour,
    profile,
    requireOnline,
    scanPresence,
    seanceEnCours,
    setPresenceConfirmed,
  } = useMobileSession();

  const videoRef = useRef<HTMLVideoElement>(null);
  const arretRef = useRef<(() => void) | null>(null);
  const traiteRef = useRef(false); // empêche un double envoi si deux images décodent
  const [camera, setCamera] = useState<"demande" | "active" | "refusee">("demande");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const target = seanceEnCours;

  const enregistrer = async (mode: "presentiel" | "distance") => {
    if (!target || !profile) return;
    if (!requireOnline("Confirmation de présence")) return;
    setErr(null);
    setBusy(true);
    try {
      // Un invité confirme AU NOM du membre représenté, en mode 'procuration'
      // (jamais 'presentiel'/'distance' pour quelqu'un d'autre — voir policy
      // pres_insert_by_guest).
      const mandant = isGuest ? mandantPour(target.id) : undefined;
      if (isGuest) {
        if (!mandant) throw new Error("Aucun mandat actif pour cette séance");
        await scanPresence(target.id, mandant, "procuration");
      } else {
        await scanPresence(target.id, profile.id, mode);
      }
      setPresenceConfirmed(true);
      nav({ tab: "home", sub: "scan-ok" });
    } catch {
      setErr("La confirmation n'a pas pu être enregistrée. Réessayez.");
      traiteRef.current = false; // on autorise une nouvelle tentative
    } finally {
      setBusy(false);
    }
  };

  const lancerCamera = async () => {
    if (!videoRef.current) return;
    setErr(null);
    setCamera("demande");
    arretRef.current = await demarrerScan({
      video: videoRef.current,
      onResultat: ({ texte }) => {
        if (traiteRef.current) return;
        const idScanne = extraireReunionId(texte);
        if (!idScanne) {
          setErr("Ce QR code n'est pas un code de présence BoardCA.");
          return; // on continue de scruter : l'utilisateur peut viser le bon
        }
        if (target && idScanne !== target.id) {
          setErr("Ce QR correspond à une autre séance que celle en cours.");
          return;
        }
        traiteRef.current = true;
        arretRef.current?.(); // éteindre la caméra AVANT l'écriture
        void enregistrer("presentiel");
      },
      onErreur: (e) => {
        setCamera("refusee");
        setErr(e.message);
      },
    });
    // Si `onErreur` n'a pas basculé l'état, c'est que le flux est ouvert.
    setCamera((c) => (c === "refusee" ? c : "active"));
  };

  useEffect(() => {
    lancerCamera();
    // Éteindre la caméra en quittant l'écran : sans ça le voyant reste allumé
    // et la batterie se vide.
    return () => arretRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <TopBar
        title="Confirmer ma présence"
        onBack={() => {
          arretRef.current?.();
          nav({ tab: "home" });
        }}
      />
      <div className="px-5 py-4">
        <div className="text-center text-navy font-bold">{target?.titre}</div>
        <div className="text-center text-xs text-slate-500 mt-0.5">
          Centrez le QR affiché en séance
        </div>

        <div className="mt-6 relative mx-auto aspect-square max-w-[280px] rounded-2xl bg-black overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
          />
          {/* Viseur */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-3/4 aspect-square">
              <Corner className="top-0 left-0" />
              <Corner className="top-0 right-0 rotate-90" />
              <Corner className="bottom-0 right-0 rotate-180" />
              <Corner className="bottom-0 left-0 -rotate-90" />
              {camera === "active" && (
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gold shadow-[0_0_12px_#C9A84C] animate-[pulse_1.8s_ease-in-out_infinite]" />
              )}
            </div>
          </div>

          {camera === "refusee" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <div className="text-xs text-white/80">{err}</div>
              <button
                onClick={lancerCamera}
                className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white"
              >
                Réessayer
              </button>
            </div>
          )}

          {camera === "demande" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
              <Camera className="h-7 w-7 text-white/70" />
              <div className="text-[11px] text-white/70">Ouverture de la caméra…</div>
            </div>
          )}

          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <Loader2 className="h-7 w-7 animate-spin text-gold" />
            </div>
          )}

          {camera === "active" && !busy && (
            <div className="absolute bottom-2 left-0 right-0 text-center text-[11px] text-white/70">
              Recherche du QR Code…
            </div>
          )}
        </div>

        {err && camera !== "refusee" && (
          <div className="mt-3 text-center text-xs text-red-600">{err}</div>
        )}

        <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="flex-1 h-px bg-slate-200" /> OU{" "}
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="mt-4 text-center text-xs text-slate-500">
          Vous suivez la séance à distance, sans être sur place ?
        </div>
        <button
          onClick={() => {
            arretRef.current?.();
            void enregistrer("distance");
          }}
          disabled={busy}
          className="mt-2 w-full bg-white border-[1.5px] border-navy text-navy rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          Présent
        </button>
      </div>
    </div>
  );
}
