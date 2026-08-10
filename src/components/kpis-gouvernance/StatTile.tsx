import { useEffect, useState, type ReactNode } from "react";

// Compte de 0 jusqu'à `cible` en douceur (amorti en fin de course). Respecte
// `prefers-reduced-motion` : dans ce cas, la valeur s'affiche directement — une
// animation n'est jamais une raison de retarder une information.
export function useCompteur(cible: number, duree = 900) {
  const [valeur, setValeur] = useState(0);

  useEffect(() => {
    const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduit || cible === 0) {
      setValeur(cible);
      return;
    }
    let frame = 0;
    const depart = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - depart) / duree);
      // easeOutCubic : le chiffre arrive vite puis se pose, au lieu de s'arrêter net.
      setValeur(Math.round(cible * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cible, duree]);

  return valeur;
}

// Bande de tuiles : un seul bloc, séparé par des filets plutôt que par des cartes
// détachées. C'est le langage visuel commun à toute la page « Gestion des jetons ».
export function StatStrip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={`grid gap-px overflow-hidden rounded-xl border border-border bg-border ${className}`}
    >
      {children}
    </dl>
  );
}

// Couleur de contexte de la tuile : fond teinté, filet latéral, chiffre et jauge.
export type StatTon = "navy" | "gold" | "emerald" | "sky" | "rose";
const TONS: Record<StatTon, { carte: string; barre: string; valeur: string; jauge: string }> = {
  navy: { carte: "bg-navy/[0.04]", barre: "bg-navy", valeur: "text-navy", jauge: "bg-navy" },
  gold: { carte: "bg-gold/10", barre: "bg-gold", valeur: "text-[#8A6A00]", jauge: "bg-gold" },
  emerald: {
    carte: "bg-emerald-50",
    barre: "bg-emerald-500",
    valeur: "text-emerald-700",
    jauge: "bg-emerald-500",
  },
  sky: { carte: "bg-sky-50", barre: "bg-sky-500", valeur: "text-sky-700", jauge: "bg-sky-500" },
  rose: {
    carte: "bg-rose-50",
    barre: "bg-rose-500",
    valeur: "text-rose-700",
    jauge: "bg-rose-500",
  },
};

// Une tuile. `ton` donne la couleur de contexte ; `accent` (déprécié, conservé pour
// compat) équivaut à `ton="gold"`. `jauge` (0–100) remplit une barre fine sous la
// valeur, `rang` cadence l'apparition en cascade, le compteur anime la montée du chiffre.
export function StatTile({
  rang,
  label,
  valeur,
  format = (n) => String(n),
  detail,
  accent = false,
  ton,
  jauge,
}: {
  rang: number;
  label: string;
  valeur: number;
  format?: (n: number) => string;
  detail?: string;
  accent?: boolean;
  ton?: StatTon;
  jauge?: number;
}) {
  const affiche = useCompteur(valeur);
  const [remplie, setRemplie] = useState(false);
  const t = TONS[ton ?? (accent ? "gold" : "navy")];

  useEffect(() => {
    const timer = setTimeout(() => setRemplie(true), 80 + rang * 90);
    return () => clearTimeout(timer);
  }, [rang]);

  return (
    <div
      className={`group relative animate-in overflow-hidden p-5 fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500 ${t.carte}`}
      style={{ animationDelay: `${rang * 90}ms` }}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${t.barre}`} />
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums transition-transform duration-300 group-hover:translate-x-0.5 ${t.valeur}`}
      >
        {format(affiche)}
      </dd>
      {jauge !== undefined && (
        <dd className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/60" aria-hidden="true">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${t.jauge}`}
            style={{ width: remplie ? `${Math.min(100, Math.max(0, jauge))}%` : "0%" }}
          />
        </dd>
      )}
      {detail && <dd className="mt-2 text-[11px] leading-snug text-muted-foreground">{detail}</dd>}
    </div>
  );
}
