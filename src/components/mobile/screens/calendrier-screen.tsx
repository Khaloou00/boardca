// Calendrier personnel du membre. Extrait de `admin-app.tsx` : composant de
// premier niveau, il ne se remonte plus à chaque mise à jour du parent.
import { useBoardStore } from "@/store/useBoardStore";
import { MeetingCalendar } from "@/components/calendar/meeting-calendar";
import { TopBar } from "../shared/ui-components";
import type { Nav } from "../shared/view-state";

export function CalendrierScreen({ nav }: { nav: Nav }) {
  const realReunions = useBoardStore((s) => s.reunions);
  return (
    <div className="bg-[#F8FAFC] min-h-full">
      <TopBar title="Mon Calendrier" onBack={() => nav({ tab: "profile" })} />
      <div className="px-4 py-4">
        <MeetingCalendar
          reunions={realReunions}
          compact
          onOpen={(r) => nav({ tab: "home", sub: "meeting", data: { reunionId: r.id } })}
        />
      </div>
    </div>
  );
}
