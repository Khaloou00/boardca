import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import type { Reunion } from "@/types/domain";
import { datePartsFr, dateFr as frDate, typeMeta, statutMeta } from "@/lib/reunion-visuals";
import {
  CalendarClock,
  Archive,
  CalendarDays,
  Clock,
  MapPin,
  Video,
  ListChecks,
  ArrowLeft,
  ArrowRight,
  Search,
} from "lucide-react";

type TabKey = "live" | "archived";

/**
 * Navigation à deux niveaux commune aux sections scopées à une réunion.
 *
 * Niveau 1 — la grille : les réunions « En cours » (planifiée/en cours) ou
 * « Archives » (terminée). Aucun détail de la section n'est affiché ici.
 * Niveau 2 — la réunion ouverte : le panneau de la section (KPI, informations,
 * actions du secrétariat) rendu via `children(reunionId)`.
 *
 * Ouvrir une réunion la pose aussi comme réunion active du store : le bootstrap
 * recharge documents/convocations/présences/votes/PV pour cet identifiant, dont
 * les panneaux dépendent encore.
 */
export function SectionBrowser({
  title,
  subtitle,
  autoOpenId = null,
  estArchive,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Réunion à ouvrir d'emblée (clic depuis le tableau de bord ou le calendrier). */
  autoOpenId?: string | null;
  /** Règle de classement "En cours"/"Archives" propre à la section (par défaut :
   * `statut === 'terminee'`). Le Procès-verbal l'utilise pour rester "En cours"
   * tant que le PV n'est pas scellé, même une fois la séance terminée. */
  estArchive?: (r: Reunion) => boolean;
  children: (reunionId: string) => ReactNode;
}) {
  const { reunions, reunionsLoading } = useBoardStore(
    useShallow((s) => ({ reunions: s.reunions, reunionsLoading: s.reunionsLoading })),
  );
  const setReunionActive = useBoardStore((s) => s.setReunionActive);

  const [tab, setTab] = useState<TabKey>("live");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  const estReunionArchivee = (r: Reunion): boolean =>
    estArchive ? estArchive(r) : r.statut === "terminee";
  const dansPerimetre = (r: Reunion, t: TabKey) =>
    t === "archived" ? estReunionArchivee(r) : !estReunionArchivee(r);

  // Ouverture directe demandée par l'appelant : on se place aussi sur l'onglet du
  // périmètre de la réunion, sinon le retour à la grille l'afficherait vide.
  useEffect(() => {
    if (!autoOpenId) return;
    const r = reunions.find((x) => x.id === autoOpenId);
    if (!r) return;
    setTab(estReunionArchivee(r) ? "archived" : "live");
    setOuverte(autoOpenId);
    setReunionActive(autoOpenId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- estArchive est une closure recréée à chaque rendu côté appelant
  }, [autoOpenId, reunions, setReunionActive]);

  const compte = useMemo(
    () => ({
      live: reunions.filter((r) => dansPerimetre(r, "live")).length,
      archived: reunions.filter((r) => dansPerimetre(r, "archived")).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- estArchive est une closure recréée à chaque rendu côté appelant
    [reunions],
  );

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return [...reunions]
      .filter((r) => dansPerimetre(r, tab))
      .filter(
        (r) =>
          !q ||
          r.titre.toLowerCase().includes(q) ||
          (r.lieu ?? "").toLowerCase().includes(q) ||
          frDate(r.date).toLowerCase().includes(q),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- estArchive est une closure recréée à chaque rendu côté appelant
  }, [reunions, tab, recherche]);

  const reunionOuverte = reunions.find((r) => r.id === ouverte) ?? null;

  // La réunion ouverte peut être supprimée ailleurs : on ne garde jamais un panneau
  // accroché à une réunion fantôme.
  useEffect(() => {
    if (ouverte && !reunions.some((r) => r.id === ouverte)) setOuverte(null);
  }, [ouverte, reunions]);

  const ouvrir = (id: string) => {
    setReunionActive(id);
    setOuverte(id);
  };

  // ─── Niveau 2 : la réunion ouverte ───────────────────────────────
  if (reunionOuverte) {
    const ty = typeMeta(reunionOuverte.type);
    const st = statutMeta(reunionOuverte.statut);
    return (
      <div>
        <div className="sticky top-0 z-20 -mx-8 mb-6 border-b border-border/70 bg-background/85 px-8 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              onClick={() => setOuverte(null)}
              className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition hover:border-gold/50 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              Réunions
            </button>

            <span className="h-5 w-px bg-border" aria-hidden="true" />

            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: ty.couleur }}
              aria-hidden="true"
            />
            <span className="font-semibold text-navy truncate max-w-[42ch]">
              {reunionOuverte.titre}
            </span>

            <span
              className={`text-[12px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${ty.chip}`}
            >
              {ty.label}
            </span>
            {st && (
              <span
                className={`text-[12px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${st.chip}`}
              >
                {st.label}
              </span>
            )}

            <span className="ml-auto hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> {frDate(reunionOuverte.date)}
                {reunionOuverte.heure ? ` · ${reunionOuverte.heure}` : ""}
              </span>
              {reunionOuverte.lieu && (
                <span className="inline-flex max-w-[28ch] items-center gap-1.5 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {reunionOuverte.lieu}
                </span>
              )}
              {reunionOuverte.lienVisio && (
                <a
                  href={reunionOuverte.lienVisio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded text-navy underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <Video className="h-3.5 w-3.5 shrink-0" /> Rejoindre en visio
                </a>
              )}
            </span>
          </div>
        </div>

        <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          {children(reunionOuverte.id)}
        </div>
      </div>
    );
  }

  // ─── Niveau 1 : la grille des réunions ───────────────────────────
  const TABS: { key: TabKey; label: string; icon: typeof CalendarClock; n: number }[] = [
    { key: "live", label: "En cours", icon: CalendarClock, n: compte.live },
    { key: "archived", label: "Archives", icon: Archive, n: compte.archived },
  ];

  return (
    <div className="animate-in fade-in-0 duration-300">
      <div className="relative overflow-hidden rounded-3xl border border-navy/10 bg-gradient-to-br from-navy via-navy to-navy-light px-8 py-7 text-white shadow-lg">
        {/* Halo doré décoratif — purement esthétique, hors flux et non lisible par les AT. */}
        <div
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-gold/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="text-[12px] font-semibold uppercase tracking-[0.25em] text-gold">
            Espace Secrétariat
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm text-white/70">{subtitle}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label={`Vue ${title}`}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/50 p-1"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                  active
                    ? "bg-navy text-white shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-navy"
                }`}
              >
                <t.icon className={`h-4 w-4 ${active ? "text-gold" : ""}`} aria-hidden="true" />
                {t.label}
                <span
                  className={`rounded-full px-1.5 py-px text-[12px] font-bold tabular-nums ${
                    active ? "bg-white/15 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.n}
                </span>
              </button>
            );
          })}
        </div>

        {(compte.live > 0 || compte.archived > 0) && (
          <div className="relative ml-auto w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une réunion…"
              aria-label="Rechercher une réunion"
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-navy placeholder:text-muted-foreground focus:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/25"
            />
          </div>
        )}
      </div>

      {reunionsLoading && reunions.length === 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : liste.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <CalendarDays className="h-6 w-6 text-slate-400" />
          </div>
          <div className="mt-4 text-sm font-semibold text-navy">
            {recherche.trim()
              ? "Aucune réunion ne correspond à votre recherche"
              : tab === "archived"
                ? "Aucune réunion archivée"
                : "Aucune réunion en cours"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {recherche.trim()
              ? "Essayez un autre titre, un lieu ou une date."
              : tab === "archived"
                ? "Les séances clôturées apparaîtront ici."
                : "Créez une réunion depuis « Créer une réunion »."}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {liste.map((r) => {
            const ty = typeMeta(r.type);
            const st = statutMeta(r.statut);
            const p = datePartsFr(r.date);
            return (
              <button
                key={r.id}
                onClick={() => ouvrir(r.id)}
                aria-label={`Ouvrir ${r.titre}`}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${ty.halo}`}
              >
                {/* Filet de couleur du type, sur toute la hauteur de la carte. */}
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: ty.couleur }}
                  aria-hidden="true"
                />

                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${ty.tuile}`}
                  >
                    <span className="text-lg font-bold leading-none tabular-nums">{p.jour}</span>
                    <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-90">
                      {p.mois}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ${ty.chip}`}
                      >
                        {ty.label}
                      </span>
                      {st && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wider ${st.chip}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${st.pastille}`}
                            aria-hidden="true"
                          />
                          {st.label}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 line-clamp-2 font-bold leading-snug text-navy transition-colors group-hover:text-navy-light">
                      {r.titre}
                    </h2>
                  </div>
                </div>

                <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <dt className="sr-only">Horaire</dt>
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <dd>{r.heure ? `${r.heure}` : "Heure à définir"}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="sr-only">Lieu</dt>
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <dd className="truncate">{r.lieu ?? "Lieu à définir"}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="sr-only">Ordre du jour</dt>
                    <ListChecks className="h-3.5 w-3.5 shrink-0" />
                    <dd>{r.ordreDuJour.length} point(s) à l'ordre du jour</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold text-navy">
                  Ouvrir {title.toLowerCase()}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all group-hover:bg-navy group-hover:text-gold">
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
