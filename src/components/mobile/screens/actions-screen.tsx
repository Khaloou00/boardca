// ActionsScreen — extrait de `admin-app.tsx`.
// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du
// parent, donc React ne le démonte plus (état local et saisies préservés).
import { useState, useRef } from "react";
import { TopBar } from "../shared/ui-components";
import { MAX_RAPPORT_BYTES, fetchRapportsAction, lienPieceJointe, uploadPieceJointe } from "@/lib/action-rapports";
import { type ActionRapport } from "@/types/domain";
import { CalendarClock, ChevronRight, Clock, FileText, ListChecks, Loader2, MessageSquare, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useMobileSession } from "../shared/mobile-session";

import type { View } from "../shared/view-state";
export function ActionsScreen({ nav }: { nav: (v: View) => void }) {
  const {
    allActions,
    profile,
    realReunions,
    realUsers,
    soumettreRapportAction,
  } = useMobileSession();

  const [busy, setBusy] = useState<string | null>(null);
  // Carte dont le fil de rapports est déplié, et carte dont le formulaire de
  // rapport est ouvert (le responsable saisit texte + avancement + pièce jointe).
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [formOuvert, setFormOuvert] = useState<string | null>(null);
  const [rapports, setRapports] = useState<Record<string, ActionRapport[]>>({});
  const [texte, setTexte] = useState("");
  const [avancement, setAvancement] = useState(0);
  const [fichier, setFichier] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const aujourdhui = new Date().toLocaleDateString("en-CA");
  const etat = (a: (typeof allActions)[number]) =>
    a.statut === "terminee"
      ? "terminee"
      : a.statut === "a_valider"
        ? "a_valider"
        : a.echeance && a.echeance < aujourdhui
          ? "en_retard"
          : "en_cours";
  const META = {
    en_cours: { label: "En cours", badge: "bg-navy/10 text-navy", barre: "bg-navy" },
    en_retard: { label: "En retard", badge: "bg-rose-100 text-rose-700", barre: "bg-rose-500" },
    a_valider: {
      label: "À confirmer",
      badge: "bg-amber-100 text-amber-700",
      barre: "bg-amber-500",
    },
    terminee: {
      label: "Terminée",
      badge: "bg-emerald-100 text-emerald-700",
      barre: "bg-emerald-500",
    },
  } as const;

  const rang = { en_retard: 0, a_valider: 1, en_cours: 2, terminee: 3 } as const;
  const trier = (arr: typeof allActions) =>
    [...arr].sort((a, b) => {
      const d = rang[etat(a)] - rang[etat(b)];
      return d !== 0 ? d : (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999");
    });

  const total = allActions.length;
  const enCours = allActions.filter((a) => etat(a) === "en_cours").length;
  const enRetard = allActions.filter((a) => etat(a) === "en_retard").length;
  const aValider = allActions.filter((a) => etat(a) === "a_valider").length;
  const terminees = allActions.filter((a) => etat(a) === "terminee").length;
  const moyen = total ? Math.round(allActions.reduce((s, a) => s + a.avancement, 0) / total) : 0;

  // Regroupement par responsable : le membre du CA supervise l'avancement des
  // actions confiées à chacun (les groupes avec du retard remontent en premier).
  const responsableIds = Array.from(new Set(allActions.map((a) => a.responsableId)));
  const groupes = responsableIds
    .map((id) => {
      const acts = trier(allActions.filter((a) => a.responsableId === id));
      const moy = acts.length
        ? Math.round(acts.reduce((s, a) => s + a.avancement, 0) / acts.length)
        : 0;
      const retards = acts.filter((a) => etat(a) === "en_retard").length;
      return { id, user: realUsers.find((u) => u.id === id), acts, moy, retards };
    })
    .sort((g1, g2) => {
      const r = (g2.retards > 0 ? 1 : 0) - (g1.retards > 0 ? 1 : 0);
      return r !== 0 ? r : (g1.user?.nom ?? "").localeCompare(g2.user?.nom ?? "");
    });

  // Charge (à la demande) les rapports d'une action pour les afficher.
  const chargerRapports = async (id: string) => {
    try {
      const r = await fetchRapportsAction(id);
      setRapports((m) => ({ ...m, [id]: r }));
    } catch {
      /* silencieux : la liste reste simplement vide */
    }
  };

  // Ouvre/prépare le formulaire de rapport (avancement pré-rempli à la valeur courante).
  const ouvrirForm = (a: (typeof allActions)[number]) => {
    if (formOuvert === a.id) {
      setFormOuvert(null);
      return;
    }
    setFormOuvert(a.id);
    setTexte("");
    setAvancement(a.avancement);
    setFichier(null);
  };

  const choisirFichier = (f: File | null) => {
    if (f && f.size > MAX_RAPPORT_BYTES) {
      toast.error("Fichier trop lourd", { description: "25 Mo maximum." });
      return;
    }
    setFichier(f);
  };

  // Soumission d'un rapport : texte obligatoire, pièce jointe facultative.
  const soumettre = async (id: string) => {
    if (!texte.trim()) {
      toast.error("Le rapport doit contenir un texte");
      return;
    }
    setBusy(id);
    try {
      let piece;
      if (fichier) piece = await uploadPieceJointe(id, fichier);
      await soumettreRapportAction({
        actionId: id,
        texte: texte.trim(),
        avancement,
        fichier: piece
          ? { path: piece.path, nom: piece.nom, type: piece.type, taille: piece.taille }
          : undefined,
      });
      toast.success(
        avancement >= 100
          ? "Rapport transmis — clôture en attente du secrétariat"
          : "Rapport transmis",
      );
      setFormOuvert(null);
      setTexte("");
      setFichier(null);
      await chargerRapports(id);
      setOuvert(id);
    } catch (e: any) {
      toast.error("Envoi du rapport impossible", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const ouvrirPiece = async (path: string) => {
    const url = await lienPieceJointe(path);
    if (url) window.open(url, "_blank");
    else toast.error("Pièce jointe indisponible");
  };

  return (
    <div className="bg-[#F8FAFC] min-h-full">
      <TopBar title="Suivi des actions" onBack={() => nav({ tab: "profile" })} />

      {total === 0 ? (
        <div className="py-16 flex flex-col items-center text-center gap-3 px-8">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <ListChecks className="h-6 w-6 text-slate-400" />
          </div>
          <div className="text-sm font-semibold text-navy">Aucune action</div>
          <div className="text-xs text-slate-500 max-w-[240px]">
            Les actions confiées par le Conseil apparaîtront ici.
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {/* Avancement global de l'exécution des décisions */}
          <div className="rounded-2xl bg-navy text-white p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-widest text-gold font-semibold">
              Exécution des décisions
            </div>
            <div className="flex items-end gap-2 mt-1">
              <div className="text-3xl font-bold leading-none">{moyen}%</div>
              <div className="text-[11px] text-white/60 mb-0.5">
                avancement moyen · {total} action{total > 1 ? "s" : ""}
              </div>
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full bg-gold transition-all duration-500"
                style={{ width: `${moyen}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { v: enCours, l: "En cours", c: "bg-white text-navy border border-slate-100" },
              { v: aValider, l: "À confirmer", c: "bg-amber-500 text-white" },
              { v: enRetard, l: "En retard", c: "bg-rose-500 text-white" },
              { v: terminees, l: "Terminées", c: "bg-emerald-500 text-white" },
            ].map((t) => (
              <div key={t.l} className={`rounded-2xl p-3 text-center shadow-sm ${t.c}`}>
                <div className="text-2xl font-bold leading-none">{t.v}</div>
                <div className="text-[10px] opacity-80 mt-1.5">{t.l}</div>
              </div>
            ))}
          </div>

          {/* Actions groupées par responsable */}
          {groupes.map((g) => (
            <div key={g.id} className="space-y-2.5">
              <div className="flex items-center gap-2.5 pt-1">
                <div className="h-9 w-9 rounded-full bg-navy text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                  {g.user?.initiales ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-navy truncate">
                    {g.user?.nom ?? "Responsable inconnu"}
                    {g.id === profile?.id && (
                      <span className="ml-1.5 text-[9px] uppercase font-semibold text-gold">
                        Vous
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {g.acts.length} action{g.acts.length > 1 ? "s" : ""} · {g.moy}% avancement
                    {g.retards > 0 && (
                      <span className="text-rose-600 font-semibold">
                        {" "}
                        · {g.retards} en retard
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {g.acts.map((a) => {
                const e = etat(a);
                const meta = META[e];
                const reunion = a.reunionId
                  ? realReunions.find((r) => r.id === a.reunionId)
                  : null;
                const enCoursDeMaj = busy === a.id;
                const estMien = a.responsableId === profile?.id;
                return (
                  <div
                    key={a.id}
                    className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-sm text-navy flex-1 min-w-0">{a.titre}</div>
                      <span
                        className={`text-[9px] uppercase font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                      {a.echeance && (
                        <span
                          className={`flex items-center gap-1 ${e === "en_retard" ? "text-rose-600 font-semibold" : ""}`}
                        >
                          <CalendarClock className="h-3 w-3" />
                          {new Date(a.echeance).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {a.priorite === "haute" && (
                        <span className="flex items-center gap-1 text-rose-600 font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Priorité haute
                        </span>
                      )}
                      {reunion && <span className="truncate max-w-[150px]">{reunion.titre}</span>}
                    </div>

                    <div className="mt-3 flex items-center gap-2.5">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full ${meta.barre} transition-all duration-500`}
                          style={{ width: `${a.avancement}%` }}
                        />
                      </div>
                      <div className="text-[11px] font-bold tabular-nums text-navy w-9 text-right">
                        {enCoursDeMaj ? (
                          <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                        ) : (
                          `${a.avancement}%`
                        )}
                      </div>
                    </div>

                    {/* À 100 % déclaré : en attente de confirmation du secrétariat. */}
                    {e === "a_valider" && (
                      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        Clôture à 100 % soumise — en attente de confirmation du secrétariat.
                      </div>
                    )}

                    {/* Le responsable fait avancer SON action en rédigeant un
                        rapport (texte requis + pièce jointe facultative) ; il ne
                        peut plus déplacer la barre en direct. Lecture seule sinon. */}
                    {estMien && e !== "terminee" && (
                      <button
                        onClick={() => ouvrirForm(a)}
                        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-navy text-white py-2 text-[12px] font-semibold active:scale-[0.98]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {formOuvert === a.id ? "Fermer" : "Rédiger un rapport d'avancement"}
                      </button>
                    )}

                    {estMien && formOuvert === a.id && (
                      <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2.5">
                        <textarea
                          value={texte}
                          onChange={(ev) => setTexte(ev.target.value)}
                          rows={3}
                          placeholder="Décrivez l'avancement, les difficultés, les prochaines étapes…"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-gold"
                        />
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                            Avancement déclaré · {avancement}%
                          </div>
                          <div className="flex gap-1.5">
                            {[0, 25, 50, 75, 100].map((p) => (
                              <button
                                key={p}
                                onClick={() => setAvancement(p)}
                                className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold border transition active:scale-95 ${
                                  avancement === p
                                    ? "bg-navy text-white border-navy"
                                    : "bg-white text-slate-500 border-slate-200"
                                }`}
                              >
                                {p === 100 ? "100" : p}
                              </button>
                            ))}
                          </div>
                        </div>

                        <input
                          ref={fileRef}
                          type="file"
                          hidden
                          onChange={(ev) => {
                            choisirFichier(ev.target.files?.[0] ?? null);
                            ev.currentTarget.value = "";
                          }}
                        />
                        {fichier ? (
                          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]">
                            <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="flex-1 truncate text-navy">{fichier.name}</span>
                            <button onClick={() => setFichier(null)} aria-label="Retirer">
                              <X className="h-3.5 w-3.5 text-slate-400" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => fileRef.current?.click()}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] text-slate-500"
                          >
                            <Paperclip className="h-3.5 w-3.5" /> Joindre une pièce (facultatif)
                          </button>
                        )}

                        {avancement >= 100 && (
                          <div className="text-[10px] text-amber-700">
                            À 100 %, l'action passera « à confirmer » : le secrétariat validera la
                            clôture.
                          </div>
                        )}
                        <button
                          onClick={() => soumettre(a.id)}
                          disabled={enCoursDeMaj || !texte.trim()}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold text-gold-foreground py-2 text-[12px] font-semibold disabled:opacity-40 active:scale-[0.98]"
                        >
                          {enCoursDeMaj ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Transmettre le rapport
                        </button>
                      </div>
                    )}

                    {/* Fil des rapports — visible de tous (responsable, CA, secrétariat). */}
                    <button
                      onClick={() => {
                        const o = ouvert === a.id ? null : a.id;
                        setOuvert(o);
                        if (o && !rapports[a.id]) chargerRapports(a.id);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-slate-500"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Rapports d'avancement
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform ${ouvert === a.id ? "rotate-90" : ""}`}
                      />
                    </button>

                    {ouvert === a.id && (
                      <div className="mt-2.5 space-y-2.5 border-l-2 border-slate-100 pl-3">
                        {(rapports[a.id] ?? []).map((r) => (
                          <div key={r.id} className="text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-navy">
                                {realUsers.find((u) => u.id === r.auteurId)?.nom ?? "—"}
                              </span>
                              <span className="rounded-full bg-navy/10 px-1.5 py-px text-[9px] font-bold text-navy">
                                {r.avancement}%
                              </span>
                              <span className="text-slate-400">
                                {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                              </span>
                            </div>
                            <div className="text-slate-600 mt-0.5 whitespace-pre-wrap">
                              {r.texte}
                            </div>
                            {r.fichierPath && (
                              <button
                                onClick={() => ouvrirPiece(r.fichierPath!)}
                                className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-navy underline underline-offset-2"
                              >
                                <Paperclip className="h-3 w-3" />
                                {r.fichierNom ?? "Pièce jointe"}
                              </button>
                            )}
                          </div>
                        ))}
                        {(rapports[a.id]?.length ?? 0) === 0 && (
                          <div className="text-[11px] text-slate-400">
                            Aucun rapport pour l'instant.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
