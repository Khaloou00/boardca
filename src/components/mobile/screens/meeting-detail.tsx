// MeetingDetail — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState, useEffect } from "react";
import { TopBar } from "../shared/ui-components";
import { supabase } from "@/lib/supabase";
import { BookOpen, Calendar, CheckCircle2, ChevronRight, Crown, MapPin, QrCode, Users } from "lucide-react";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
import type { Reunion } from "@/types/domain";
export function MeetingDetail({ reunion, nav }: { reunion: Reunion; nav: (v: View) => void }) {
  const {
    convocationReunionId,
    currentPCA,
    isGuest,
    mandantPour,
    mesDelegations,
    profile,
    realPresences,
    realUsersById,
  } = useMobileSession();

  const typeLabel =
    reunion.type === "ca_extraordinaire"
      ? "CA Extraordinaire"
      : reunion.type === "comite"
        ? "Comité"
        : "CA Ordinaire";
  const dateLabel = new Date(reunion.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const oj = [...reunion.ordreDuJour].sort((a, b) => a.position - b.position);
  const enCours = reunion.statut === "en_cours";

  // Le détail doit valoir pour N'IMPORTE QUELLE séance ouverte depuis l'Accueil,
  // pas seulement celle que le store a préchargée (`convocationReunionId`).
  const [convocs, setConvocs] = useState<{ userId: string; statut: string }[]>([]);
  const [recueil, setRecueil] = useState<{ pages: number | null; pret: boolean } | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    Promise.all([
      supabase.from("convocations").select("user_id, statut").eq("reunion_id", reunion.id),
      supabase
        .from("board_books")
        .select("pages, storage_path")
        .eq("reunion_id", reunion.id)
        .maybeSingle(),
    ]).then(([convRes, bbRes]) => {
      if (annule) return;
      setConvocs(
        ((convRes.data ?? []) as any[]).map((c) => ({ userId: c.user_id, statut: c.statut })),
      );
      const b = bbRes.data as any;
      setRecueil(b ? { pages: b.pages, pret: !!b.storage_path } : null);
      setChargement(false);
    });
    return () => {
      annule = true;
    };
  }, [reunion.id]);

  const confirmes = convocs.filter((c) => c.statut === "confirmed");
  const excuses = convocs.filter((c) => c.statut === "excused");
  const enAttente = convocs.filter((c) => c.statut !== "confirmed" && c.statut !== "excused");

  // Président effectif : le titulaire, sauf s'il s'est excusé et a délégué.
  const delegue = reunion.presidentSeanceId
    ? realUsersById[reunion.presidentSeanceId]
    : undefined;
  const pcaExcuse = currentPCA
    ? convocs.find((c) => c.userId === currentPCA.id)?.statut === "excused"
    : false;
  const president = pcaExcuse && delegue ? delegue : currentPCA;

  const STATUT_SEANCE: Record<string, { label: string; cls: string }> = {
    planifiee: { label: "À venir", cls: "bg-sky-100 text-sky-700" },
    en_cours: { label: "En cours", cls: "bg-amber-100 text-amber-700" },
    terminee: { label: "Terminée", cls: "bg-slate-100 text-slate-600" },
  };
  const st = STATUT_SEANCE[reunion.statut] ?? { label: reunion.statut, cls: "bg-slate-100" };

  return (
    <div className="bg-[#F8FAFC] min-h-full">
      <TopBar title="Détail de la séance" onBack={() => nav({ tab: "home" })} />
      <div className="px-5 py-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-wider text-gold font-bold">
              {typeLabel}
            </div>
            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${st.cls}`}>
              {st.label}
            </span>
          </div>
          <div className="text-navy font-bold mt-0.5">{reunion.titre}</div>
          <div className="mt-2 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {dateLabel}
              {reunion.heure ? ` · ${reunion.heure}` : ""}
            </div>
            {reunion.lieu && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {reunion.lieu}
              </div>
            )}
            {convocs.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {convocs.length} convoqué
                {convocs.length > 1 ? "s" : ""} · quorum requis {reunion.quorumRequis}
              </div>
            )}
            {president && (
              <div className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-gold" />
                {president === delegue
                  ? `Présidée par ${president.nom} (délégation)`
                  : `Présidée par ${president.nom}`}
              </div>
            )}
          </div>
        </div>

        {/* Réponses aux convocations : qui sera là. */}
        {!chargement && convocs.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {[
              { v: confirmes.length, l: "Confirmés", c: "bg-emerald-500" },
              { v: excuses.length, l: "Excusés", c: "bg-rose-500" },
              { v: enAttente.length, l: "Sans réponse", c: "bg-slate-400" },
            ].map((t) => (
              <div
                key={t.l}
                className={`rounded-2xl p-3 text-center text-white shadow-sm ${t.c}`}
              >
                <div className="text-2xl font-bold leading-none">{t.v}</div>
                <div className="text-[10px] opacity-85 mt-1.5">{t.l}</div>
              </div>
            ))}
          </div>
        )}

        {enCours &&
          (() => {
            // Même vérité serveur que sur l'Accueil (voir plus haut) : ne pas
            // réafficher un bouton de scan une fois la présence déjà enregistrée,
            // y compris quand c'est un mandataire qui a scanné à ma place.
            const idPresenceCible = isGuest ? mandantPour(reunion.id) : profile?.id;
            const presenceEnregistree =
              !!idPresenceCible &&
              realPresences.some(
                (p) => p.reunionId === reunion.id && p.userId === idPresenceCible,
              );
            const presenceDeleguee =
              !isGuest && mesDelegations.some((d) => d.reunionId === reunion.id);

            if (presenceEnregistree) {
              return (
                <div className="mt-4 w-full bg-slate-100 border border-slate-200 rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 text-slate-600">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Présence enregistrée
                </div>
              );
            }
            if (presenceDeleguee) return null;
            return (
              <button
                onClick={() => nav({ tab: "home", sub: "scan" })}
                className="mt-4 w-full bg-gradient-to-r from-gold to-yellow-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2"
              >
                <QrCode className="h-5 w-5" /> Confirmer ma présence
              </button>
            );
          })()}

        {/* Board Book de CETTE séance — le recueil compilé et ses pièces. */}
        <button
          onClick={() =>
            nav({ tab: "boardbook", sub: "reunion", data: { reunionId: reunion.id } })
          }
          className="mt-4 w-full text-left rounded-2xl bg-gradient-to-br from-navy to-navy-light text-white p-4 flex items-center gap-3 shadow-lg active:scale-[0.98] transition"
        >
          <div className="h-12 w-12 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center shrink-0">
            <BookOpen className="h-6 w-6 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">Board Book de la séance</div>
            <div className="text-[11px] text-white/70 mt-0.5">
              {chargement
                ? "Chargement…"
                : recueil?.pret
                  ? `Recueil compilé${recueil.pages ? ` · ${recueil.pages} pages` : ""} · Ouvrir et annoter`
                  : "En préparation par le secrétariat"}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-white/50 shrink-0" />
        </button>

        <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Ordre du jour
        </div>
        {oj.length === 0 ? (
          <div className="bg-white rounded-xl p-4 border border-slate-100 text-center text-[13px] text-slate-500">
            L'ordre du jour n'a pas encore été publié.
          </div>
        ) : (
          <div className="space-y-2 pb-6">
            {oj.map((a, i) => (
              <div
                key={a.id}
                className="bg-white rounded-xl p-3 border border-slate-100 flex items-start gap-3"
              >
                <div className="h-7 w-7 rounded-lg bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-navy">{a.titre}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {a.dureeMin ? `${a.dureeMin} min` : "Durée non précisée"}
                    {a.obligatoire ? " · Obligatoire" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
