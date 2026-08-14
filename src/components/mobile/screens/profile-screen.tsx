// ProfileScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { TopBar } from "../shared/ui-components";
import { PermissionsPanel } from "@/components/permissions-panel";
import { type Consultation } from "@/lib/consultations";
import { type PV } from "@/types/domain";
import { Bell, Calendar, CalendarDays, ChevronRight, Coins, Crown, Download, FileSignature, Fingerprint, ListChecks, LogOut, MailCheck, Send, Shield } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
export function ProfileScreen({ nav }: { nav: (v: View) => void }) {
  const {
    actionsEnRetardGlobal,
    consultations,
    consultationsATraiter,
    currentUser,
    downloaded,
    isPCA,
    profile,
  } = useMobileSession();

  const rows = [
    {
      icon: Download,
      label: "Documents hors-ligne",
      value: downloaded ? "Board Book · 5,8 MB" : "Aucun",
    },
  ];
  return (
    <div>
      <TopBar title="Profil" />
      <div className="px-5 py-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 text-center">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gold to-yellow-600 text-white mx-auto flex items-center justify-center text-2xl font-bold">
            {currentUser?.avatar}
          </div>
          <div className="mt-3 font-bold text-navy">{currentUser?.name}</div>
          <div className="text-xs text-slate-500">{currentUser?.email}</div>
          <div className="mt-2 inline-block text-[10px] uppercase tracking-widest bg-gold/20 text-gold px-2 py-1 rounded-full font-semibold">
            Membre du CA · Comité {currentUser?.committee}
          </div>
        </div>

        {isPCA && (
          <button
            onClick={() => nav({ tab: "home", sub: "pca-hub" })}
            className="mt-4 w-full text-left rounded-2xl bg-gradient-to-br from-navy to-navy-light text-white p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">Espace PCA</div>
              <div className="text-[11px] text-white/70 mt-0.5">
                Discussions, présidence de séance, sceau du PV
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/50 shrink-0" />
          </button>
        )}

        <button
          onClick={() => nav({ tab: "profile", sub: "jetons" })}
          className="mt-4 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-[#16C784]/10 border border-[#16C784]/30 flex items-center justify-center shrink-0">
            <Coins className="h-5 w-5 text-[#16C784]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-navy">Mes jetons de présence</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Historique, cumul et paiements de vos séances
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
        </button>

        <button
          onClick={() => nav({ tab: "profile", sub: "consultations" })}
          className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <MailCheck className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-navy">Consultation écrite</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {consultationsATraiter > 0
                ? `${consultationsATraiter} décision${consultationsATraiter > 1 ? "s" : ""} en attente de votre voix`
                : "Les décisions du Conseil hors séance"}
            </div>
          </div>
          {consultationsATraiter > 0 && (
            <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {consultationsATraiter}
            </span>
          )}
          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
        </button>

        <button
          onClick={() => nav({ tab: "profile", sub: "actions" })}
          className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
            <ListChecks className="h-5 w-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-navy">Suivi des actions</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {actionsEnRetardGlobal > 0
                ? `${actionsEnRetardGlobal} action${actionsEnRetardGlobal > 1 ? "s" : ""} en retard à surveiller`
                : "Avancement des actions confiées aux responsables"}
            </div>
          </div>
          {actionsEnRetardGlobal > 0 && (
            <span className="h-5 min-w-[20px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {actionsEnRetardGlobal}
            </span>
          )}
          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
        </button>

        <button
          onClick={() => nav({ tab: "profile", sub: "pv-archives" })}
          className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
            <FileSignature className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-navy">Procès-verbal</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Les PV signés en définitive par le PCA
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
        </button>

        <button
          onClick={() => nav({ tab: "profile", sub: "convocations" })}
          className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Send className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-navy">Mes convocations</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Vos réponses aux convocations du Conseil
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
        </button>

        <button
          onClick={() => nav({ tab: "profile", sub: "calendrier" })}
          className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5 text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-navy">Mon Calendrier</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Les séances du Conseil mois par mois
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
        </button>

        <button
          onClick={() => nav({ tab: "profile", sub: "seances" })}
          className="mt-3 w-full text-left rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 active:scale-[0.98] transition shadow-sm"
        >
          <div className="h-10 w-10 rounded-xl bg-navy/10 border border-navy/20 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5 text-navy" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-navy">Séance Conseil administratif</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Toutes les séances du Conseil et leur statut
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
        </button>

        {/* Réglage des notifications : l'autorisation ne peut être demandée que
            sur un geste explicite de l'utilisateur, donc depuis un écran comme
            celui-ci — jamais au chargement de l'application. */}
        <div className="mt-4">
          <PermissionsPanel />
        </div>

        <div className="mt-4 bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {rows.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <div className="h-8 w-8 rounded-lg bg-navy/5 text-navy flex items-center justify-center">
                <r.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 text-sm text-navy">{r.label}</div>
              <div className="text-xs text-emerald-600 font-semibold">{r.value}</div>
            </div>
          ))}
        </div>
        <button className="mt-5 w-full bg-white border border-red-200 text-red-600 rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2">
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
