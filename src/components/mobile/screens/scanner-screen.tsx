// ScannerScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState } from "react";
import { Corner, TopBar } from "../shared/ui-components";
import { type PV } from "@/types/domain";
import { CheckCircle2, Loader2, ScanLine } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";

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

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const target = seanceEnCours;
  const doScan = async (mode: "presentiel" | "distance") => {
    if (!target || !profile) return;
    if (!requireOnline("Confirmation de présence")) return;
    setErr(null);
    setBusy(true);
    try {
      // Un invité scanne AU NOM du membre représenté, en mode 'procuration'
      // (jamais 'presentiel'/'distance' pour quelqu'un d'autre — voir policy
      // pres_insert_by_guest). Un membre qui confirme pour lui-même choisit
      // présentiel (scan du QR) ou à distance (bouton « Présent »).
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
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <TopBar title="Confirmer ma présence" onBack={() => nav({ tab: "home" })} />
      <div className="px-5 py-4">
        <div className="text-center text-navy font-bold">{target?.titre}</div>
        <div className="text-center text-xs text-slate-500 mt-0.5">
          Centrez le QR affiché en séance
        </div>
        <div className="mt-6 relative mx-auto aspect-square max-w-[280px] rounded-2xl bg-black overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-black to-slate-900" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-3/4 aspect-square">
              <Corner className="top-0 left-0" />
              <Corner className="top-0 right-0 rotate-90" />
              <Corner className="bottom-0 right-0 rotate-180" />
              <Corner className="bottom-0 left-0 -rotate-90" />
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gold shadow-[0_0_12px_#C9A84C] animate-[pulse_1.8s_ease-in-out_infinite]" />
            </div>
          </div>
          <div className="absolute bottom-2 left-0 right-0 text-center text-white/70 text-[11px]">
            Recherche du QR Code…
          </div>
        </div>

        {/* Raccourci de DÉMONSTRATION : la lecture réelle du QR par la caméra
            n'est pas implémentée, ce bouton enregistre directement la présence
            en mode « presentiel » (le même que produirait un vrai scan), ce qui
            fait apparaître le membre comme présent physiquement sur le PV.
            Volontairement petit et rouge pour ne pas être confondu avec une
            action métier — à retirer le jour où le scan caméra existe. */}
        <button
          onClick={() => doScan("presentiel")}
          disabled={busy}
          className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-600 active:scale-95 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanLine className="h-3.5 w-3.5" />
          )}
          Simuler le scan
        </button>

        <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
          <div className="flex-1 h-px bg-slate-200" /> OU{" "}
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="mt-4 text-center text-xs text-slate-500">
          Vous suivez la séance à distance, sans être sur place ?
        </div>
        <button
          onClick={() => doScan("distance")}
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
        {err && <div className="mt-3 text-center text-xs text-red-600">{err}</div>}
      </div>
    </div>
  );
}
