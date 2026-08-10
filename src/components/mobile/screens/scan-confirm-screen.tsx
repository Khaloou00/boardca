// Confirmation visuelle après enregistrement de la présence.
// Extrait de `admin-app.tsx` (composant de premier niveau).
import { CheckCircle2 } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import type { Reunion } from "@/types/domain";
import { TopBar } from "../shared/ui-components";
import type { Nav } from "../shared/view-state";

export function ScanConfirmScreen({
  nav,
  seanceEnCours,
  estGuest,
  mandantNom,
}: {
  nav: Nav;
  seanceEnCours?: Reunion;
  estGuest: boolean;
  /** Nom du membre représenté quand l'utilisateur est un invité mandataire. */
  mandantNom?: string;
}) {
  const profile = useBoardStore((s) => s.profile);
  const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div>
      <TopBar title="Présence confirmée" />
      <div className="px-5 py-10 text-center">
        <div className="h-24 w-24 rounded-full bg-emerald-100 mx-auto flex items-center justify-center animate-in zoom-in duration-500">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <div className="mt-6 text-xl font-bold text-navy">Présence enregistrée !</div>
        <div className="mt-3 bg-white rounded-2xl p-5 border border-slate-100 text-left">
          <div className="text-[10px] uppercase tracking-widest text-gold font-bold">Séance</div>
          <div className="text-navy font-semibold">{seanceEnCours?.titre}</div>
          <div className="mt-3 text-[10px] uppercase tracking-widest text-gold font-bold">
            {estGuest ? "Représenté par procuration" : "Membre du CA"}
          </div>
          <div className="text-navy font-semibold">{mandantNom ?? profile?.nom}</div>
          <div className="mt-3 text-[10px] uppercase tracking-widest text-gold font-bold">
            Arrivée enregistrée
          </div>
          <div className="text-navy font-semibold">{now}</div>
        </div>
        <button
          onClick={() =>
            nav({ tab: "home", sub: "meeting", data: { reunionId: seanceEnCours?.id } })
          }
          className="mt-6 w-full bg-navy text-white rounded-xl py-3.5 font-semibold"
        >
          Voir la réunion →
        </button>
        <button
          onClick={() => nav({ tab: "home" })}
          className="mt-2 w-full text-slate-500 py-2 text-sm"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
