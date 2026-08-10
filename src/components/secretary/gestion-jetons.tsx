import { useState } from "react";
import { JetonsGouvernanceSection } from "@/components/kpis-gouvernance/JetonsGouvernanceSection";
import { GouvernancePanel } from "./gouvernance-panel";

const ANNEES = [2026, 2025, 2024];

// Page unique « Gestion des jetons » : une vue d'ensemble annuelle (distribution,
// assiduité, classement, actions) puis le barème et la validation des paiements.
// Un seul en-tête, un seul sélecteur d'année, un seul langage visuel — les chiffres
// et séries autrefois répétés entre les deux anciens onglets sont fusionnés.
export function GestionJetons() {
  const [annee, setAnnee] = useState(ANNEES[0]);

  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Gestion des jetons</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Assiduité et jetons de présence du Conseil : suivez la distribution de l'exercice, fixez
            le barème et validez les paiements dus aux administrateurs.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Exercice"
          className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
        >
          {ANNEES.map((a) => (
            <button
              key={a}
              role="tab"
              aria-selected={annee === a}
              onClick={() => setAnnee(a)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                annee === a ? "bg-navy text-white" : "text-muted-foreground hover:text-navy"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </header>

      <JetonsGouvernanceSection annee={annee} />

      <div className="border-t border-border" />

      <GouvernancePanel />
    </div>
  );
}
