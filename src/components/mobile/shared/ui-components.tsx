// Primitives d'interface de l'app mobile, extraites de `admin-app.tsx`.
// Composants de présentation purs : aucun accès au store, tout arrive en props.
import * as React from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

export function TopBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 flex items-center gap-3">
      {onBack ? (
        <button onClick={onBack} className="text-navy">
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : (
        <div className="w-5" />
      )}
      <div className="flex-1 text-center font-semibold text-navy truncate px-1">{title}</div>
      <div className="min-w-5 shrink-0 flex justify-end">{right}</div>
    </div>
  );
}

/** Coin du viseur de scan QR (4 exemplaires pivotés). */
export function Corner({ className = "" }: { className?: string }) {
  return <div className={`absolute h-8 w-8 border-t-4 border-l-4 border-gold ${className}`} />;
}

export function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="bg-white/10 rounded-xl py-2">
      <div className="text-xl font-bold text-gold">{n}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{l}</div>
    </div>
  );
}

export function QuickAction({
  icon: Icon,
  label,
  onClick,
  accent,
  alerte,
  alerteTexte,
  fait,
  faitTexte,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  accent?: boolean;
  /** Attire l'œil : anneau doré + pastille rouge pulsée (ex. un PV attend ma signature). */
  alerte?: boolean;
  alerteTexte?: string;
  /** Action déjà accomplie : tuile verte, icône de validation, plus cliquable. */
  fait?: boolean;
  faitTexte?: string;
}) {
  return (
    <button
      onClick={fait ? undefined : onClick}
      disabled={fait}
      className={`relative rounded-2xl p-4 text-left transition ${fait ? "" : "active:scale-[0.97]"} ${
        fait
          ? "bg-emerald-50 border border-emerald-200"
          : accent
            ? "bg-gradient-to-br from-navy to-navy-light text-white"
            : alerte
              ? "bg-white border-2 border-gold ring-2 ring-gold/20"
              : "bg-white border border-slate-100"
      }`}
    >
      {alerte && (
        <span className="absolute right-3 top-3 flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
      )}
      {fait ? (
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      ) : (
        <Icon className={`h-6 w-6 ${accent ? "text-gold" : alerte ? "text-gold" : "text-navy"}`} />
      )}
      <div
        className={`mt-2 text-sm font-semibold ${fait ? "text-navy" : accent ? "text-white" : "text-navy"}`}
      >
        {label}
      </div>
      {fait && faitTexte && (
        <div className="mt-0.5 text-[11px] font-semibold text-emerald-700">{faitTexte}</div>
      )}
      {!fait && alerte && alerteTexte && (
        <div className="mt-0.5 text-[11px] font-semibold text-red-600">{alerteTexte}</div>
      )}
    </button>
  );
}

// NOTE : `ToolBtn` n'est rendue nulle part dans l'application (code mort repéré
// lors de l'extraction du 2026-08-10, conservée à l'identique pour ne rien
// changer au comportement). À supprimer si aucun usage n'est prévu.
export function ToolBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: any;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2.5 hover:bg-white/10 text-sm font-medium"
    >
      <Icon className="h-4 w-4 text-gold" /> {label}
    </button>
  );
}

// Ligne de progression du téléchargement hors-ligne du Board Book (écran de démo).
export function ProgressLine({
  done,
  active,
  label,
  pages,
}: {
  done: boolean;
  active: boolean;
  label: string;
  pages: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="shrink-0">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : active ? (
          <Loader2 className="h-4 w-4 animate-spin text-gold" />
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-slate-300 mx-1" />
        )}
      </span>
      <span
        className={`flex-1 truncate ${done ? "text-navy" : active ? "text-navy font-medium" : "text-slate-400"}`}
      >
        {label}
      </span>
      <span className="text-[11px] text-slate-400 shrink-0">{pages}</span>
    </div>
  );
}
