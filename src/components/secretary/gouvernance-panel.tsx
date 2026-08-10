import { useCallback, useEffect, useMemo, useState } from "react";
import { useBoardStore } from "@/store/useBoardStore";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { Save, Loader2, CheckCircle2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  fetchBareme,
  saveBareme,
  fetchJetonsParSeance,
  validerPaiementJetons,
  TYPES_BAREME,
  type Bareme,
  type SeanceJetons,
} from "@/lib/gouvernance";
import { formatFCFA } from "@/lib/utils";
import { typeMeta, dateFr } from "@/lib/reunion-visuals";
import { StatStrip, StatTile } from "@/components/kpis-gouvernance/StatTile";

const MODE_LABEL: Record<string, string> = {
  presentiel: "Présentiel",
  distance: "À distance",
  procuration: "Procuration",
  absent: "Absent",
};

type Filtre = "tous" | "attente" | "payes";

// Paramètres de gouvernance : la valeur du jeton de présence par type de séance, et la
// validation des paiements dus aux administrateurs.
export function GouvernancePanel() {
  const users = useBoardStore(useShallow((s) => s.users));
  const nomById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.nom])) as Record<string, string>,
    [users],
  );
  const initialesById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.initiales])) as Record<string, string>,
    [users],
  );

  const [bareme, setBareme] = useState<Bareme>({});
  const [baremeInitial, setBaremeInitial] = useState<Bareme>({});
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  const [seances, setSeances] = useState<SeanceJetons[]>([]);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [paiementBusy, setPaiementBusy] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [recherche, setRecherche] = useState("");

  const charger = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([fetchBareme(), fetchJetonsParSeance()]);
      setBareme(b);
      setBaremeInitial(b);
      setSeances(s);
    } catch {
      toast.error("Chargement des paramètres impossible");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const modifie = useMemo(
    () => TYPES_BAREME.some(({ type }) => bareme[type] !== baremeInitial[type]),
    [bareme, baremeInitial],
  );

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      await saveBareme(TYPES_BAREME.map(({ type }) => ({ type, montant: bareme[type] ?? 0 })));
      setBaremeInitial(bareme);
      toast.success("Barème enregistré", {
        description: "Il s'appliquera aux séances clôturées à partir de maintenant.",
      });
    } catch {
      toast.error("Enregistrement du barème impossible");
    } finally {
      setEnregistrement(false);
    }
  };

  const valider = async (reunionId: string, userIds?: string[]) => {
    setPaiementBusy(userIds ? `${reunionId}:${userIds[0]}` : reunionId);
    try {
      const n = await validerPaiementJetons(reunionId, userIds);
      setSeances(await fetchJetonsParSeance());
      toast.success(n === 0 ? "Aucun jeton à payer" : `${n} jeton(s) marqué(s) comme payé(s)`, {
        description: n > 0 ? "Les membres concernés ont été notifiés." : undefined,
      });
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Validation du paiement impossible";
      toast.error(message);
    } finally {
      setPaiementBusy(null);
    }
  };

  const totaux = useMemo(
    () =>
      seances.reduce(
        (a, s) => ({
          du: a.du + s.total,
          paye: a.paye + s.totalPaye,
          attente: a.attente + s.totalAttente,
          nbAttente: a.nbAttente + s.nbAttente,
        }),
        { du: 0, paye: 0, attente: 0, nbAttente: 0 },
      ),
    [seances],
  );

  const pctPaye = totaux.du ? Math.round((totaux.paye / totaux.du) * 100) : 100;

  const seancesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return seances
      .filter((s) =>
        filtre === "attente" ? s.nbAttente > 0 : filtre === "payes" ? s.nbAttente === 0 : true,
      )
      .filter((s) => !q || s.titre.toLowerCase().includes(q) || dateFr(s.date).includes(q));
  }, [seances, filtre, recherche]);

  const seanceOuverte = seances.find((s) => s.reunionId === ouverte) ?? null;

  if (chargement) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des paramètres…
      </div>
    );
  }

  const FILTRES: { key: Filtre; label: string; n: number }[] = [
    { key: "tous", label: "Toutes", n: seances.length },
    { key: "attente", label: "En attente", n: seances.filter((s) => s.nbAttente > 0).length },
    { key: "payes", label: "Soldées", n: seances.filter((s) => s.nbAttente === 0).length },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-bold text-navy">Barème & paiements</h2>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
          Le volet opérationnel : la valeur du jeton par type de séance, et le règlement des jetons
          dus aux administrateurs (toutes séances clôturées confondues).
        </p>
      </div>

      {/* État des paiements : deux chiffres, dont le seul qui appelle une action —
          le montant en attente — porte l'accent or. Les totaux annuels et le nombre
          d'administrateurs ne sont PAS répétés ici : ils vivent dans la vue d'ensemble. */}
      <StatStrip className="sm:grid-cols-2">
        <StatTile
          rang={0}
          label="Déjà payés"
          valeur={totaux.paye}
          format={formatFCFA}
          detail={`${pctPaye} % des jetons dus versés`}
          jauge={pctPaye}
          ton="emerald"
        />
        <StatTile
          rang={1}
          label="En attente de versement"
          valeur={totaux.attente}
          format={formatFCFA}
          detail={
            totaux.nbAttente > 0
              ? `${totaux.nbAttente} jeton(s) à valider · ${seances.length} séance(s)`
              : "Tout est réglé à ce jour"
          }
          // En attente = argent dû non versé : rose quand il y en a, neutre sinon.
          ton={totaux.nbAttente > 0 ? "rose" : "navy"}
        />
      </StatStrip>

      {/* ─── Barème : un montant par type de séance ───────────────── */}
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-navy">Barème des jetons de présence</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Montant versé à un administrateur qui a participé à la séance, quelle qu'en soit la
              forme. Un absent ne perçoit rien. Le barème est figé dans le jeton à la clôture : le
              modifier ne change pas les séances déjà closes.
            </p>
          </div>
          <button
            onClick={enregistrer}
            disabled={!modifie || enregistrement}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {enregistrement ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer le barème
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {TYPES_BAREME.map(({ type, label, aide }) => {
            const change = bareme[type] !== baremeInitial[type];
            return (
              <label
                key={type}
                className={`block rounded-xl border bg-card p-5 transition ${
                  change ? "border-gold" : "border-border"
                }`}
              >
                <h3 className="text-sm font-semibold text-navy">{label}</h3>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{aide}</p>

                <div className="relative mt-4">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    aria-label={`Jeton de présence — ${label} (FCFA)`}
                    value={bareme[type] ?? 0}
                    onChange={(e) =>
                      setBareme((b) => ({
                        ...b,
                        [type]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded-lg border border-border bg-white py-2.5 pl-3.5 pr-16 text-lg font-semibold tabular-nums text-navy transition focus:outline-none focus-visible:border-gold focus-visible:ring-1 focus-visible:ring-gold"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                    FCFA
                  </span>
                </div>

                <div className="mt-2 h-4 text-[13px] text-muted-foreground">
                  {change ? `Modifié — était ${formatFCFA(baremeInitial[type] ?? 0)}` : ""}
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* ─── Paiements ────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-navy">Validation des paiements</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              À la clôture d'une séance, chaque administrateur reçoit son jeton « en attente de
              paiement ». Confirmez ici le versement : le membre est notifié et son jeton passe à «
              payé ».
            </p>
          </div>

          {seances.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Filtrer les séances"
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/50 p-1"
              >
                {FILTRES.map((f) => {
                  const active = filtre === f.key;
                  return (
                    <button
                      key={f.key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFiltre(f.key)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                        active
                          ? "bg-navy text-white shadow-sm"
                          : "text-muted-foreground hover:bg-background hover:text-navy"
                      }`}
                    >
                      {f.label}
                      <span
                        className={`rounded-full px-1.5 py-px text-[12px] font-bold tabular-nums ${
                          active ? "bg-white/15 text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {f.n}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="relative w-52">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher une séance…"
                  aria-label="Rechercher une séance"
                  className="w-full rounded-xl border border-border bg-card py-2 pl-8 pr-3 text-xs text-navy focus:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/25"
                />
              </div>
            </div>
          )}
        </div>

        {seancesFiltrees.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <div className="text-sm font-semibold text-navy">
              {seances.length === 0 ? "Aucun jeton à ce jour" : "Aucune séance ne correspond"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {seances.length === 0
                ? "Les jetons sont générés à la clôture d'une séance."
                : "Changez de filtre ou effacez la recherche."}
            </div>
          </div>
        ) : (
          /* Une ligne par séance : le regard descend une colonne de montants au
             lieu de sauter d'une carte colorée à l'autre. */
          <ul className="mt-5 divide-y divide-border rounded-xl border border-border bg-card">
            {seancesFiltrees.map((s) => {
              const solde = s.nbAttente === 0;
              const beneficiaires = s.lignes.filter((l) => l.montant > 0);
              const payes = beneficiaires.filter((l) => l.paye).length;
              return (
                <li
                  key={s.reunionId}
                  className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 transition hover:bg-muted/40"
                >
                  <div className="min-w-[220px] flex-1">
                    <div className="font-semibold leading-snug text-navy">{s.titre}</div>
                    <div className="mt-0.5 text-[13px] text-muted-foreground">
                      {typeMeta(s.type).label} · {dateFr(s.date)} · {beneficiaires.length}{" "}
                      bénéficiaire(s)
                    </div>
                  </div>

                  <div className="w-36 shrink-0">
                    <div className="font-mono text-base font-semibold tabular-nums text-navy">
                      {formatFCFA(s.total)}
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted-foreground">
                      {payes}/{beneficiaires.length} payé(s)
                    </div>
                  </div>

                  <div className="w-40 shrink-0 text-[14px]">
                    {solde ? (
                      <span className="text-muted-foreground">Soldée</span>
                    ) : (
                      <span className="font-medium text-navy">
                        {formatFCFA(s.totalAttente)} en attente
                      </span>
                    )}
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    <button
                      onClick={() => setOuverte(s.reunionId)}
                      className="rounded text-xs font-medium text-muted-foreground underline-offset-4 transition hover:text-navy hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      Détail par membre
                    </button>
                    {!solde && (
                      <button
                        onClick={() => valider(s.reunionId)}
                        disabled={paiementBusy === s.reunionId}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-muted disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      >
                        {paiementBusy === s.reunionId && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        Tout valider
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Détail d'une séance : la grille des bénéficiaires, membre par membre. */}
      <Dialog open={!!seanceOuverte} onOpenChange={(o) => !o && setOuverte(null)}>
        <DialogContent className="max-w-3xl">
          {seanceOuverte && (
            <>
              <DialogHeader>
                <DialogTitle>{seanceOuverte.titre}</DialogTitle>
                <DialogDescription>
                  {dateFr(seanceOuverte.date)} · {typeMeta(seanceOuverte.type).label} ·{" "}
                  {formatFCFA(seanceOuverte.total)} au total
                  {seanceOuverte.nbAttente > 0
                    ? ` · ${formatFCFA(seanceOuverte.totalAttente)} en attente`
                    : " · intégralement payée"}
                </DialogDescription>
              </DialogHeader>

              <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {seanceOuverte.lignes.map((l) => {
                  const busy = paiementBusy === `${seanceOuverte.reunionId}:${l.userId}`;
                  const rien = l.montant === 0;
                  return (
                    <div
                      key={l.id}
                      className={`rounded-xl border border-border p-3.5 ${
                        rien ? "bg-muted/30" : "bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-gold">
                          {initialesById[l.userId] ?? "—"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-navy">
                            {nomById[l.userId] ?? "Administrateur"}
                          </div>
                          <div className="text-[13px] text-muted-foreground">
                            {MODE_LABEL[l.mode] ?? l.mode}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-navy">
                          {formatFCFA(l.montant)}
                        </span>
                      </div>

                      <div className="mt-3">
                        {rien ? (
                          <span className="text-[13px] text-muted-foreground">
                            Absent — aucun jeton dû
                          </span>
                        ) : l.paye ? (
                          <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Payé
                            {l.payeAt
                              ? ` le ${new Date(l.payeAt).toLocaleDateString("fr-FR")}`
                              : ""}
                          </span>
                        ) : (
                          <button
                            onClick={() => valider(seanceOuverte.reunionId, [l.userId])}
                            disabled={busy}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[13px] font-semibold text-navy transition hover:bg-muted disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                          >
                            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Valider le paiement
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {seanceOuverte.nbAttente > 0 && (
                <button
                  onClick={() => valider(seanceOuverte.reunionId)}
                  disabled={paiementBusy === seanceOuverte.reunionId}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
                >
                  {paiementBusy === seanceOuverte.reunionId && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Valider les {seanceOuverte.nbAttente} paiements restants (
                  {formatFCFA(seanceOuverte.totalAttente)})
                </button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
