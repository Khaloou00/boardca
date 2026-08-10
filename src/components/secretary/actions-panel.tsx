import { useMemo, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { Header } from "./documents-panel";
import { toast } from "sonner";
import {
  Plus,
  ListChecks,
  CalendarClock,
  Loader2,
  MessageSquare,
  Paperclip,
  AlertTriangle,
  ClipboardList,
  CircleDashed,
  CheckCircle2,
  Flame,
  ChevronDown,
} from "lucide-react";
import type { Action, ActionPriorite, ActionRapport } from "@/types/domain";
import { fetchRapportsAction, lienPieceJointe } from "@/lib/action-rapports";

const PRIORITE_META: Record<ActionPriorite, { label: string; puce: string; texte: string }> = {
  haute: { label: "Haute", puce: "bg-rose-500", texte: "text-rose-600" },
  normale: { label: "Normale", puce: "bg-gold", texte: "text-muted-foreground" },
  faible: { label: "Faible", puce: "bg-slate-300", texte: "text-muted-foreground" },
};

const today = () => new Date().toLocaleDateString("en-CA");

type Etat = "en_cours" | "en_retard" | "a_valider" | "terminee";
type Filtre = "toutes" | Etat;

// `a_valider` : le responsable a déclaré 100 % via un rapport ; c'est au secrétariat
// de confirmer la clôture. Le retard, lui, se déduit de l'échéance.
function etat(a: Action): Etat {
  if (a.statut === "terminee") return "terminee";
  if (a.statut === "a_valider") return "a_valider";
  if (a.echeance && a.echeance < today()) return "en_retard";
  return "en_cours";
}

const ETAT_META: Record<Etat, { label: string; badge: string; barre: string }> = {
  en_cours: { label: "En cours", badge: "bg-navy/10 text-navy", barre: "bg-navy" },
  en_retard: { label: "En retard", badge: "bg-rose-100 text-rose-700", barre: "bg-rose-500" },
  a_valider: { label: "À confirmer", badge: "bg-amber-100 text-amber-700", barre: "bg-amber-500" },
  terminee: {
    label: "Terminée",
    badge: "bg-emerald-100 text-emerald-700",
    barre: "bg-emerald-500",
  },
};

const joursRestants = (echeance: string) =>
  Math.round((new Date(echeance).getTime() - new Date(today()).getTime()) / 86_400_000);

export function ActionsPanel({ meetingId }: { meetingId: string | null }) {
  const { reunions, users, actions, actionsLoading } = useBoardStore(
    useShallow((s) => ({
      reunions: s.reunions,
      users: s.users,
      actions: s.actions,
      actionsLoading: s.actionsLoading,
    })),
  );
  const assignAction = useBoardStore((s) => s.assignAction);
  const updateAvancement = useBoardStore((s) => s.updateAvancement);
  const confirmerClotureAction = useBoardStore((s) => s.confirmerClotureAction);
  const renvoyerAction = useBoardStore((s) => s.renvoyerAction);

  const reunion = meetingId ? reunions.find((r) => r.id === meetingId) : null;

  const responsables = useMemo(
    () => users.filter((u) => u.role === "administrateur" || u.role === "responsable_action"),
    [users],
  );

  const [titre, setTitre] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [echeance, setEcheance] = useState("");
  const [priorite, setPriorite] = useState<ActionPriorite>("normale");
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState<"reunion" | "toutes">(meetingId ? "reunion" : "toutes");
  const [filtre, setFiltre] = useState<Filtre>("toutes");

  // Curseur : valeur locale pendant le glissement, un seul UPDATE au relâchement.
  const [dragging, setDragging] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const duPerimetre = useMemo(
    () =>
      scope === "reunion" && meetingId ? actions.filter((a) => a.reunionId === meetingId) : actions,
    [actions, scope, meetingId],
  );

  const compte = useMemo(() => {
    const c = { toutes: duPerimetre.length, en_cours: 0, en_retard: 0, a_valider: 0, terminee: 0 };
    for (const a of duPerimetre) c[etat(a)]++;
    return c;
  }, [duPerimetre]);

  const visibles = useMemo(
    () =>
      (filtre === "toutes" ? duPerimetre : duPerimetre.filter((a) => etat(a) === filtre))
        .slice()
        .sort((a, b) => {
          // « À confirmer » en tête : c'est ce qui attend une action du secrétariat.
          const rang = { a_valider: 0, en_retard: 1, en_cours: 2, terminee: 3 };
          const d = rang[etat(a)] - rang[etat(b)];
          if (d !== 0) return d;
          return (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999");
        }),
    [duPerimetre, filtre],
  );

  const effectifResponsable = responsableId || responsables[0]?.id || "";

  const create = async () => {
    if (!titre.trim() || !effectifResponsable) return;
    setCreating(true);
    try {
      await assignAction({
        titre: titre.trim(),
        responsableId: effectifResponsable,
        reunionId: meetingId ?? undefined,
        echeance: echeance || undefined,
        priorite,
      });
      toast.success("Action attribuée", {
        description: users.find((u) => u.id === effectifResponsable)?.nom,
      });
      setTitre("");
      setEcheance("");
      setPriorite("normale");
    } catch (e: any) {
      toast.error("Attribution impossible", { description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  const commit = async (a: Action, valeur: number) => {
    setDragging((d) => {
      const { [a.id]: _, ...rest } = d;
      return rest;
    });
    if (valeur === a.avancement) return;
    setBusy((b) => ({ ...b, [a.id]: true }));
    try {
      await updateAvancement(a.id, valeur);
      if (valeur >= 100) toast.success("Action terminée", { description: a.titre });
    } catch (e: any) {
      toast.error("Mise à jour impossible", { description: e?.message });
    } finally {
      setBusy((b) => ({ ...b, [a.id]: false }));
    }
  };

  const confirmer = async (a: Action) => {
    setBusy((b) => ({ ...b, [a.id]: true }));
    try {
      await confirmerClotureAction(a.id);
      toast.success("Clôture confirmée", {
        description: `${a.titre} — le responsable est notifié.`,
      });
    } catch (e: any) {
      toast.error("Confirmation impossible", { description: e?.message });
    } finally {
      setBusy((b) => ({ ...b, [a.id]: false }));
    }
  };

  const renvoyer = async (a: Action) => {
    const motif = window.prompt("Motif du renvoi (transmis au responsable) :") ?? undefined;
    setBusy((b) => ({ ...b, [a.id]: true }));
    try {
      await renvoyerAction(a.id, motif);
      toast.success("Action renvoyée", { description: "Le responsable est invité à compléter." });
    } catch (e: any) {
      toast.error("Renvoi impossible", { description: e?.message });
    } finally {
      setBusy((b) => ({ ...b, [a.id]: false }));
    }
  };

  return (
    <div>
      <Header
        title="Actions & Suivi"
        subtitle="Attribuez des actions et suivez leur avancement en direct."
      />

      {/* Tuiles KPI — cliquables, elles filtrent la liste ci-dessous. */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={ClipboardList}
          label="Actions suivies"
          value={compte.toutes}
          hint={scope === "reunion" && reunion ? "Sur cette réunion" : "Toutes réunions"}
          gradient="from-navy to-navy-light"
          actif={filtre === "toutes"}
          onClick={() => setFiltre("toutes")}
        />
        <KpiCard
          icon={CircleDashed}
          label="En cours"
          value={compte.en_cours}
          hint="Dans les délais"
          gradient="from-slate-600 to-slate-800"
          actif={filtre === "en_cours"}
          onClick={() => setFiltre("en_cours")}
        />
        <KpiCard
          icon={Flame}
          label="En retard"
          value={compte.en_retard}
          hint={compte.en_retard ? "Échéance dépassée" : "Aucun retard"}
          gradient="from-rose-600 to-rose-700"
          actif={filtre === "en_retard"}
          onClick={() => setFiltre("en_retard")}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Terminées"
          value={compte.terminee}
          hint={
            compte.toutes
              ? `${Math.round((compte.terminee / compte.toutes) * 100)} % du total`
              : "—"
          }
          gradient="from-emerald-600 to-emerald-700"
          actif={filtre === "terminee"}
          onClick={() => setFiltre("terminee")}
        />
      </div>

      {/* Formulaire d'attribution */}
      <div className="mt-6 rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border bg-muted/40 px-5 py-3">
          <div className="h-7 w-7 rounded-lg bg-navy text-gold flex items-center justify-center">
            <Plus className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-navy">Attribuer une action</div>
            <div className="text-[13px] text-muted-foreground">
              {reunion
                ? `Rattachée à « ${reunion.titre} »`
                : "Aucune réunion sélectionnée : l'action sera créée hors réunion."}
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid md:grid-cols-[1fr_190px_150px_140px_auto] gap-3 items-end">
            <Champ label="Intitulé de l'action">
              <input
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="Ex. Finaliser la note stratégique 2027"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </Champ>
            <Champ label="Responsable">
              <select
                value={effectifResponsable}
                onChange={(e) => setResponsableId(e.target.value)}
                disabled={responsables.length === 0}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                {responsables.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Échéance">
              <input
                type="date"
                value={echeance}
                min={today()}
                onChange={(e) => setEcheance(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </Champ>
            <Champ label="Priorité">
              <select
                value={priorite}
                onChange={(e) => setPriorite(e.target.value as ActionPriorite)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="haute">Haute</option>
                <option value="normale">Normale</option>
                <option value="faible">Faible</option>
              </select>
            </Champ>
            <button
              onClick={create}
              disabled={creating || !titre.trim() || !effectifResponsable}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold text-gold-foreground px-4 py-2 font-semibold hover:brightness-110 h-[38px] disabled:opacity-50 transition"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Attribuer
            </button>
          </div>

          {responsables.length === 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
              Aucun responsable disponible. Créez un administrateur ou un responsable d'action
              depuis Super Admin · Utilisateurs.
            </div>
          )}
        </div>
      </div>

      {/* Périmètre + liste */}
      <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-navy">
          {filtre === "toutes" ? "Toutes les actions" : ETAT_META[filtre].label}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{visibles.length}</span>
        </h2>
        {meetingId && (
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            {(["reunion", "toutes"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 rounded-md font-medium transition ${scope === s ? "bg-card shadow-sm text-navy" : "text-muted-foreground hover:text-navy"}`}
              >
                {s === "reunion" ? "Cette réunion" : "Toutes réunions"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {actionsLoading && actions.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}

        {visibles.map((a) => {
          const responsable = users.find((u) => u.id === a.responsableId);
          const e = etat(a);
          const meta = ETAT_META[e];
          const valeur = dragging[a.id] ?? a.avancement;
          const reunionDeLAction = a.reunionId ? reunions.find((r) => r.id === a.reunionId) : null;
          const retard = a.echeance ? joursRestants(a.echeance) : null;

          return (
            <div
              key={a.id}
              className="rounded-xl bg-card border border-border overflow-hidden hover:shadow-md transition"
            >
              <div className="flex">
                {/* Liseré de priorité */}
                <div className={`w-1 shrink-0 ${PRIORITE_META[a.priorite].puce}`} />

                <div className="flex-1 min-w-0 p-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="h-10 w-10 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-bold shrink-0"
                      title={responsable?.nom}
                    >
                      {responsable?.initiales ?? "?"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-medium text-navy">{a.titre}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                            <span>{responsable?.nom ?? "Responsable inconnu"}</span>
                            {a.echeance && (
                              <span
                                className={`flex items-center gap-1 ${e === "en_retard" ? "text-rose-600 font-medium" : ""}`}
                              >
                                <CalendarClock className="h-3 w-3" />
                                {new Date(a.echeance).toLocaleDateString("fr-FR")}
                                {e !== "terminee" && retard !== null && (
                                  <span className="opacity-70">
                                    ·{" "}
                                    {retard < 0
                                      ? `${-retard} j de retard`
                                      : retard === 0
                                        ? "aujourd'hui"
                                        : `dans ${retard} j`}
                                  </span>
                                )}
                              </span>
                            )}
                            <span
                              className={`flex items-center gap-1.5 ${PRIORITE_META[a.priorite].texte}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${PRIORITE_META[a.priorite].puce}`}
                              />
                              {PRIORITE_META[a.priorite].label}
                            </span>
                            {scope === "toutes" && reunionDeLAction && (
                              <span className="truncate max-w-[220px] opacity-80">
                                {reunionDeLAction.titre}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-[12px] uppercase font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${meta.barre} transition-all duration-500`}
                            style={{ width: `${valeur}%` }}
                          />
                        </div>
                        <div className="text-xs font-semibold tabular-nums w-10 text-right text-navy">
                          {busy[a.id] ? (
                            <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                          ) : (
                            `${valeur}%`
                          )}
                        </div>
                        {/* Ajustement direct réservé au secrétariat, tant que l'action
                            n'est ni en attente de confirmation ni clôturée. L'avancement
                            est normalement piloté par les rapports du responsable. */}
                        {e !== "a_valider" && e !== "terminee" && (
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={valeur}
                            disabled={busy[a.id]}
                            onChange={(ev) =>
                              setDragging((d) => ({ ...d, [a.id]: Number(ev.target.value) }))
                            }
                            onPointerUp={(ev) =>
                              commit(a, Number((ev.target as HTMLInputElement).value))
                            }
                            onKeyUp={(ev) =>
                              commit(a, Number((ev.target as HTMLInputElement).value))
                            }
                            className="w-32 accent-gold"
                          />
                        )}
                      </div>

                      {/* Clôture soumise par le responsable : le secrétariat confirme
                          ou renvoie pour compléments. */}
                      {e === "a_valider" && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                            <AlertTriangle className="h-3.5 w-3.5" /> Clôture à 100 % à confirmer
                          </span>
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              onClick={() => renvoyer(a)}
                              disabled={busy[a.id]}
                              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-muted disabled:opacity-50"
                            >
                              Renvoyer
                            </button>
                            <button
                              onClick={() => confirmer(a)}
                              disabled={busy[a.id]}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busy[a.id] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Confirmer la clôture
                            </button>
                          </div>
                        </div>
                      )}

                      <RapportsAction
                        actionId={a.id}
                        nomAuteur={(id) => users.find((u) => u.id === id)?.nom ?? "—"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!actionsLoading && visibles.length === 0 && (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground mx-auto" />
            <div className="mt-3 text-sm text-muted-foreground">
              {compte.toutes === 0
                ? scope === "reunion" && meetingId
                  ? "Aucune action attribuée pour cette réunion."
                  : "Aucune action attribuée. Utilisez le formulaire ci-dessus."
                : `Aucune action « ${ETAT_META[filtre as Etat].label.toLowerCase()} » dans ce périmètre.`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-navy">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  gradient,
  actif,
  onClick,
}: {
  icon: any;
  label: string;
  value: number;
  hint: string;
  gradient: string;
  actif: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left group">
      <div
        className={`rounded-2xl p-5 bg-gradient-to-br ${gradient} text-white shadow-lg transition group-hover:shadow-xl group-hover:-translate-y-0.5 ${actif ? "ring-2 ring-gold ring-offset-2 ring-offset-background" : ""}`}
      >
        <Icon className="h-6 w-6 opacity-80" />
        <div className="mt-3 text-3xl font-bold font-mono tabular-nums">{value}</div>
        <div className="text-xs opacity-85 mt-1">{label}</div>
        <div className="text-[12px] opacity-60 mt-1.5">{hint}</div>
      </div>
    </button>
  );
}

// Fil des rapports d'avancement d'une action, en lecture (le responsable les
// rédige depuis le mobile). Chargé à la demande, avec la pièce jointe éventuelle.
function RapportsAction({
  actionId,
  nomAuteur,
}: {
  actionId: string;
  nomAuteur: (id: string) => string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [rapports, setRapports] = useState<ActionRapport[] | null>(null);

  const basculer = async () => {
    const o = !ouvert;
    setOuvert(o);
    if (o && rapports === null) {
      try {
        setRapports(await fetchRapportsAction(actionId));
      } catch {
        setRapports([]);
      }
    }
  };

  const ouvrirPiece = async (path: string) => {
    const url = await lienPieceJointe(path);
    if (url) window.open(url, "_blank");
    else toast.error("Pièce jointe indisponible");
  };

  return (
    <div className="mt-3">
      <button
        onClick={basculer}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-navy transition"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Rapports d'avancement
        {rapports && rapports.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-px text-[12px] font-semibold text-navy">
            {rapports.length}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 transition ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="mt-2.5 space-y-2.5 border-l-2 border-border pl-3">
          {rapports === null ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
            </div>
          ) : rapports.length === 0 ? (
            <div className="text-xs text-muted-foreground">Aucun rapport pour l'instant.</div>
          ) : (
            rapports.map((r) => (
              <div key={r.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-navy">{nomAuteur(r.auteurId)}</span>
                  <span className="rounded-full bg-navy/10 px-1.5 py-px text-[12px] font-bold text-navy">
                    {r.avancement}%
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{r.texte}</div>
                {r.fichierPath && (
                  <button
                    onClick={() => ouvrirPiece(r.fichierPath!)}
                    className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-navy underline underline-offset-2"
                  >
                    <Paperclip className="h-3 w-3" />
                    {r.fichierNom ?? "Pièce jointe"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
