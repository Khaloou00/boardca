// PVScreen — extrait de `admin-app.tsx`.
import { useState, useEffect } from "react";
import { SignatureRow, type Signature } from "../shared/signature-pad";
import { TopBar } from "../shared/ui-components";
import { type View } from "../shared/view-state";
import { PdfAnnotator } from "@/components/pdf/pdf-annotator";
import { pvEstVide } from "@/lib/pv-format";
import { ajouterPvObservation, fetchPvObservations, type PvObservation } from "@/lib/pv-observations";
import { genererPvPdfUrl } from "@/lib/pv-pdf";
import { ROLE_LABELS } from "@/lib/role-labels";
import { supabase } from "@/lib/supabase";
import { type PV, type Reunion, type Signature as PvSignature, type User as CaUser } from "@/types/domain";
import { CheckCircle2, Clock, Crown, FileSignature, FileText, Loader2, ShieldCheck, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

import { METHODE_LABEL } from "../shared/constants";
export function PVScreen({
  nav,
  realPv,
  pvReunion,
  profile,
  pvDataReady,
  pvSealed,
  mySignatureReal,
  waitingToSeal,
  canSeal,
  currentPCA,
  presentUsers,
  realTotalPresents,
  realSignedCount,
}: {
  nav: (v: View) => void;
  realPv: PV | undefined;
  pvReunion: Reunion | null;
  profile: CaUser | null;
  pvDataReady: boolean;
  pvSealed: boolean;
  mySignatureReal: PvSignature | undefined;
  waitingToSeal: boolean;
  canSeal: boolean;
  currentPCA: CaUser | undefined;
  presentUsers: CaUser[];
  realTotalPresents: number;
  realSignedCount: number;
}) {
  const pct = realTotalPresents ? Math.round((realSignedCount / realTotalPresents) * 100) : 0;

  // PDF lisible du PV, généré à la volée depuis son contenu, pour être lu et annoté
  // (surlignage, commentaires privés/partagés) comme un document du Board Book.
  const [pvPdfUrl, setPvPdfUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!realPv || pvEstVide(realPv.contenu ?? "")) {
      setPvPdfUrl(null);
      return;
    }
    const url = genererPvPdfUrl({
      titre: pvReunion?.titre ?? "Procès-verbal",
      date: pvReunion
        ? new Date(pvReunion.date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "",
      lieu: pvReunion?.lieu ?? "—",
      contenuHtml: realPv.contenu ?? "",
    });
    setPvPdfUrl(url);
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realPv?.id, realPv?.contenu, pvReunion?.id]);

  // Observations partagées sur ce PV (désapprobations, réserves) — visibles de tous.
  const [observations, setObservations] = useState<PvObservation[]>([]);
  const [obsTexte, setObsTexte] = useState("");
  const [obsBusy, setObsBusy] = useState(false);
  const [obsOuvert, setObsOuvert] = useState(false);
  const pvIdCourant = realPv?.id ?? null;
  useEffect(() => {
    if (!pvIdCourant) return setObservations([]);
    let annule = false;
    const charger = () =>
      fetchPvObservations(pvIdCourant)
        .then((o) => !annule && setObservations(o))
        .catch(() => {});
    charger();
    const canal = supabase
      .channel(`boardca:pv-obs:${pvIdCourant}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pv_observations",
          filter: `pv_id=eq.${pvIdCourant}`,
        },
        () => charger(),
      )
      // Resynchro sur reconnexion : voir src/lib/notifications.ts.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") charger();
      });
    return () => {
      annule = true;
      supabase.removeChannel(canal);
    };
  }, [pvIdCourant]);

  const envoyerObservation = async (type: "observation" | "desapprobation") => {
    if (!realPv || !profile || !obsTexte.trim()) return;
    setObsBusy(true);
    try {
      await ajouterPvObservation(realPv.id, profile.id, obsTexte, type, realPv.version);
      setObsTexte("");
      setObsOuvert(false);
      setObservations(await fetchPvObservations(realPv.id));
      toast.success(
        type === "desapprobation" ? "Désapprobation enregistrée" : "Observation partagée",
        { description: "Les membres du CA et le Secrétariat en sont informés." },
      );
    } catch {
      toast.error("Envoi impossible");
    } finally {
      setObsBusy(false);
    }
  };
  if (!pvDataReady) {
    return (
      <div className="bg-[#F8FAFC] min-h-full pb-6 relative z-0 overflow-y-auto flex-1">
        <TopBar title="Procès-verbal" onBack={() => nav({ tab: "home" })} />
        <div className="px-5 py-10 flex flex-col items-center gap-2 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <div className="text-xs">Chargement du procès-verbal…</div>
        </div>
      </div>
    );
  }
  // Aucun PV en base tant que la Secrétaire n'a pas clôturé une séance.
  if (!realPv || !pvReunion) {
    return (
      <div className="bg-[#F8FAFC] min-h-full">
        <TopBar title="Procès-verbal" onBack={() => nav({ tab: "home" })} />
        <div className="px-8 py-20 flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <div className="text-sm font-semibold text-navy">Aucun procès-verbal</div>
          <div className="text-xs text-slate-500 max-w-[250px]">
            Le PV sera disponible après la clôture d'une séance par le Secrétariat.
          </div>
        </div>
      </div>
    );
  }
  // Une observation (a fortiori une désapprobation) est l'ALTERNATIVE à la
  // signature, pas un complément — cf. le texte d'état vide plus bas
  // (« Signer le PV vaut approbation ; une observation permet d'exprimer une
  // réserve »). Sans cette valeur, "Apposer ma signature" restait cliquable
  // après une désapprobation déjà envoyée, ce qui est contradictoire.
  // Filtré sur la manche COURANTE (pv.version) : un PV renvoyé après correction
  // (RPC `renvoyer_pv`) est un NOUVEAU texte — les positions prises sur la
  // version précédente ne s'y appliquent plus du tout. Côté membre elles ne
  // sont donc ni affichées, ni comptées, ni bloquantes : chacun repart d'une
  // page blanche (le Secrétariat, lui, garde l'historique complet dans son
  // panneau, c'est là que ça sert).
  const observationsCourantes = observations.filter((o) => o.pvVersion === realPv?.version);
  const monObservation = observationsCourantes.find((o) => o.userId === profile?.id);

  // Bloc de signature : réutilisé, placé AVANT les observations (le membre lit le
  // PV, signe — ou pas — puis consulte/émet les observations).
  const blocSignature = pvSealed ? (
    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center">
      <ShieldCheck className="h-8 w-8 text-emerald-600 mx-auto" />
      <div className="mt-2 font-bold text-emerald-800">PV intégralement signé</div>
      <div className="text-[11px] text-emerald-700 mt-1">
        Scellé par {currentPCA?.nom ?? "le PCA"} · Archivé · Conservation 10 ans
      </div>
    </div>
  ) : realPv?.statut !== "en_signature" ? (
    <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 text-center text-[12px] text-slate-600 flex items-center justify-center gap-2">
      <Clock className="h-4 w-4" /> Le PV n'a pas encore été envoyé pour signature par le
      Secrétariat
    </div>
  ) : mySignatureReal ? (
    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-[12px] text-emerald-800 font-semibold flex items-center justify-center gap-2">
      <CheckCircle2 className="h-4 w-4" /> Votre signature a été apposée
    </div>
  ) : waitingToSeal ? (
    <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 text-center text-[12px] text-slate-600 flex items-center justify-center gap-2">
      <Clock className="h-4 w-4" /> En attente des signatures des membres ({realSignedCount}/
      {Math.max(realTotalPresents - 1, 0)})
    </div>
  ) : canSeal ? (
    <button
      onClick={() => nav({ tab: "home", sub: "pv-sign" })}
      className="w-full bg-gradient-to-r from-gold to-yellow-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] shadow"
    >
      <Crown className="h-5 w-5" /> Sceller le PV
    </button>
  ) : monObservation ? null : (
    <button
      onClick={() => nav({ tab: "home", sub: "pv-sign" })}
      className="w-full bg-gradient-to-r from-gold to-yellow-600 text-white rounded-xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] shadow"
    >
      <FileSignature className="h-5 w-5" /> Apposer ma signature
    </button>
  );

  return (
    <div className="bg-[#F8FAFC] min-h-full pb-6">
      <TopBar title="Procès-verbal" onBack={() => nav({ tab: "home" })} />
      <div className="px-4 py-4 space-y-4">
        {/* Le document PDF du PV : en-tête, présents et texte y figurent déjà. */}
        {pvEstVide(realPv?.contenu ?? "") ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-6 text-center text-[12px] italic text-slate-400">
            Le procès-verbal n'a pas encore été rédigé par le Secrétariat.
          </div>
        ) : pvPdfUrl && profile ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden">
            <PdfAnnotator
              cible={{ pvId: realPv!.id }}
              url={pvPdfUrl}
              userId={profile.id}
              visibiliteImposee="public"
              pvVersion={realPv!.version}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Préparation du PDF…
          </div>
        )}

        {/* Signature — avant les observations. */}
        {blocSignature}

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 text-[12px] text-slate-700 space-y-3">
            {/* Observations partagées : la voix des membres qui ne signent pas. */}
            <section>
              <div className="text-[10px] uppercase tracking-widest text-gold font-bold mb-1.5">
                Observations du Conseil ({observationsCourantes.length})
              </div>

              {/* La désapprobation est une action à part entière : bouton plein, visible.
                  Une seule position par membre — pas de 2e désapprobation/observation
                  une fois la première envoyée (voir `monObservation` ci-dessus). */}
              {!pvSealed && !mySignatureReal && !obsOuvert && !monObservation && (
                <button
                  onClick={() => setObsOuvert(true)}
                  className="mb-2 w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-2.5 text-[13px] font-bold text-red-700 active:scale-[0.98] transition"
                >
                  <ThumbsDown className="h-4 w-4" /> Désapprouver ou émettre une réserve
                </button>
              )}

              {obsOuvert && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                  <textarea
                    value={obsTexte}
                    onChange={(e) => setObsTexte(e.target.value)}
                    rows={3}
                    maxLength={4000}
                    placeholder="Votre réserve, votre désaccord ou votre demande de correction. Visible de tous les membres et du Secrétariat."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => envoyerObservation("desapprobation")}
                      disabled={obsBusy || !obsTexte.trim()}
                      className="flex-1 rounded-lg bg-red-600 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                    >
                      {obsBusy ? "Envoi…" : "Désapprouver"}
                    </button>
                    <button
                      onClick={() => envoyerObservation("observation")}
                      disabled={obsBusy || !obsTexte.trim()}
                      className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-[12px] font-semibold text-navy disabled:opacity-50"
                    >
                      Simple observation
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setObsOuvert(false);
                      setObsTexte("");
                    }}
                    className="mt-1.5 w-full py-1 text-[11px] text-slate-500"
                  >
                    Annuler
                  </button>
                </div>
              )}

              {observationsCourantes.length === 0 ? (
                <div className="mt-2 text-[11px] italic text-slate-400">
                  Aucune observation. Signer le PV vaut approbation ; une observation permet
                  d'exprimer une réserve visible de tous.
                </div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {observationsCourantes.map((o) => (
                    <li
                      key={o.id}
                      className={`rounded-lg border p-2.5 text-[12px] ${
                        o.type === "desapprobation"
                          ? "border-red-200 bg-red-50/50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            o.type === "desapprobation"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {o.type === "desapprobation" ? "Désapprouve" : "Observation"}
                        </span>
                        <span className="font-semibold text-navy">{o.auteurNom ?? "—"}</span>
                        <span className="ml-auto text-[10px] text-slate-400">
                          {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-700 whitespace-pre-wrap">{o.texte}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              Signatures électroniques
            </div>
            <div className="mt-2 space-y-2">
              {presentUsers.map((u) => {
                const sig = realPv?.signatures.find(
                  (s) => s.userId === u.id && s.pvVersion === realPv.version,
                );
                if (sig) {
                  return (
                    <SignatureRow
                      key={u.id}
                      you={u.id === profile?.id}
                      s={{
                        userId: u.id,
                        nom: u.nom,
                        qualite: u.estPresidentCA
                          ? "Président du Conseil d'Administration"
                          : (u.qualite ?? ROLE_LABELS[u.role].label),
                        methode: METHODE_LABEL[sig.methode],
                        imageBase64: sig.imageBase64,
                        timestamp: sig.signedAt,
                        hash: sig.hash ?? "",
                      }}
                    />
                  );
                }
                // Un membre qui a désapprouvé/émis une réserve n'a pas simplement
                // « pas encore signé » : le statut doit refléter sa position réelle.
                // Sur la manche courante uniquement : après un renvoi, chacun
                // repart « En attente » sur le nouveau texte.
                const obsUser = observationsCourantes.find((o) => o.userId === u.id);
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between text-[12px] px-1 py-1.5"
                  >
                    <div className="text-slate-500 flex items-center gap-1">
                      {u.nom} {u.estPresidentCA && <Crown className="h-3 w-3 text-gold" />}
                    </div>
                    {obsUser?.type === "desapprobation" ? (
                      <div className="inline-flex items-center gap-1 text-red-600 text-[11px] font-semibold">
                        <ThumbsDown className="h-3 w-3" /> Désapprouvé
                      </div>
                    ) : obsUser ? (
                      <div className="inline-flex items-center gap-1 text-amber-600 text-[11px] font-semibold">
                        <ThumbsDown className="h-3 w-3" /> Réserve émise
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                        <Clock className="h-3 w-3" /> En attente
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Signatures reçues : {realSignedCount}/{realTotalPresents}
                </span>
                <span className="font-semibold text-navy">{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold to-yellow-600 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
