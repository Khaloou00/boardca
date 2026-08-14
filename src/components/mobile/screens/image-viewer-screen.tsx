import { useState, useEffect } from "react";
import { TopBar } from "../shared/ui-components";
import { supabase } from "@/lib/supabase";
import { getOfflineDocument } from "@/lib/offline-storage";
import { Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";

export function ImageViewerScreen({
  nom,
  storagePath,
  onBack,
}: {
  nom: string;
  storagePath: string;
  onBack: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);
  const [zoom, setZoom] = useState(1);

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

  const zoomer = (delta: number) =>
    setZoom((z) => Math.min(4, Math.max(0.5, Math.round((z + delta) * 100) / 100)));

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-24">
      <TopBar title={nom} onBack={onBack} />
      <div className="px-2 py-3 space-y-3">
        {echec ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Lien du document indisponible.
          </div>
        ) : !url ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Préparation de l'image…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2">
              <button
                onClick={() => zoomer(-0.25)}
                disabled={zoom <= 0.5}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40"
                aria-label="Réduire"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-navy tabular-nums px-2 py-1 rounded-lg hover:bg-slate-50"
                title="Ajuster à la largeur"
              >
                <Maximize2 className="h-3.5 w-3.5 text-slate-400" />
                {Math.round(zoom * 100)} %
              </button>
              <button
                onClick={() => zoomer(0.25)}
                disabled={zoom >= 4}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-40"
                aria-label="Agrandir"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-1 overflow-auto">
              <img
                src={url}
                alt={nom}
                className="block rounded-lg"
                style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
