// Liste des procès-verbaux scellés, avec aperçu PDF. Extrait de `admin-app.tsx` :
// composant de premier niveau — son état local (`rows`, `apercu`) n'est plus
// réinitialisé par une mise à jour sans rapport ailleurs dans l'app.
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Crown,
  FileSignature,
  FileText,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useBoardStore } from "@/store/useBoardStore";
import { fetchPvArchives, type PvArchive } from "@/lib/archives";
import { genererPvPdfUrl } from "@/lib/pv-pdf";
import { TopBar } from "../shared/ui-components";

export function PvArchivesScreen({ onBack }: { onBack: () => void }) {
  const realPvs = useBoardStore((s) => s.pvs);
  const realReunions = useBoardStore((s) => s.reunions);
  const realUsers = useBoardStore((s) => s.users);
  const realUsersById = useMemo(
    () => Object.fromEntries(realUsers.map((u) => [u.id, u])),
    [realUsers],
  );

  const [rows, setRows] = useState<PvArchive[]>([]);
  const [loading, setLoading] = useState(true);
  // Aperçu PDF du PV scellé (avec la signature du PCA), ouvert au clic d'une carte.
  const [apercu, setApercu] = useState<{ url: string; titre: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPvArchives()
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Construit le PDF final du PV : son contenu + la SEULE signature du PCA (les
  // approbations des membres n'y figurent pas — c'est le sceau qui fait foi).
  const ouvrirPdf = (p: PvArchive) => {
    const pvReel = realPvs.find((x) => x.reunionId === p.reunionId);
    if (!pvReel || !pvReel.contenu) {
      toast.error("Contenu du procès-verbal indisponible");
      return;
    }
    const sigPca = pvReel.signatures.find(
      (s) => s.pvVersion === pvReel.version && realUsersById[s.userId]?.estPresidentCA,
    );
    const reunion = realReunions.find((r) => r.id === p.reunionId);
    const url = genererPvPdfUrl({
      titre: p.reunionTitre,
      date: p.date
        ? new Date(p.date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "—",
      lieu: reunion?.lieu ?? "—",
      contenuHtml: pvReel.contenu,
      signatures: sigPca
        ? [
            {
              nom: realUsersById[sigPca.userId]?.nom ?? p.scellePar ?? "Président du Conseil",
              date: new Date(sigPca.signedAt).toLocaleString("fr-FR"),
              image: sigPca.imageBase64,
            },
          ]
        : [],
    });
    setApercu({ url, titre: p.reunionTitre });
  };

  const fermerPdf = () => {
    if (apercu) URL.revokeObjectURL(apercu.url);
    setApercu(null);
  };

  if (apercu) {
    return (
      <div className="bg-[#0b1220] min-h-full flex flex-col">
        <TopBar title="PV scellé" onBack={fermerPdf} />
        <iframe
          title={apercu.titre}
          src={apercu.url}
          className="flex-1 w-full border-0 bg-white"
        />
      </div>
    );
  }

  return (
    <div className="bg-[#F8FAFC] min-h-full">
      <TopBar title="Procès-verbal" onBack={onBack} />
      <div className="px-5 py-4 space-y-3">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileSignature className="h-6 w-6 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-navy">Aucun PV signé</div>
            <div className="text-xs text-slate-500 max-w-[250px]">
              Un procès-verbal apparaît ici une fois que tous les membres ont donné leur accord et
              que le PCA l'a signé.
            </div>
          </div>
        ) : (
          rows.map((p) => (
            <button
              key={p.id}
              onClick={() => ouvrirPdf(p)}
              className="w-full text-left rounded-2xl bg-white border border-slate-100 p-4 shadow-sm active:scale-[0.98] transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-navy text-sm">{p.reunionTitre}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {p.date
                      ? new Date(p.date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                  <ShieldCheck className="h-2.5 w-2.5" />{" "}
                  {p.statut === "archive" ? "Archivé" : "Scellé"}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-[12px]">
                <Crown className="h-4 w-4 text-gold shrink-0" />
                <span className="text-slate-500">Signé par</span>
                <span className="font-semibold text-navy ml-auto">{p.scellePar ?? "—"}</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-navy">
                <FileText className="h-4 w-4 text-gold" /> Ouvrir le PV signé (PDF)
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
