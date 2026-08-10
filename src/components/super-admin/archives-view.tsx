import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Crown,
  ShieldCheck,
  ShieldAlert,
  CalendarDays,
  MapPin,
  Users,
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
  ClipboardList,
  QrCode,
  Vote,
  Send,
  ListChecks,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  MinusCircle,
  MonitorSmartphone,
  UserCheck,
  Clock,
  Copy,
  FileSignature,
} from "lucide-react";
import {
  fetchCartesReunions,
  fetchDossierReunion,
  type CarteReunion,
  type DossierReunion,
} from "@/lib/archive-reunion";
import { typeMeta, statutMeta, dateFr, datePartsFr } from "@/lib/reunion-visuals";
import { exporterCsv, exporterPdf, type TableauExport } from "@/lib/archive-export";
import { KpiTiles } from "./kpi-tiles";
import { toast } from "sonner";
import { htmlVersTexte } from "@/lib/pv-format";

type Volet = "pv" | "emargement" | "votes" | "convocations" | "actions";

const VOLETS: { key: Volet; label: string; icon: typeof ClipboardList }[] = [
  { key: "pv", label: "Procès-verbal", icon: ClipboardList },
  { key: "emargement", label: "Émargement & Quorum", icon: QrCode },
  { key: "votes", label: "Votes électroniques", icon: Vote },
  { key: "convocations", label: "Convocations", icon: Send },
  { key: "actions", label: "Actions & Suivi", icon: ListChecks },
];

const MODE_LABEL: Record<string, string> = {
  presentiel: "Présentiel",
  distance: "À distance",
  procuration: "Procuration",
};
// Méthodes de signature du domaine (voir PVSignScreen côté mobile).
const METHODE_LABEL: Record<string, string> = {
  trace: "Signature manuscrite",
  otp: "Code à usage unique (OTP)",
  biometrie: "Biométrie",
};

const CONVOC_LABEL: Record<string, string> = {
  sent: "Sans réponse",
  pending: "Sans réponse",
  opened: "Ouverte, sans réponse",
  confirmed: "Présence confirmée",
  excused: "Excusé",
};

const frDateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR") : "—");

/**
 * Archives Super Admin — un seul point d'entrée : la séance.
 *
 * Avant, chaque production du Conseil (PV, émargement, votes, convocations, actions)
 * avait son propre onglet et sa propre table : pour reconstituer UNE séance, il fallait
 * ouvrir cinq écrans et recroiser les lignes à la main. Ici, la grille liste les séances
 * tenues, et tout ce qu'une séance a produit vit à l'intérieur d'elle.
 */
export function ArchivesPanel() {
  const [cartes, setCartes] = useState<CarteReunion[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    fetchCartesReunions()
      .then((c) => !annule && setCartes(c))
      .catch(() => !annule && setCartes([]))
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, []);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return cartes.filter(
      (c) =>
        !q ||
        c.titre.toLowerCase().includes(q) ||
        (c.lieu ?? "").toLowerCase().includes(q) ||
        dateFr(c.date).toLowerCase().includes(q),
    );
  }, [cartes, recherche]);

  if (ouverte) {
    return <DossierSeance reunionId={ouverte} onRetour={() => setOuverte(null)} />;
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-red-600">
          <Archive className="h-3.5 w-3.5" /> Archives · lecture seule
        </div>
        <h1 className="mt-1 text-3xl font-bold text-navy">Réunions</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Historique probant des séances tenues. Ouvrez une séance pour retrouver, réunis sous elle,
          son procès-verbal, son émargement, ses scrutins, ses convocations et ses actions.
        </p>
      </header>

      <KpiTiles
        tuiles={[
          { label: "Séances tenues", valeur: cartes.length, ton: "navy" },
          {
            label: "PV scellés",
            valeur: cartes.filter((c) => c.pvScelle).length,
            hint: `${cartes.filter((c) => !c.pvScelle).length} sans PV scellé`,
            ton: "emerald",
          },
          {
            label: "Scrutins tenus",
            valeur: cartes.reduce((s, c) => s + c.votes, 0),
            ton: "gold",
          },
          {
            label: "Participations",
            valeur: cartes.reduce((s, c) => s + c.presents, 0),
            hint: "présences cumulées",
            ton: "slate",
          },
        ]}
      />

      {cartes.length > 0 && (
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une séance…"
            aria-label="Rechercher une séance"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-navy focus:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/25"
          />
        </div>
      )}

      {chargement ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : liste.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Archive className="h-6 w-6 text-slate-400" />
          </div>
          <div className="mt-4 text-sm font-semibold text-navy">
            {cartes.length === 0 ? "Aucune séance archivée" : "Aucune séance ne correspond"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {cartes.length === 0
              ? "Une réunion rejoint les archives dès qu'elle est clôturée."
              : "Essayez un autre titre, un lieu ou une date."}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {liste.map((c) => {
            const ty = typeMeta(c.type);
            const p = datePartsFr(c.date);
            const quorum = c.presents >= c.quorumRequis;
            return (
              <button
                key={c.id}
                onClick={() => setOuverte(c.id)}
                aria-label={`Ouvrir le dossier de ${c.titre}`}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${ty.halo}`}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ backgroundColor: ty.couleur }}
                  aria-hidden="true"
                />

                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${ty.tuile}`}
                  >
                    <span className="text-lg font-bold leading-none tabular-nums">{p.jour}</span>
                    <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-90">
                      {p.mois}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ${ty.chip}`}
                      >
                        {ty.label}
                      </span>
                      {c.pvScelle ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <ShieldCheck className="h-3 w-3" /> PV scellé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-200">
                          <Clock className="h-3 w-3" /> PV à sceller
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 line-clamp-2 font-bold leading-snug text-navy">
                      {c.titre}
                    </h2>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{c.lieu ?? "Lieu non renseigné"}</span>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-muted/50 p-2.5 text-center">
                  <Stat valeur={c.presents} label="Présents" />
                  <Stat valeur={c.pointsOJ} label="Points OJ" />
                  <Stat valeur={c.votes} label="Scrutins" />
                  <Stat valeur={c.actions} label="Actions" />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[13px] font-semibold ${quorum ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {quorum ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                    Quorum {quorum ? "atteint" : "non atteint"} ({c.presents}/{c.quorumRequis})
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all group-hover:bg-navy group-hover:text-gold">
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ valeur, label }: { valeur: number; label: string }) {
  return (
    <div>
      <div className="font-mono text-base font-bold tabular-nums text-navy">{valeur}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

// ─── Le dossier d'une séance ──────────────────────────────────────

function DossierSeance({ reunionId, onRetour }: { reunionId: string; onRetour: () => void }) {
  const [dossier, setDossier] = useState<DossierReunion | null>(null);
  const [chargement, setChargement] = useState(true);
  const [volet, setVolet] = useState<Volet>("pv");

  const charger = useCallback(() => {
    setChargement(true);
    fetchDossierReunion(reunionId)
      .then(setDossier)
      .catch(() => setDossier(null))
      .finally(() => setChargement(false));
  }, [reunionId]);

  useEffect(charger, [charger]);

  if (chargement) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Chargement du dossier de séance…
      </div>
    );
  }
  if (!dossier) {
    return (
      <div className="space-y-4">
        <Retour onRetour={onRetour} />
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Séance introuvable.
        </div>
      </div>
    );
  }

  const ty = typeMeta(dossier.type);
  const st = statutMeta("terminee");
  const presents = dossier.presences.length;
  const quorum = presents >= dossier.quorumRequis;

  return (
    <div className="space-y-6">
      {/* Contexte collant : on sait toujours quelle séance on lit. */}
      <div className="sticky top-0 z-20 -mx-8 border-b border-border/70 bg-background/85 px-8 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Retour onRetour={onRetour} />
          <span className="h-5 w-px bg-border" aria-hidden="true" />
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: ty.couleur }}
            aria-hidden="true"
          />
          <span className="max-w-[42ch] truncate font-semibold text-navy">{dossier.titre}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ${ty.chip}`}
          >
            {ty.label}
          </span>
          {st && (
            <span
              className={`rounded-full px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wider ${st.chip}`}
            >
              {st.label}
            </span>
          )}
          <span className="ml-auto hidden items-center gap-3 text-xs text-muted-foreground lg:flex">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> {dateFr(dossier.date)}
              {dossier.heure ? ` · ${dossier.heure}` : ""}
            </span>
            {dossier.lieu && (
              <span className="inline-flex max-w-[28ch] items-center gap-1.5 truncate">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {dossier.lieu}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Synthèse de la séance : les chiffres avant le détail. */}
      <KpiTiles
        tuiles={[
          {
            label: "Présents",
            valeur: presents,
            hint: `quorum requis : ${dossier.quorumRequis}`,
            ton: quorum ? "emerald" : "rose",
          },
          {
            label: "Points délibérés",
            valeur: dossier.ordreDuJour.length,
            hint: "ordre du jour",
            ton: "navy",
          },
          {
            label: "Scrutins",
            valeur: dossier.votes.length,
            hint: `${dossier.votes.filter((v) => v.resultat === "adoptee").length} adoptée(s)`,
            ton: "gold",
          },
          {
            label: "Actions",
            valeur: dossier.actions.length,
            hint: `${dossier.actions.filter((a) => a.statut === "terminee").length} clôturée(s)`,
            ton: "slate",
          },
        ]}
      />

      <div
        role="tablist"
        aria-label="Volets du dossier de séance"
        className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/50 p-1"
      >
        {VOLETS.map((v) => {
          const active = volet === v.key;
          return (
            <button
              key={v.key}
              role="tab"
              aria-selected={active}
              onClick={() => setVolet(v.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                active
                  ? "bg-navy text-white shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-navy"
              }`}
            >
              <v.icon className={`h-4 w-4 ${active ? "text-gold" : ""}`} aria-hidden="true" />
              {v.label}
            </button>
          );
        })}
      </div>

      <div className="animate-in fade-in-0 duration-200">
        {volet === "pv" && <VoletPv dossier={dossier} />}
        {volet === "emargement" && <VoletEmargement dossier={dossier} />}
        {volet === "votes" && <VoletVotes dossier={dossier} />}
        {volet === "convocations" && <VoletConvocations dossier={dossier} />}
        {volet === "actions" && <VoletActions dossier={dossier} />}
      </div>
    </div>
  );
}

function Retour({ onRetour }: { onRetour: () => void }) {
  return (
    <button
      onClick={onRetour}
      className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition hover:border-gold/50 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      Réunions
    </button>
  );
}

function Carte({
  titre,
  sousTitre,
  actions,
  children,
}: {
  titre: string;
  sousTitre?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-bold text-navy">{titre}</h2>
          {sousTitre && <p className="text-xs text-muted-foreground">{sousTitre}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Exports({ tableau }: { tableau: () => TableauExport }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exporterCsv(tableau())}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-navy transition hover:bg-muted"
      >
        <Download className="h-3.5 w-3.5" /> CSV
      </button>
      <button
        onClick={() => exporterPdf(tableau())}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-navy transition hover:bg-muted"
      >
        <FileText className="h-3.5 w-3.5" /> PDF
      </button>
    </div>
  );
}

function Vide({ texte }: { texte: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{texte}</div>;
}

// ── Procès-verbal ────────────────────────────────────────────────
function VoletPv({ dossier }: { dossier: DossierReunion }) {
  const pv = dossier.pv;
  const copier = async () => {
    if (!pv?.hash) return;
    await navigator.clipboard.writeText(pv.hash);
    toast.success("Empreinte copiée");
  };

  if (!pv) {
    return (
      <Carte titre="Procès-verbal">
        <Vide texte="Aucun procès-verbal pour cette séance." />
      </Carte>
    );
  }

  const scelle = pv.statut === "signe" || pv.statut === "archive";
  const pca = pv.signatures.find((s) => s.estPresidentCA);

  return (
    <div className="space-y-5">
      <Carte
        titre="Procès-verbal"
        sousTitre={
          scelle
            ? "Scellé — le document ne peut plus être modifié"
            : "En cours de signature — non encore scellé"
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Champ label="État">
            {scelle ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" /> {pv.statut === "archive" ? "Archivé" : "Scellé"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                <Clock className="h-4 w-4" /> En signature
              </span>
            )}
          </Champ>
          <Champ label="Sceau du PCA">
            {pca ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-navy">
                <Crown className="h-4 w-4 text-gold" /> {pca.nom}
              </span>
            ) : (
              <span className="text-muted-foreground">Non signé</span>
            )}
          </Champ>
          <Champ label="Archivé le">{frDateHeure(pv.archiveAt)}</Champ>
        </div>

        <div className="mt-4">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Empreinte SHA-256 du document
          </div>
          {pv.hash ? (
            <button
              onClick={copier}
              title="Copier l'empreinte"
              className="group mt-1 inline-flex max-w-full items-center gap-2 rounded-lg bg-navy/5 px-3 py-2 font-mono text-[14px] text-navy transition hover:bg-navy/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="break-all text-left">{pv.hash}</span>
              <Copy className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">—</div>
          )}
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Toute modification d'un seul caractère du PV changerait cette empreinte : elle prouve
            l'intégrité du document scellé.
          </p>
        </div>
      </Carte>

      <Carte
        titre="Signatures électroniques"
        sousTitre={`${pv.signatures.length} signature(s) — le PCA scelle, les membres approuvent`}
      >
        {pv.signatures.length === 0 ? (
          <Vide texte="Aucune signature enregistrée." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pv.signatures.map((s, i) => (
              <div
                key={`${s.nom}-${i}`}
                className={`overflow-hidden rounded-xl border ${s.estPresidentCA ? "border-gold/40 bg-gold/5" : "border-border bg-muted/30"}`}
              >
                {/* Fac-similé de la signature manuscrite tracée par le signataire.
                    Absent si la signature a été donnée par OTP ou par biométrie. */}
                {s.imageBase64 ? (
                  <div className="flex h-20 items-center justify-center border-b border-border bg-white">
                    <img
                      src={s.imageBase64}
                      alt={`Signature manuscrite de ${s.nom}`}
                      className="h-16 object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 flex-col items-center justify-center gap-1 border-b border-border bg-white text-muted-foreground">
                    <FileSignature className="h-5 w-5" />
                    <span className="text-[12px] uppercase tracking-wider">
                      {METHODE_LABEL[s.methode] ?? s.methode}
                    </span>
                  </div>
                )}

                <div className="p-3">
                  <div className="flex items-center gap-2">
                    {s.estPresidentCA ? (
                      <Crown className="h-4 w-4 shrink-0 text-gold" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                    <span className="truncate text-sm font-semibold text-navy">{s.nom}</span>
                  </div>
                  <div className="mt-1 text-[13px] text-muted-foreground">
                    {s.estPresidentCA ? "Sceau du Président" : "Approbation"} ·{" "}
                    {METHODE_LABEL[s.methode] ?? s.methode}
                  </div>
                  <div className="text-[13px] text-muted-foreground">{frDateHeure(s.signedAt)}</div>
                  {s.hash && (
                    <div
                      className="mt-1.5 truncate font-mono text-[12px] text-muted-foreground"
                      title={s.hash}
                    >
                      {s.hash.slice(0, 24)}…
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {pv.contenu && (
        <Carte titre="Texte du procès-verbal" sousTitre="Contenu scellé, en lecture seule">
          {/* Le PV est rédigé en HTML (éditeur riche) : on l'aplatit en texte structuré
              plutôt que d'injecter du balisage venu de la base dans la page. */}
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-4 font-mono text-[14px] leading-relaxed text-navy">
            {htmlVersTexte(pv.contenu ?? "")}
          </pre>
        </Carte>
      )}
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm text-navy">{children}</div>
    </div>
  );
}

// ── Émargement & Quorum ──────────────────────────────────────────
function VoletEmargement({ dossier }: { dossier: DossierReunion }) {
  const presentiel = dossier.presences.filter((p) => p.mode === "presentiel");
  const distance = dossier.presences.filter((p) => p.mode === "distance");
  const procuration = dossier.presences.filter((p) => p.mode === "procuration");
  const presents = dossier.presences.length;
  const quorum = presents >= dossier.quorumRequis;
  const pct = Math.min(100, Math.round((presents / Math.max(dossier.quorumRequis, 1)) * 100));

  // Absents : convoqués sans ligne de présence (une absence = absence de ligne).
  const emarges = new Set(dossier.presences.map((p) => p.userId));
  const absents = dossier.convocations.filter((c) => !emarges.has(c.userId));

  const tableau = (): TableauExport => ({
    titre: `Émargement — ${dossier.titre}`,
    sousTitre: `${dateFr(dossier.date)} · ${presents}/${dossier.quorumRequis} · quorum ${quorum ? "atteint" : "non atteint"}`,
    entetes: ["Membre", "Présence", "Procuration à"],
    lignes: [
      ...dossier.presences.map((p) => [p.nom, MODE_LABEL[p.mode] ?? p.mode, p.procurationA ?? "—"]),
      ...absents.map((a) => [a.nom, a.statut === "excused" ? "Excusé" : "Absent", "—"]),
    ],
  });

  return (
    <div className="space-y-5">
      <Carte
        titre="Quorum"
        sousTitre="Les procurations comptent dans le quorum"
        actions={<Exports tableau={tableau} />}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="font-mono text-3xl font-bold tabular-nums text-navy">
            {presents}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              / {dossier.quorumRequis} requis
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              quorum ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            }`}
          >
            {quorum ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            {quorum ? "Quorum atteint" : "Quorum non atteint"}
          </span>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all ${quorum ? "bg-emerald-500" : "bg-red-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Compteur icon={UserCheck} n={presentiel.length} label="Présentiel" ton="emerald" />
          <Compteur icon={MonitorSmartphone} n={distance.length} label="À distance" ton="sky" />
          <Compteur icon={Send} n={procuration.length} label="Procuration" ton="amber" />
          <Compteur icon={Users} n={absents.length} label="Absents" ton="slate" />
        </div>
      </Carte>

      <Carte titre="Feuille de présence" sousTitre="Nominative, telle qu'émargée en séance">
        {presents === 0 && absents.length === 0 ? (
          <Vide texte="Aucun émargement enregistré." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dossier.presences.map((p) => (
              <div
                key={p.userId}
                className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3"
              >
                <div className="truncate text-sm font-semibold text-navy">{p.nom}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">
                  {MODE_LABEL[p.mode] ?? p.mode}
                  {p.procurationA ? ` · donnée à ${p.procurationA}` : ""}
                </div>
              </div>
            ))}
            {absents.map((a) => (
              <div key={a.userId} className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="truncate text-sm font-semibold text-navy">{a.nom}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">
                  {a.statut === "excused" ? "Excusé" : "Absent"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>
    </div>
  );
}

function Compteur({
  icon: Icon,
  n,
  label,
  ton,
}: {
  icon: typeof Users;
  n: number;
  label: string;
  ton: "emerald" | "sky" | "amber" | "slate";
}) {
  const tons = {
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-muted text-muted-foreground",
  };
  return (
    <div className={`rounded-xl p-3 ${tons[ton]}`}>
      <Icon className="h-4 w-4" />
      <div className="mt-1.5 font-mono text-xl font-bold tabular-nums">{n}</div>
      <div className="text-[13px] opacity-80">{label}</div>
    </div>
  );
}

// ── Votes électroniques ──────────────────────────────────────────
function VoletVotes({ dossier }: { dossier: DossierReunion }) {
  const tableau = (): TableauExport => ({
    titre: `Votes — ${dossier.titre}`,
    sousTitre: `${dateFr(dossier.date)} · ${dossier.votes.length} scrutin(s)`,
    entetes: ["Résolution", "Intitulé", "Oui", "Non", "Abstention", "Bulletins", "Résultat"],
    lignes: dossier.votes.map((v) => [
      v.resolutionCode ?? "—",
      v.intitule,
      String(v.oui),
      String(v.non),
      String(v.abstention),
      String(v.bulletins),
      v.resultat === "adoptee" ? "ADOPTÉE" : v.resultat === "rejetee" ? "REJETÉE" : v.statut,
    ]),
  });

  if (dossier.votes.length === 0) {
    return (
      <Carte titre="Votes électroniques">
        <Vide texte="Aucun scrutin tenu pendant cette séance." />
      </Carte>
    );
  }

  return (
    <Carte
      titre="Votes électroniques"
      sousTitre={`${dossier.votes.length} scrutin(s) · ${dossier.votes.filter((v) => v.resultat === "adoptee").length} adoptée(s)`}
      actions={<Exports tableau={tableau} />}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {dossier.votes.map((v) => {
          const adoptee = v.resultat === "adoptee";
          const rejetee = v.resultat === "rejetee";
          const pct = (n: number) => (v.bulletins ? (n / v.bulletins) * 100 : 0);
          return (
            <div
              key={v.id}
              className={`rounded-2xl border p-4 ${
                adoptee
                  ? "border-l-4 border-l-emerald-500 border-border"
                  : rejetee
                    ? "border-l-4 border-l-rose-500 border-border"
                    : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {v.resolutionCode && (
                    <span className="rounded bg-navy/5 px-1.5 py-0.5 font-mono text-[12px] font-bold text-navy">
                      {v.resolutionCode}
                    </span>
                  )}
                  <h3 className="mt-1.5 font-semibold leading-snug text-navy">{v.intitule}</h3>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                    adoptee
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : rejetee
                        ? "bg-rose-50 text-rose-700 ring-rose-200"
                        : "bg-muted text-muted-foreground ring-border"
                  }`}
                >
                  {adoptee ? "Adoptée" : rejetee ? "Rejetée" : v.statut}
                </span>
              </div>

              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
                {v.oui > 0 && (
                  <div style={{ width: `${pct(v.oui)}%`, backgroundColor: "#10B981" }} />
                )}
                {v.non > 0 && (
                  <div style={{ width: `${pct(v.non)}%`, backgroundColor: "#F43F5E" }} />
                )}
                {v.abstention > 0 && (
                  <div style={{ width: `${pct(v.abstention)}%`, backgroundColor: "#94A3B8" }} />
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <b className="tabular-nums text-navy">{v.oui}</b>{" "}
                  <span className="text-muted-foreground">Oui</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <b className="tabular-nums text-navy">{v.non}</b>{" "}
                  <span className="text-muted-foreground">Non</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MinusCircle className="h-4 w-4 text-slate-500" />
                  <b className="tabular-nums text-navy">{v.abstention}</b>{" "}
                  <span className="text-muted-foreground">Abst.</span>
                </span>
                <span className="ml-auto text-muted-foreground">
                  {v.bulletins} bulletin(s) · clos le {frDateHeure(v.closAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Carte>
  );
}

// ── Convocations ─────────────────────────────────────────────────
function VoletConvocations({ dossier }: { dossier: DossierReunion }) {
  const c = dossier.convocations;
  const confirmees = c.filter((x) => x.statut === "confirmed").length;
  const excusees = c.filter((x) => x.statut === "excused").length;
  const sansReponse = c.length - confirmees - excusees;
  const taux = c.length ? Math.round(((confirmees + excusees) / c.length) * 100) : 0;

  const tableau = (): TableauExport => ({
    titre: `Convocations — ${dossier.titre}`,
    sousTitre: `${dateFr(dossier.date)} · ${c.length} convocation(s) · ${taux} % de réponse`,
    entetes: ["Membre", "Réponse"],
    lignes: c.map((x) => [x.nom, CONVOC_LABEL[x.statut] ?? x.statut]),
  });

  if (c.length === 0) {
    return (
      <Carte titre="Convocations">
        <Vide texte="Aucune convocation archivée pour cette séance." />
      </Carte>
    );
  }

  return (
    <Carte
      titre="Convocations"
      sousTitre={`${c.length} membre(s) convoqué(s) · ${taux} % de réponse`}
      actions={<Exports tableau={tableau} />}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Compteur icon={Send} n={c.length} label="Émises" ton="slate" />
        <Compteur icon={CheckCircle2} n={confirmees} label="Confirmées" ton="emerald" />
        <Compteur icon={MinusCircle} n={excusees} label="Excusés" ton="amber" />
        <Compteur icon={Clock} n={sansReponse} label="Sans réponse" ton="sky" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {c.map((x) => {
          const ok = x.statut === "confirmed";
          const excuse = x.statut === "excused";
          return (
            <div
              key={x.userId}
              className={`rounded-xl border p-3 ${
                ok
                  ? "border-emerald-200 bg-emerald-50/40"
                  : excuse
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-border bg-muted/30"
              }`}
            >
              <div className="truncate text-sm font-semibold text-navy">{x.nom}</div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">
                {CONVOC_LABEL[x.statut] ?? x.statut}
              </div>
            </div>
          );
        })}
      </div>
    </Carte>
  );
}

// ── Actions & Suivi ──────────────────────────────────────────────
function VoletActions({ dossier }: { dossier: DossierReunion }) {
  const a = dossier.actions;
  const tableau = (): TableauExport => ({
    titre: `Actions — ${dossier.titre}`,
    sousTitre: `${dateFr(dossier.date)} · ${a.length} action(s) décidée(s) en séance`,
    entetes: ["Action", "Responsable", "Échéance", "Priorité", "Avancement", "Statut"],
    lignes: a.map((x) => [
      x.titre,
      x.responsable ?? "—",
      x.echeance ? dateFr(x.echeance) : "—",
      x.priorite ?? "—",
      `${x.avancement} %`,
      x.statut,
    ]),
  });

  if (a.length === 0) {
    return (
      <Carte titre="Actions & Suivi">
        <Vide texte="Aucune action n'est née de cette séance." />
      </Carte>
    );
  }

  const STATUT: Record<string, { label: string; classe: string }> = {
    terminee: { label: "Terminée", classe: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    en_cours: { label: "En cours", classe: "bg-sky-50 text-sky-700 ring-sky-200" },
    en_retard: { label: "En retard", classe: "bg-rose-50 text-rose-700 ring-rose-200" },
    a_faire: { label: "À démarrer", classe: "bg-muted text-muted-foreground ring-border" },
  };

  return (
    <Carte
      titre="Actions & Suivi"
      sousTitre={`${a.length} action(s) · ${a.filter((x) => x.statut === "terminee").length} clôturée(s)`}
      actions={<Exports tableau={tableau} />}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {a.map((x) => {
          const st = STATUT[x.statut] ?? STATUT.a_faire;
          return (
            <div key={x.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 font-semibold leading-snug text-navy">{x.titre}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ring-1 ring-inset ${st.classe}`}
                >
                  {st.label}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {x.responsable ?? "Non assignée"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />{" "}
                  {x.echeance ? dateFr(x.echeance) : "Sans échéance"}
                </span>
                {x.priorite && <span className="capitalize">Priorité {x.priorite}</span>}
              </div>
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all ${x.statut === "en_retard" ? "bg-rose-500" : "bg-emerald-500"}`}
                    style={{ width: `${x.avancement}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-[13px] font-semibold tabular-nums text-navy">
                  {x.avancement} %
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Carte>
  );
}
