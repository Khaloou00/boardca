import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, CalendarDays } from "lucide-react";
import type { Reunion } from "@/types/domain";
import { typeMeta } from "@/lib/reunion-visuals";

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
// Grille lundi → dimanche (convention FR), contrairement à Date.getDay() qui part du dimanche.
const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

const STATUT: Record<Reunion["statut"], { label: string; pastille: string; chip: string }> = {
  planifiee: { label: "Planifiée", pastille: "bg-sky-500", chip: "bg-sky-100 text-sky-700" },
  en_cours: { label: "En cours", pastille: "bg-amber-500", chip: "bg-amber-100 text-amber-700" },
  terminee: {
    label: "Terminée",
    pastille: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-700",
  },
};

// Le code couleur des types vient de `@/lib/reunion-visuals` — même source que le
// tableau de bord et les grilles du secrétariat : or brillant pour l'extraordinaire,
// vert brillant pour l'ordinaire. La case du jour est peinte entière (`couleur`) ;
// le statut ne colore plus que sa propre puce.

// Clé "YYYY-MM-DD" construite depuis les composantes locales : `Reunion.date` est
// déjà stockée sous cette forme, donc on ne passe jamais par un objet Date (et on
// évite le décalage UTC qui ferait glisser une séance d'un jour).
const cleJour = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const aujourdhui = () => new Date().toLocaleDateString("en-CA");

export function MeetingCalendar({
  reunions,
  onOpen,
  compact = false,
}: {
  reunions: Reunion[];
  onOpen?: (r: Reunion) => void;
  compact?: boolean;
}) {
  const today = aujourdhui();
  const [annee, setAnnee] = useState(() => new Date().getFullYear());
  const [mois, setMois] = useState(() => new Date().getMonth());
  const [jourSelectionne, setJourSelectionne] = useState<string | null>(null);

  // Le calendrier ne montre que les séances du CA : les comités en sont exclus.
  const seances = useMemo(() => reunions.filter((r) => r.type !== "comite"), [reunions]);

  const parJour = useMemo(() => {
    const map = new Map<string, Reunion[]>();
    for (const r of seances) map.set(r.date, [...(map.get(r.date) ?? []), r]);
    for (const [, liste] of map) liste.sort((a, b) => (a.heure ?? "").localeCompare(b.heure ?? ""));
    return map;
  }, [seances]);

  // `new Date(annee, mois, 0).getDate()` → nombre de jours du mois précédent ;
  // avec mois+1 on obtient le nombre de jours du mois courant.
  const nbJours = new Date(annee, mois + 1, 0).getDate();
  // getDay() : 0 = dimanche. On décale pour que lundi = 0.
  const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7;

  const moisSuivant = () => {
    setJourSelectionne(null);
    if (mois === 11) {
      setMois(0);
      setAnnee(annee + 1);
    } else setMois(mois + 1);
  };
  const moisPrecedent = () => {
    setJourSelectionne(null);
    if (mois === 0) {
      setMois(11);
      setAnnee(annee - 1);
    } else setMois(mois - 1);
  };
  const revenirAujourdhui = () => {
    const d = new Date();
    setAnnee(d.getFullYear());
    setMois(d.getMonth());
    setJourSelectionne(today);
  };

  // Agenda affiché sous la grille : le jour sélectionné, sinon tout le mois.
  const prefixeMois = `${annee}-${String(mois + 1).padStart(2, "0")}`;
  const agenda = useMemo(() => {
    if (jourSelectionne) return parJour.get(jourSelectionne) ?? [];
    return seances
      .filter((r) => r.date.startsWith(prefixeMois))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.heure ?? "").localeCompare(b.heure ?? ""));
  }, [jourSelectionne, parJour, seances, prefixeMois]);

  const cellule = compact ? "h-9 text-[12px]" : "h-12 text-sm";

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* Grille du mois */}
      <div
        className={`rounded-2xl border border-border bg-white ${compact ? "p-3" : "p-5"} border-slate-100`}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={moisPrecedent}
            aria-label="Mois précédent"
            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-navy hover:border-gold transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <div className={`font-bold text-navy ${compact ? "text-sm" : "text-lg"}`}>
              {MOIS[mois]} {annee}
            </div>
            <button
              onClick={revenirAujourdhui}
              className="text-[10px] uppercase tracking-wider text-gold font-semibold hover:underline"
            >
              Aujourd'hui
            </button>
          </div>
          <button
            onClick={moisSuivant}
            aria-label="Mois suivant"
            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-navy hover:border-gold transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {JOURS.map((j, i) => (
            <div
              key={i}
              className="text-center text-[10px] uppercase tracking-wider font-semibold text-muted-foreground pb-1"
            >
              {j}
            </div>
          ))}
          {Array.from({ length: decalage }).map((_, i) => (
            <div key={`vide-${i}`} />
          ))}
          {Array.from({ length: nbJours }).map((_, i) => {
            const jour = i + 1;
            const cle = cleJour(annee, mois, jour);
            const duJour = parJour.get(cle) ?? [];
            const estAujourdhui = cle === today;
            const estSelectionne = cle === jourSelectionne;
            // Un jour peut porter les deux types : la case est alors coupée en deux
            // bandes (dégradé à arrêts nets) plutôt que d'en privilégier une.
            const couleurs = [...new Set(duJour.map((r) => typeMeta(r.type).couleur))];
            const remplissage = couleurs.length
              ? couleurs.length === 1
                ? couleurs[0]
                : `linear-gradient(135deg, ${couleurs[0]} 50%, ${couleurs[1]} 50%)`
              : undefined;
            return (
              <button
                key={cle}
                onClick={() => setJourSelectionne(estSelectionne ? null : cle)}
                aria-label={`${jour} ${MOIS[mois]} ${annee}${duJour.length ? ` — ${duJour.length} séance(s)` : ""}`}
                aria-pressed={estSelectionne}
                style={
                  remplissage && !estSelectionne
                    ? {
                        background: remplissage,
                        color: couleurs.length === 1 ? typeMeta(duJour[0].type).texte : "#0F172A",
                      }
                    : undefined
                }
                className={`${cellule} rounded-lg flex items-center justify-center border transition ${
                  estSelectionne
                    ? "bg-navy text-white border-navy"
                    : remplissage
                      ? `font-bold shadow-sm hover:brightness-105 ${estAujourdhui ? "border-navy" : "border-transparent"}`
                      : estAujourdhui
                        ? "border-gold text-navy font-bold"
                        : "border-transparent text-navy hover:border-border"
                }`}
              >
                {jour}
              </button>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#00C853]" /> Ordinaire
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#FFC300]" /> Extraordinaire
          </span>
        </div>
      </div>

      {/* Agenda : jour sélectionné, sinon le mois entier */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            {jourSelectionne
              ? new Date(`${jourSelectionne}T12:00:00`).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : `Séances de ${MOIS[mois].toLowerCase()}`}
          </div>
          {jourSelectionne && (
            <button
              onClick={() => setJourSelectionne(null)}
              className="text-[11px] text-gold font-semibold hover:underline"
            >
              Voir tout le mois
            </button>
          )}
        </div>

        {agenda.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white px-4 py-8 text-center">
            <CalendarDays className="h-6 w-6 text-slate-300 mx-auto" />
            <div className="mt-2 text-[13px] text-muted-foreground">
              {jourSelectionne ? "Aucune séance ce jour-là." : "Aucune séance ce mois-ci."}
            </div>
          </div>
        ) : (
          agenda.map((r) => {
            const st = STATUT[r.statut];
            const ty = typeMeta(r.type);
            const d = new Date(`${r.date}T12:00:00`);
            const contenu = (
              <>
                <div className="rounded-xl bg-navy text-gold px-3 py-2 text-center min-w-[58px] h-fit shrink-0">
                  <div className="text-[9px] uppercase">
                    {d.toLocaleDateString("fr-FR", { month: "short" })}
                  </div>
                  <div className="text-xl font-bold leading-none">{d.getDate()}</div>
                  <div className="text-[9px] mt-0.5">{r.heure ?? ""}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-navy text-sm truncate">{r.titre}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{r.lieu ?? "Lieu à définir"}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${ty.chip}`}
                    >
                      {ty.label}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${st.chip}`}
                    >
                      {st.label}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {r.ordreDuJour.length} point(s)
                    </span>
                  </div>
                </div>
              </>
            );
            const classe = `w-full text-left rounded-2xl bg-white border border-slate-100 ${ty.bordure} p-4 shadow-sm flex gap-3`;
            return onOpen ? (
              <button
                key={r.id}
                onClick={() => onOpen(r)}
                className={`${classe} hover:border-gold hover:shadow-md transition active:scale-[0.99]`}
              >
                {contenu}
              </button>
            ) : (
              <div key={r.id} className={classe}>
                {contenu}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
