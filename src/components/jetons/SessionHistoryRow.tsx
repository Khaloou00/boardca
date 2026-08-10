import { CheckCircle2, Clock } from "lucide-react";
import type { PointSerieJeton, ModeJeton } from "@/types/jetons";
import { formatFCFA } from "@/lib/utils";

const MODE_LABEL: Record<ModeJeton, string> = {
  presentiel: "Présentiel",
  distance: "À distance",
  procuration: "Procuration",
  absent: "Absent",
};

// Point de couleur du mode.
const MODE_DOT: Record<ModeJeton, string> = {
  presentiel: "bg-[#16C784]",
  distance: "bg-sky-400",
  procuration: "bg-amber-400",
  absent: "bg-slate-500",
};

export function SessionHistoryRow({ p }: { p: PointSerieJeton }) {
  const zero = p.montant === 0;
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium text-white">
            {new Date(p.date).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span
            className={`font-mono tabular-nums text-[14px] shrink-0 ${zero ? "text-slate-500" : "text-[#16C784]"}`}
          >
            {zero ? "" : "+"}
            {formatFCFA(p.montant)}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 truncate mt-0.5">{p.titre}</div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1 text-slate-300">
            <span className={`h-2 w-2 rounded-full ${MODE_DOT[p.mode]}`} /> {MODE_LABEL[p.mode]}
          </span>
          {p.mode !== "absent" &&
            (p.paye ? (
              <span className="inline-flex items-center gap-1 text-[#16C784]">
                <CheckCircle2 className="h-3 w-3" /> Payé
              </span>
            ) : (
              // Le jeton existe dès la clôture, mais il n'est dû qu'après validation du
              // secrétariat : « en attente » dit l'état réel, « non payé » sonnait comme un refus.
              <span className="inline-flex items-center gap-1 text-[#F5A623]">
                <Clock className="h-3 w-3" /> Paiement en attente
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
