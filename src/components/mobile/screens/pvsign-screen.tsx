// PVSignScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState } from "react";
import { CanvasSignPad, type Signature } from "../shared/signature-pad";
import { TopBar } from "../shared/ui-components";
import { type PV } from "@/types/domain";
import { Crown, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
export function PVSignScreen({ nav }: { nav: (v: View) => void }) {
  const {
    canSeal,
    isEffectiveSealer,
    isGuest,
    isPCA,
    profile,
    pvIdentiteEffective,
    realPv,
    realUsersById,
    requireOnline,
    signPV,
    signatures,
  } = useMobileSession();

  const [saving, setSaving] = useState(false);
  const sealing = canSeal;
  const finalize = async (methode: Signature["methode"], imageBase64?: string) => {
    if (!profile || !realPv || saving) return;
    if (!requireOnline("Signature du PV")) return;
    const domainMethode = ({ tracé: "trace", otp: "otp", biométrie: "biometrie" } as const)[
      methode
    ];
    setSaving(true);
    try {
      // Un invité signe AU NOM du membre représenté (même ligne signatures
      // que si le membre avait signé lui-même — voir policy sig_insert_by_guest
      // et `pvIdentiteEffective` plus haut).
      await signPV(realPv.id, pvIdentiteEffective ?? profile.id, domainMethode, imageBase64);
      toast.success(sealing ? "PV scellé" : "Signature enregistrée", {
        description: sealing
          ? `Sceau final apposé par ${isPCA ? "le PCA" : "le président de séance délégué"} — PV archivé.`
          : "Conforme eIDAS · horodatée et scellée.",
      });
      nav({ tab: "home", sub: "pv" });
    } catch {
      toast.error("Échec de l'enregistrement de la signature");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-6">
      <TopBar
        title={sealing ? "Sceller le PV" : "Signer le PV"}
        onBack={() => nav({ tab: "home", sub: "pv" })}
      />
      <div className="px-5 py-4">
        {sealing && (
          <div className="mb-3 rounded-lg bg-gold/10 border border-gold/30 px-3 py-2 text-[11px] text-navy flex items-start gap-2">
            <Crown className="h-4 w-4 text-gold shrink-0 mt-0.5" />
            Tous les autres membres présents ont signé. Votre signature,{" "}
            {isPCA ? "en tant que PCA" : "en tant que président de séance délégué"}, scelle
            définitivement le PV.
          </div>
        )}
        <div className="rounded-xl bg-white border border-slate-100 p-4 shadow-sm">
          <div className="text-[10px] uppercase tracking-widest text-gold font-bold">
            Apposer ma signature certifiée
          </div>
          <div className="mt-1 text-navy font-semibold text-[14px] flex items-center gap-1.5">
            {isGuest
              ? (realUsersById[pvIdentiteEffective ?? ""]?.nom ?? profile?.nom)
              : profile?.nom}
            {isEffectiveSealer && <Crown className="h-3.5 w-3.5 text-gold" />}
          </div>
          <div className="text-[11px] text-slate-500">
            {isGuest
              ? `Représenté par ${profile?.nom} (procuration)`
              : isPCA
                ? "Président du Conseil d'Administration"
                : isEffectiveSealer
                  ? "Président de séance délégué"
                  : (profile?.qualite ?? "Membre du CA")}
          </div>
        </div>

        {/* Signature manuscrite tracée à l'écran — seule méthode retenue. */}
        <div className="mt-4">
          <CanvasSignPad onValidate={(img) => finalize("tracé", img)} />
        </div>

        <div className="mt-4 text-[10px] text-slate-500 flex items-start gap-2 bg-white border border-slate-100 rounded-lg p-3">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            La signature sera horodatée GMT et scellée par un hash SHA-256 conforme au règlement
            eIDAS. Elle est définitive.
          </div>
        </div>
      </div>
    </div>
  );
}
