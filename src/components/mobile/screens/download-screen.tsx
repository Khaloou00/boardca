// DownloadScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState, useEffect } from "react";
import { ProgressLine, TopBar } from "../shared/ui-components";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
import { AGENDA_POINTS } from "../shared/constants";
export function DownloadScreen({ nav }: { nav: (v: View) => void }) {
  const {
    log,
    meeting,
    setDownloaded,
  } = useMobileSession();

  const [step, setStep] = useState(-1); // -1 cover, 0..n points, ==length means done
  const done = step >= AGENDA_POINTS.length;
  useEffect(() => {
    if (done) {
      setDownloaded(true);
      log("Board Book téléchargé hors-ligne (mobile)", meeting.title);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 550);
    return () => clearTimeout(t);
  }, [step, done]);

  const pct = done ? 100 : Math.round(((step + 1) / (AGENDA_POINTS.length + 1)) * 100);
  const totalPages = AGENDA_POINTS.reduce((sum, p) => sum + p.pages, 0);

  return (
    <div>
      <TopBar title="Téléchargement" onBack={() => nav({ tab: "home", sub: "convocation" })} />
      <div className="px-5 py-4">
        <div className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          {!done ? (
            <>
              <div className="flex items-center gap-2 text-navy font-semibold">
                <Loader2 className="h-4 w-4 animate-spin text-gold" /> Téléchargement en cours…
              </div>
              <div className="mt-4 space-y-2">
                <ProgressLine
                  done={step >= -1 && step >= 0}
                  label="Couverture & Sommaire"
                  pages="—"
                  active={step === -1}
                />
                {AGENDA_POINTS.map((p, i) => (
                  <ProgressLine
                    key={p.n}
                    done={step > i}
                    active={step === i}
                    label={`Point ${p.n} — ${p.file}`}
                    pages={`${p.pages} pages`}
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
                  {totalPages} pages · 5,8 MB ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Chiffré AES-256
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">Valable jusqu'au 16/07/2026</div>
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
