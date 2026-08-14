// DownloadScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState, useEffect } from "react";
import { ProgressLine, TopBar } from "../shared/ui-components";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";
import { supabase } from "@/lib/supabase";
import { saveDocumentOffline } from "@/lib/offline-storage";

import type { View } from "../shared/view-state";

export function DownloadScreen({ nav }: { nav: (v: View) => void }) {
  const { log, meeting, boardBookReunion, setDownloaded, requireOnline } = useMobileSession();

  const [step, setStep] = useState(-1);
  const [downloading, setDownloading] = useState(true);
  const [docsToDownload, setDocsToDownload] = useState<
    { id: string; nom: string; storagePath: string; pages: number; tailleBytes: number }[]
  >([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalSize, setTotalSize] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const done = step >= docsToDownload.length && docsToDownload.length > 0;

  // 1. Découverte des fichiers à télécharger
  useEffect(() => {
    let cancelled = false;
    if (!boardBookReunion) {
      setErrorMessage("Aucune séance disponible pour le Board Book.");
      setDownloading(false);
      return;
    }
    if (!requireOnline("Le téléchargement")) {
      setDownloading(false);
      return;
    }

    Promise.all([
      supabase
        .from("board_books")
        .select("id, pages, taille_bytes, storage_path")
        .eq("reunion_id", boardBookReunion.id)
        .maybeSingle(),
      supabase
        .from("documents")
        .select("id, nom, pages, taille_bytes, storage_path")
        .eq("reunion_id", boardBookReunion.id)
        .not("storage_path", "is", null),
    ])
      .then(([bbRes, docsRes]) => {
        if (cancelled) return;
        const toDownload = [];
        
        const bb = bbRes.data as any;
        if (bb && bb.storage_path) {
          toDownload.push({
            id: bb.id,
            nom: "Board Book — PDF complet",
            storagePath: bb.storage_path,
            pages: bb.pages || 0,
            tailleBytes: bb.taille_bytes || 0,
          });
        }

        const pieces = (docsRes.data ?? []) as any[];
        for (const p of pieces) {
          toDownload.push({
            id: p.id,
            nom: p.nom,
            storagePath: p.storage_path,
            pages: p.pages || 0,
            tailleBytes: p.taille_bytes || 0,
          });
        }

        if (toDownload.length === 0) {
          setErrorMessage("Aucun document à télécharger pour cette séance.");
          setDownloading(false);
          return;
        }

        setTotalPages(toDownload.reduce((sum, d) => sum + d.pages, 0));
        setTotalSize(toDownload.reduce((sum, d) => sum + d.tailleBytes, 0));
        setDocsToDownload(toDownload);
        setStep(0); // Démarrer le téléchargement
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage("Erreur lors de la récupération des documents.");
          setDownloading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boardBookReunion]);

  // 2. Téléchargement effectif séquentiel
  useEffect(() => {
    if (step < 0 || step >= docsToDownload.length) return;

    let cancelled = false;
    const currentDoc = docsToDownload[step];

    const telecharger = async () => {
      try {
        // 2a. Obtenir l'URL signée
        const { data: urlData, error: urlError } = await supabase.storage
          .from("boardca-docs")
          .createSignedUrl(currentDoc.storagePath, 60); // URL valide très peu de temps
          
        if (urlError || !urlData?.signedUrl) throw new Error("URL signée introuvable");

        // 2b. Télécharger le blob
        const response = await fetch(urlData.signedUrl);
        if (!response.ok) throw new Error("Erreur réseau");
        const blob = await response.blob();

        // 2c. Enregistrer dans IndexedDB
        if (cancelled) return;
        await saveDocumentOffline(currentDoc.storagePath, blob);

        // 2d. Passer au suivant (avec un petit délai visuel)
        setTimeout(() => {
          if (!cancelled) setStep((s) => s + 1);
        }, 300);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setErrorMessage("Le téléchargement a été interrompu. Vérifiez votre connexion.");
          setDownloading(false);
        }
      }
    };

    telecharger();

    return () => {
      cancelled = true;
    };
  }, [step, docsToDownload]);

  // 3. Finalisation
  useEffect(() => {
    if (done) {
      setDownloaded(true);
      setDownloading(false);
      log("Board Book téléchargé hors-ligne (mobile)", meeting.title);
    }
  }, [done]);

  const pct = docsToDownload.length === 0 
    ? 0 
    : done ? 100 : Math.round((step / docsToDownload.length) * 100);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "Taille inconnue";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  return (
    <div>
      <TopBar title="Téléchargement" onBack={() => nav({ tab: "home", sub: "convocation" })} />
      <div className="px-5 py-4">
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          {errorMessage ? (
            <div className="text-center py-6">
              <div className="text-sm font-semibold text-red-600 mb-2">Impossible de télécharger</div>
              <div className="text-xs text-slate-500 mb-6">{errorMessage}</div>
              <button
                onClick={() => nav({ tab: "home" })}
                className="w-full bg-navy text-white rounded-xl py-3 font-semibold"
              >
                Retour
              </button>
            </div>
          ) : !done ? (
            <>
              <div className="flex items-center gap-2 text-navy font-semibold">
                <Loader2 className="h-4 w-4 animate-spin text-gold" /> Téléchargement en cours…
              </div>
              <div className="mt-4 space-y-2">
                {docsToDownload.map((p, i) => (
                  <ProgressLine
                    key={p.id}
                    done={step > i}
                    active={step === i}
                    label={p.nom}
                    pages={p.pages ? `${p.pages} pages` : "—"}
                  />
                ))}
              </div>
              <div className="mt-5">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gold to-yellow-600 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-[11px] text-slate-500 font-medium">
                  {pct}%
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center animate-in zoom-in duration-500">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="mt-3 font-bold text-navy">Board Book disponible hors-ligne</div>
              <div className="mt-2 text-[12px] text-slate-600 space-y-0.5">
                <div>
                  {totalPages > 0 ? `${totalPages} pages · ` : ""}
                  {formatSize(totalSize)} ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Chiffré AES-256
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">Stocké de façon sécurisée sur votre appareil</div>
              </div>
              <button
                onClick={() => nav({ tab: "boardbook" })}
                className="mt-5 w-full bg-navy text-white rounded-xl py-3 font-semibold"
              >
                Ouvrir le Board Book
              </button>
              <button
                onClick={() => nav({ tab: "home" })}
                className="mt-2 w-full text-slate-500 py-2 text-sm"
              >
                Retour à l'accueil
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
