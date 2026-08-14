import { useState, useEffect } from "react";
import { TopBar } from "../shared/ui-components";
import { PdfAnnotator } from "@/components/pdf/pdf-annotator";
import { type AnnotationCible } from "@/lib/annotations";
import { supabase } from "@/lib/supabase";
import { getOfflineDocument } from "@/lib/offline-storage";
import { type User as CaUser } from "@/types/domain";
import { Loader2 } from "lucide-react";

export function PdfViewerScreen({
  cible,
  nom,
  storagePath,
  partenaire,
  onBack,
  profile,
}: {
  cible: AnnotationCible;
  nom: string;
  storagePath: string;
  /** Binôme mandant/mandataire actif — voir `partenaireProcuration`. */
  partenaire?: { userId: string; nom: string };
  onBack: () => void;
  profile: CaUser | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const charger = async () => {
      // 1. Essayer de charger depuis le stockage hors-ligne
      try {
        const offlineBlob = await getOfflineDocument(storagePath);
        if (offlineBlob) {
          if (!cancelled) setUrl(URL.createObjectURL(offlineBlob));
          return;
        }
      } catch (err) {
        console.warn("Erreur lecture hors-ligne", err);
      }

      // 2. Sinon, demander au serveur
      const { data } = await supabase.storage
        .from("boardca-docs")
        .createSignedUrl(storagePath, 3600);
      
      if (cancelled) return;
      if (data?.signedUrl) setUrl(data.signedUrl);
      else setEchec(true);
    };

    charger();

    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-24">
      <TopBar title={nom} onBack={onBack} />
      {/* Marges réduites : la page doit occuper le maximum de largeur. */}
      <div className="px-2 py-3">
        {echec ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Lien du document indisponible.
          </div>
        ) : !url || !profile ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Préparation du document…
          </div>
        ) : (
          <PdfAnnotator
            cible={cible}
            url={url}
            userId={profile.id}
            partageAvecUserId={partenaire?.userId}
            partageAvecNom={partenaire?.nom}
          />
        )}
      </div>
    </div>
  );
}
