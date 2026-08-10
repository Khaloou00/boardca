import { useBoardStore } from "@/store/useBoardStore";
import { MeetingCalendar } from "@/components/calendar/meeting-calendar";

// Vue transversale : toutes les séances du Conseil, indépendamment de la réunion
// active. Cliquer une séance la sélectionne et ouvre sa fiche.
export function CalendarPanel({ onOpenMeeting }: { onOpenMeeting: (id: string) => void }) {
  const reunions = useBoardStore((s) => s.reunions);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-gold">Secrétariat CA</div>
        <h1 className="text-3xl font-bold text-navy mt-1">Mon Calendrier</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toutes les séances du Conseil. Cliquez une date pour filtrer, une séance pour l'ouvrir.
        </p>
      </div>

      <MeetingCalendar reunions={reunions} onOpen={(r) => onOpenMeeting(r.id)} />
    </div>
  );
}
