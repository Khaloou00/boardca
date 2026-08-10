import { useCallback, useEffect, useMemo, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import {
  MailCheck,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Plus,
  Loader2,
  Gavel,
  Users,
  Archive,
  CalendarClock,
  AlertTriangle,
  Download,
  FileText,
  ChevronDown,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  cloturerConsultation,
  decompte,
  echue,
  fetchConsultations,
  ouvrirConsultation,
  type Consultation,
} from "@/lib/consultations";
import { exporterCsv, exporterPdf, type TableauExport } from "@/lib/archive-export";
import { KpiTiles } from "@/components/super-admin/kpi-tiles";

type TabKey = "ouvertes" | "archives";

// Les erreurs Supabase sont des PostgrestError : des objets simples, pas des Error.
const messageErreur = (e: unknown) =>
  typeof e === "object" && e && "message" in e
    ? String((e as { message: unknown }).message)
    : undefined;

const CHOIX_META = {
  oui: {
    label: "Oui",
    classe: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    barre: "#10B981",
  },
  non: { label: "Non", classe: "bg-rose-50 text-rose-700 ring-rose-200", barre: "#F43F5E" },
  abstention: {
    label: "Abstention",
    classe: "bg-slate-100 text-slate-600 ring-slate-200",
    barre: "#94A3B8",
  },
} as const;

const dateFr = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function ConsultationPanel() {
  const { users, profile } = useBoardStore(
    useShallow((s) => ({ users: s.users, profile: s.profile })),
  );
  const administrateurs = useMemo(() => users.filter((u) => u.role === "administrateur"), [users]);
  // Même seuil que `close_consultation` côté serveur : majorité simple.
  const seuil = Math.floor(administrateurs.length / 2) + 1;

  const [list, setList] = useState<Consultation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("ouvertes");
  const [detail, setDetail] = useState<string | null>(null);
  // Confirmation avant clôture — remplace l'ancien `window.confirm` par une
  // popup cohérente avec le reste de l'app (même pattern que l'Émargement/PV) :
  // l'action est irréversible (résultat scellé par le serveur).
  const [confirmCloture, setConfirmCloture] = useState<Consultation | null>(null);

  const [question, setQuestion] = useState("");
  const [contexte, setContexte] = useState("");
  const [deadline, setDeadline] = useState("");

  const recharger = useCallback(() => {
    fetchConsultations()
      .then(setList)
      .catch((e) => toast.error("Chargement impossible", { description: messageErreur(e) }))
      .finally(() => setChargement(false));
  }, []);

  useEffect(recharger, [recharger]);

  const ouvertes = useMemo(() => list.filter((c) => c.statut === "ouverte"), [list]);
  const archives = useMemo(() => list.filter((c) => c.statut === "close"), [list]);
  const aClôturer = useMemo(() => ouvertes.filter(echue).length, [ouvertes]);
  const adoptees = useMemo(
    () => archives.filter((c) => c.resultat === "adoptee").length,
    [archives],
  );

  const submit = async () => {
    if (!question.trim() || !deadline || !profile) return;
    setBusy("create");
    try {
      await ouvrirConsultation({
        question: question.trim(),
        contexte: contexte.trim(),
        deadline,
        ouvertePar: profile.id,
      });
      toast.success("Consultation ouverte", {
        description: `${administrateurs.length} administrateur(s) notifié(s).`,
      });
      setQuestion("");
      setContexte("");
      setDeadline("");
      setCreating(false);
      setTab("ouvertes");
      recharger();
    } catch (e) {
      toast.error("Ouverture impossible", { description: messageErreur(e) });
    } finally {
      setBusy(null);
    }
  };

  const cloturer = async (c: Consultation) => {
    setConfirmCloture(null);
    setBusy(c.id);
    try {
      const r = await cloturerConsultation(c.id);
      toast.success(r.resultat === "adoptee" ? "Résolution adoptée" : "Résolution rejetée", {
        description: `${r.oui} oui · ${r.non} non · ${r.abstention} abstention — ${r.reponses}/${r.administrateurs} réponses`,
      });
      setTab("archives");
      recharger();
    } catch (e) {
      toast.error("Clôture impossible", { description: messageErreur(e) });
    } finally {
      setBusy(null);
    }
  };

  // Feuille de dépouillement nominative — la pièce à verser au dossier du Conseil.
  const tableau = (c: Consultation): TableauExport => {
    const { oui, non, abstention, total } = decompte(c);
    const repondu = new Set(c.reponses.map((r) => r.userId));
    return {
      titre: `Consultation écrite — ${c.question}`,
      sousTitre: `${c.statut === "close" ? `Résultat : ${c.resultat === "adoptee" ? "ADOPTÉE" : "REJETÉE"}` : "En cours"} · ${oui} oui / ${non} non / ${abstention} abstention · ${total}/${administrateurs.length} réponses · date limite ${dateFr(c.deadline)}`,
      entetes: ["Administrateur", "Réponse", "Motivation", "Répondu le"],
      lignes: [
        ...c.reponses.map((r) => [
          r.auteurNom ?? "—",
          (CHOIX_META[r.choix]?.label ?? r.choix).toUpperCase(),
          r.motivation ?? "—",
          new Date(r.createdAt).toLocaleDateString("fr-FR"),
        ]),
        ...administrateurs
          .filter((u) => !repondu.has(u.id))
          .map((u) => [u.nom, "SANS RÉPONSE", "—", "—"]),
      ],
    };
  };

  const liste = tab === "ouvertes" ? ouvertes : archives;

  const TABS: { key: TabKey; label: string; icon: typeof Clock; n: number }[] = [
    { key: "ouvertes", label: "En cours", icon: Clock, n: ouvertes.length },
    { key: "archives", label: "Archives", icon: Archive, n: archives.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">
            Décision entre deux séances
          </div>
          <h1 className="mt-1 text-2xl font-bold text-navy">Consultation écrite</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Chaque administrateur est notifié, répond une seule fois depuis son application — sa
            réponse est définitive — et le résultat est calculé puis scellé par le serveur à la
            clôture.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-gold-foreground transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy"
          >
            <Plus className="h-4 w-4" /> Nouvelle consultation
          </button>
        )}
      </div>

      <KpiTiles
        tuiles={[
          {
            label: "En cours",
            valeur: ouvertes.length,
            hint: `${administrateurs.length} administrateur(s) consultés`,
            ton: "navy",
          },
          {
            label: "À clôturer",
            valeur: aClôturer,
            hint: aClôturer > 0 ? "date limite dépassée" : "aucune échéance dépassée",
            ton: aClôturer > 0 ? "rose" : "slate",
          },
          { label: "Adoptées", valeur: adoptees, hint: "résolutions scellées", ton: "emerald" },
          {
            label: "Rejetées",
            valeur: archives.length - adoptees,
            hint: `${archives.length} consultation(s) archivée(s)`,
            ton: "gold",
          },
        ]}
      />

      {creating && (
        <div className="rounded-2xl border-2 border-gold bg-gold/5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-navy">Ouvrir une consultation écrite</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                La résolution part immédiatement aux {administrateurs.length} administrateurs, qui
                sont notifiés dans leur application.
              </p>
            </div>
            <button
              onClick={() => setCreating(false)}
              aria-label="Fermer"
              className="rounded-lg p-1 text-muted-foreground hover:bg-white hover:text-navy"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-navy">
                Résolution proposée
              </span>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ex. Autorisation d'engagement de la convention…"
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-navy">
                Contexte &amp; pièces
              </span>
              <textarea
                value={contexte}
                onChange={(e) => setContexte(e.target.value)}
                rows={3}
                placeholder="Exposé des motifs, urgence, documents joints…"
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[200px] flex-1">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-navy">
                  Date limite de réponse
                </span>
                <input
                  type="date"
                  value={deadline}
                  min={new Date().toLocaleDateString("en-CA")}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                />
              </label>
              <button
                onClick={submit}
                disabled={busy === "create" || !question.trim() || !deadline}
                className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-50"
              >
                {busy === "create" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Envoyer aux {administrateurs.length} administrateurs
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Vue des consultations"
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

      {chargement ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : liste.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            {tab === "archives" ? (
              <Archive className="h-6 w-6 text-slate-400" />
            ) : (
              <MailCheck className="h-6 w-6 text-slate-400" />
            )}
          </div>
          <div className="mt-4 text-sm font-semibold text-navy">
            {tab === "archives" ? "Aucune consultation archivée" : "Aucune consultation en cours"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {tab === "archives"
              ? "Les consultations clôturées et leur résultat scellé apparaîtront ici."
              : "Ouvrez-en une pour décider entre deux séances."}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {liste.map((c) => {
            const { oui, non, abstention, total } = decompte(c);
            const close = c.statut === "close";
            const adoptee = c.resultat === "adoptee";
            const estEchue = echue(c);
            const jours = Math.ceil(
              (new Date(`${c.deadline}T12:00:00`).getTime() - new Date().setHours(12, 0, 0, 0)) /
                86_400_000,
            );
            const attendus = administrateurs.length;
            const pct = (n: number) => (attendus ? (n / attendus) * 100 : 0);
            const repondu = new Set(c.reponses.map((r) => r.userId));
            const manquants = administrateurs.filter((u) => !repondu.has(u.id));
            const quorumAtteint = total >= seuil;
            const ouvert = detail === c.id;

            return (
              <article
                key={c.id}
                className={`overflow-hidden rounded-2xl border bg-card shadow-sm transition ${
                  close
                    ? adoptee
                      ? "border-l-4 border-l-emerald-500 border-border"
                      : "border-l-4 border-l-rose-500 border-border"
                    : estEchue
                      ? "border-l-4 border-l-rose-500 border-border"
                      : "border-l-4 border-l-gold border-border"
                }`}
              >
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-[240px] flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px]">
                        {close ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider ring-1 ring-inset ${
                              adoptee
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-rose-50 text-rose-700 ring-rose-200"
                            }`}
                          >
                            <Gavel className="h-3 w-3" />
                            {adoptee ? "Adoptée" : "Rejetée"}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider ring-1 ring-inset ${
                              estEchue
                                ? "bg-rose-50 text-rose-700 ring-rose-200"
                                : "bg-gold/15 text-[#8A6A00] ring-gold/40"
                            }`}
                          >
                            {estEchue ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {estEchue
                              ? "Échue — à clôturer"
                              : jours <= 0
                                ? "Dernier jour"
                                : `${jours} jour(s) restant(s)`}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          <CalendarClock className="h-3 w-3" />
                          {close && c.closedAt
                            ? `Clôturée le ${new Date(c.closedAt).toLocaleDateString("fr-FR")}`
                            : `Limite : ${dateFr(c.deadline)}`}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                            quorumAtteint
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Users className="h-3 w-3" /> Participation {total}/{attendus} · seuil{" "}
                          {seuil}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold leading-snug text-navy">{c.question}</h2>
                      {c.contexte && (
                        <p className="mt-1 text-sm text-muted-foreground">{c.contexte}</p>
                      )}
                    </div>

                    {!close && (
                      <button
                        onClick={() => setConfirmCloture(c)}
                        disabled={busy === c.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                          estEchue
                            ? "bg-rose-600 text-white hover:bg-rose-700"
                            : "border border-navy text-navy hover:bg-navy hover:text-white"
                        }`}
                      >
                        {busy === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Gavel className="h-4 w-4" />
                        )}
                        Clôturer et sceller
                      </button>
                    )}
                  </div>

                  {/* Dépouillement : une seule barre segmentée, plus lisible que trois compteurs
                      isolés — on y voit d'un coup le rapport de force ET ce qui manque. */}
                  <div className="mt-5">
                    <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                      {(["oui", "non", "abstention"] as const).map((k) => {
                        const n = k === "oui" ? oui : k === "non" ? non : abstention;
                        if (!n) return null;
                        return (
                          <div
                            key={k}
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${pct(n)}%`,
                              backgroundColor: CHOIX_META[k].barre,
                            }}
                            title={`${CHOIX_META[k].label} : ${n}`}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
                      <Compteur icon={CheckCircle2} label="Oui" n={oui} classe="text-emerald-600" />
                      <Compteur icon={XCircle} label="Non" n={non} classe="text-rose-600" />
                      <Compteur
                        icon={MinusCircle}
                        label="Abstention"
                        n={abstention}
                        classe="text-slate-500"
                      />
                      <span className="ml-auto text-muted-foreground">
                        {attendus - total} sans réponse
                      </span>
                    </div>
                  </div>

                  {/* Qui manque à l'appel : l'information qui permet de relancer. */}
                  {!close && manquants.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
                      <span className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                        En attente
                      </span>
                      {manquants.map((u) => (
                        <span
                          key={u.id}
                          title={u.nom}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[13px] text-navy ring-1 ring-inset ring-border"
                        >
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-gold">
                            {u.initiales}
                          </span>
                          {u.nom}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <button
                      onClick={() => setDetail(ouvert ? null : c.id)}
                      aria-expanded={ouvert}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${ouvert ? "rotate-180" : ""}`}
                      />
                      Dépouillement nominatif ({c.reponses.length})
                    </button>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => exporterCsv(tableau(c))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-navy transition hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5" /> CSV
                      </button>
                      <button
                        onClick={() => exporterPdf(tableau(c))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-navy transition hover:bg-muted"
                      >
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </button>
                    </div>
                  </div>
                </div>

                {ouvert && (
                  <ul className="divide-y divide-border border-t border-border bg-muted/20">
                    {c.reponses.length === 0 && (
                      <li className="px-6 py-4 text-center text-xs text-muted-foreground">
                        Aucune réponse à ce jour.
                      </li>
                    )}
                    {c.reponses.map((r) => {
                      const meta = CHOIX_META[r.choix];
                      return (
                        <li key={r.id} className="flex items-start gap-3 px-6 py-3">
                          <span
                            className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ring-1 ring-inset ${meta.classe}`}
                          >
                            {meta.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-navy">
                              {r.auteurNom ?? "—"}
                            </div>
                            {r.motivation && (
                              <div className="mt-0.5 text-xs italic text-muted-foreground">
                                « {r.motivation} »
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 text-[13px] text-muted-foreground">
                            {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </li>
                      );
                    })}
                    {manquants.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-3 px-6 py-3 text-muted-foreground"
                      >
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ring-1 ring-inset ring-border">
                          Sans réponse
                        </span>
                        <span className="text-sm">{u.nom}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Confirmation de clôture — résultat scellé par le serveur, définitif. */}
      <Dialog
        open={confirmCloture !== null}
        onOpenChange={(o) => busy === null && !o && setConfirmCloture(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-4.5 w-4.5 text-gold" /> Clôturer la consultation ?
            </DialogTitle>
            <DialogDescription>« {confirmCloture?.question} »</DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[14px] text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Le résultat est calculé et scellé par le serveur : il ne pourra plus être modifié.
            </span>
          </div>

          <DialogFooter>
            <button
              onClick={() => setConfirmCloture(null)}
              disabled={busy !== null}
              className="px-4 py-2 text-sm text-muted-foreground disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={() => confirmCloture && cloturer(confirmCloture)}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {busy !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Gavel className="h-4 w-4" />
              )}
              Clôturer et sceller
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Compteur({
  icon: Icon,
  label,
  n,
  classe,
}: {
  icon: typeof CheckCircle2;
  label: string;
  n: number;
  classe: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={`h-4 w-4 ${classe}`} />
      <span className="font-bold tabular-nums text-navy">{n}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
