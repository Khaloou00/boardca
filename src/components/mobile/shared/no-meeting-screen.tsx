// Écran de repli quand aucune séance n'est disponible. Extrait de `admin-app.tsx`.
import { Calendar } from "lucide-react";
import { TopBar } from "./ui-components";

// Ces écrans mobiles lisent encore la réunion de l'ancien store mémoire (vidé) :
// sans séance, ils déréférençaient `meeting.title` et faisaient planter le rendu.
export function NoMeetingScreen({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="bg-[#F8FAFC] min-h-full">
      <TopBar title={title} onBack={onBack} />
      <div className="px-6 py-20 flex flex-col items-center text-center gap-3">
        <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Calendar className="h-6 w-6 text-slate-400" />
        </div>
        <div className="text-sm font-semibold text-navy">Aucune séance disponible</div>
        <div className="text-xs text-slate-500 max-w-[240px]">
          Le Secrétariat n'a pas encore créé de réunion.
        </div>
      </div>
    </div>
  );
}
