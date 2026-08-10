import { ROLE_META, type Role } from "@/lib/app-store";
import { Sparkles } from "lucide-react";

export function PlaceholderRole({ role }: { role: Role }) {
  const m = ROLE_META[role];
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-10 text-center shadow-lg">
        <div
          className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${m.color} mx-auto flex items-center justify-center text-white font-bold text-xl`}
        >
          {m.short.slice(0, 2)}
        </div>
        <div className="mt-4 text-xs uppercase tracking-widest text-gold">Profil actif</div>
        <h1 className="mt-1 text-2xl font-bold text-navy">{m.label}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{m.description}</p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-gold/10 text-gold px-4 py-2 text-xs font-medium">
          <Sparkles className="h-4 w-4" />
          Interface en cours de construction — étape suivante du plan de livraison
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Utilisez le sélecteur de profil (bouton en bas à droite) pour changer instantanément
          d'interface.
        </p>
      </div>
    </div>
  );
}
