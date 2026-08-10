// Trois modèles de procès-verbal proposés à la Secrétaire (voir Trame.docx).
//
// Chaque modèle produit du HTML PRÉ-REMPLI avec ce que la base sait déjà : intitulé,
// date, lieu, présidence, présents, procurations, ordre du jour, scrutins, quorum.
// Ce que la base NE sait pas — l'exposé, les débats, les positions exprimées — reste
// marqué `[À rédiger…]` : c'est la part du Secrétaire, et aucune plateforme ne peut
// l'écrire à sa place.
//
// Champs volontairement laissés à compléter faute de donnée en base (voir Trame.docx §B) :
// rapporteur d'un point, date de la séance suivante. L'heure d'ouverture (`reunion.heure`)
// et l'heure de clôture (`reunion.cloutureeAt`, posée par trigger DB à la transition vers
// 'terminee') sont, elles, reprises automatiquement quand la donnée existe.

import type { Reunion, User, Presence, Procuration, Vote } from "@/types/domain";
import { voteTally } from "@/store/selectors";

export type ModelePv = "statutaire" | "synthetique" | "probant";

export const MODELES_PV: {
  cle: ModelePv;
  nom: string;
  sousTitre: string;
  quand: string;
  longueur: string;
}[] = [
  {
    cle: "statutaire",
    nom: "PV Statutaire complet",
    sousTitre: "Modèle de référence",
    quand:
      "Séance ordinaire, ordre du jour à plusieurs points, débats à restituer. C'est le PV qui fait foi vis-à-vis des tiers.",
    longueur: "6 à 15 pages",
  },
  {
    cle: "synthetique",
    nom: "PV Synthétique",
    sousTitre: "Décisionnel",
    quand:
      "Séance extraordinaire, objet unique, urgence. Va droit aux décisions sans restituer les débats — juridiquement suffisant.",
    longueur: "2 à 4 pages",
  },
  {
    cle: "probant",
    nom: "PV Probant",
    sousTitre: "Registre / auditeurs",
    quand:
      "Séance à enjeu (comptes, engagement majeur, contentieux). Chaque affirmation est adossée à une pièce. Destiné aux CAC et aux auditeurs.",
    longueur: "10 à 25 pages",
  },
];

const TYPE_LABEL: Record<string, string> = {
  ca_ordinaire: "Conseil d'Administration ordinaire",
  ca_extraordinaire: "Conseil d'Administration extraordinaire",
  comite: "Comité spécialisé",
};

const MODE_LABEL: Record<string, string> = {
  presentiel: "Présentiel",
  distance: "À distance",
  procuration: "Procuration",
};

const dateLongue = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Heure réelle de clôture (`reunions.cloturee_at`, posée par trigger DB à la
 * transition vers 'terminee') — sinon la séance n'est pas encore close, la
 * mention reste à compléter par le Secrétaire. */
const heureCloture = (c: ContexteP) =>
  c.reunion.cloutureeAt
    ? new Date(c.reunion.cloutureeAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "[à compléter]";

/** Bloc à compléter par le Secrétaire — visuellement distinct dans l'éditeur. */
const aRediger = (quoi: string) => `<p><em>[À rédiger par le Secrétaire — ${esc(quoi)}]</em></p>`;

export type ContexteP = {
  reunion: Reunion;
  presents: User[];
  presences: Presence[];
  procurations: Procuration[];
  usersById: Record<string, User>;
  pca?: User;
  presidentSeance?: User;
  votes: Vote[];
};

const enTete = (c: ContexteP) => {
  const r = c.reunion;
  const president = c.presidentSeance ?? c.pca;
  return `
    <h1>Procès-verbal — ${esc(r.titre)}</h1>
    <p><strong>Nature de la séance :</strong> ${TYPE_LABEL[r.type] ?? r.type}<br>
    <strong>Date :</strong> ${dateLongue(r.date)}<br>
    <strong>Heure d'ouverture :</strong> ${esc(r.heure ?? "[à compléter]")}<br>
    <strong>Heure de clôture :</strong> ${esc(heureCloture(c))}<br>
    <strong>Lieu :</strong> ${esc(r.lieu ?? "[à compléter]")}<br>
    <strong>Présidence de séance :</strong> ${president ? esc(president.nom) : "[à compléter]"}</p>`;
};

const listePresents = (c: ContexteP) => {
  if (c.presents.length === 0) return "<p><em>Aucun émargement enregistré.</em></p>";
  const parUser = Object.fromEntries(c.presences.map((p) => [p.userId, p.mode]));
  const items = c.presents
    .map((u) => {
      const mode = MODE_LABEL[parUser[u.id] ?? ""] ?? "—";
      const qualite = u.estPresidentCA
        ? "Président du Conseil d'Administration"
        : (u.qualite ?? "Administrateur");
      return `<li>${esc(u.nom)} — <em>${esc(qualite)}</em> (${mode})</li>`;
    })
    .join("");
  return `<ul>${items}</ul>`;
};

const listeProcurations = (c: ContexteP) => {
  if (c.procurations.length === 0) return "<p>Aucune procuration n'a été donnée.</p>";
  const items = c.procurations
    .map(
      (p) =>
        `<li>${esc(c.usersById[p.deUserId]?.nom ?? "—")} donne procuration à ${esc(
          c.usersById[p.versUserId]?.nom ?? "—",
        )}</li>`,
    )
    .join("");
  return `<ul>${items}</ul>`;
};

const blocQuorum = (c: ContexteP) => {
  const presents = c.presences.length;
  const requis = c.reunion.quorumRequis;
  const atteint = presents >= requis;
  return `<p>Le quorum statutaire est de <strong>${requis}</strong> administrateurs. Le nombre
    d'administrateurs présents ou représentés étant de <strong>${presents}</strong>, le quorum
    <strong>${atteint ? "est atteint" : "n'est pas atteint"}</strong>. Le Conseil
    ${atteint ? "peut valablement délibérer" : "ne peut pas valablement délibérer"}.</p>`;
};

const ordreDuJour = (c: ContexteP) => {
  const points = [...c.reunion.ordreDuJour].sort((a, b) => a.position - b.position);
  if (points.length === 0) return "<p><em>Aucun point inscrit à l'ordre du jour.</em></p>";
  const items = points
    .map((p) => `<li>${esc(p.titre)}${p.dureeMin ? ` <em>(${p.dureeMin} min)</em>` : ""}</li>`)
    .join("");
  return `<ol>${items}</ol>`;
};

/** Scrutin rattaché à un point, s'il existe — sinon un gabarit vide à compléter.
 * Le résultat se calcule directement depuis les bulletins réels (pondérés par les
 * procurations actives) via `voteTally` — même source de vérité que le
 * décompte secrétariat et mobile. Ne JAMAIS relire la table `resolutions` :
 * elle n'est alimentée par aucun code de l'application (aucun `insert` nulle
 * part), donc systématiquement vide — la lire fait toujours retomber sur
 * « En cours », y compris pour un scrutin clos depuis longtemps. */
const blocVote = (c: ContexteP, index: number) => {
  const vote = c.votes[index];
  if (!vote) {
    return `<p><strong>Décision :</strong> [à compléter]<br>
      <strong>Vote :</strong> Pour … · Contre … · Abstention … — Résultat : …</p>`;
  }
  const t = voteTally(vote, c.procurations);
  const resultat =
    vote.statut !== "clos" ? "En cours" : t.verdict === "adoptee" ? "Adoptée" : "Rejetée";
  return `<p><strong>Résolution n° ${esc(vote.resolutionCode ?? "—")}</strong> — ${esc(vote.intitule)}<br>
    <strong>Vote :</strong> Pour ${t.oui} · Contre ${t.non} · Abstention ${t.abs}
    (${vote.bulletins.length} bulletin(s) exprimé(s)) — <strong>Résultat : ${resultat}</strong></p>`;
};

// ─── Modèle 1 — statutaire complet ────────────────────────────────
function statutaire(c: ContexteP): string {
  const points = [...c.reunion.ordreDuJour].sort((a, b) => a.position - b.position);
  const absents = "";
  const delibs = points
    .map(
      (p, i) => `
      <h3>Point ${i + 1} — ${esc(p.titre)}</h3>
      <p><strong>Exposé</strong></p>
      ${aRediger("qui a présenté, sur la base de quelles pièces du Board Book, quels éléments sont soumis au Conseil")}
      <p><strong>Débats</strong></p>
      ${aRediger("positions exprimées, réserves, demandes de précisions ; consigner nommément toute position dont un administrateur demande l'inscription")}
      <p><strong>Décision</strong></p>
      ${blocVote(c, i)}
      <p><strong>Actions découlant de la décision :</strong> [responsable — échéance]</p>`,
    )
    .join("");

  return `
    ${enTete(c)}
    <h2>1. Présences, procurations et quorum</h2>
    <p><strong>Administrateurs présents ou représentés (${c.presences.length})</strong></p>
    ${listePresents(c)}
    <p><strong>Procurations</strong></p>
    ${listeProcurations(c)}
    ${absents}
    ${blocQuorum(c)}
    <h2>2. Ordre du jour</h2>
    ${ordreDuJour(c)}
    <h2>3. Délibérations</h2>
    ${delibs || aRediger("délibérations, point par point")}
    <h2>4. Questions diverses</h2>
    ${aRediger("ou mentionner : « Aucune question diverse n'a été soulevée. »")}
    <h2>5. Clôture</h2>
    <p>L'ordre du jour étant épuisé et personne ne demandant plus la parole, le Président lève la
      séance à ${esc(heureCloture(c))}. La prochaine séance est fixée au [date].</p>
    <h2>6. Signatures</h2>
    <p>La signature des administrateurs présents vaut approbation du présent procès-verbal ; la
      signature du Président du Conseil d'Administration en constitue le sceau définitif.</p>
    <p><em>Les signatures électroniques sont recueillies dans BoardCA et annexées au PV scellé.</em></p>`;
}

// ─── Modèle 2 — synthétique / décisionnel ─────────────────────────
function synthetique(c: ContexteP): string {
  const presents = c.presences.length;
  const requis = c.reunion.quorumRequis;
  const atteint = presents >= requis;

  const decisions =
    c.votes.length > 0
      ? c.votes.map((_, i) => blocVote(c, i)).join("")
      : `<p>[Énoncer chaque résolution adoptée, avec son décompte de vote.]</p>`;

  // Défaut de quorum : ce n'est plus un PV de délibération, mais un PV de carence.
  const corps = atteint
    ? `
      <h2>3. Décisions adoptées</h2>
      <p>Le Conseil, après examen des éléments qui lui ont été soumis, a adopté les résolutions suivantes :</p>
      ${decisions}
      <h2>4. Actions et responsables</h2>
      <p>[Action — responsable — échéance]</p>
      <h2>5. Clôture</h2>
      <p>Séance levée à ${esc(heureCloture(c))}.</p>`
    : `
      <h2>3. Constat de carence</h2>
      <p>Le quorum statutaire de <strong>${requis}</strong> administrateurs n'étant pas atteint —
        <strong>${presents}</strong> administrateurs présents ou représentés — le Conseil ne peut
        valablement délibérer. En conséquence, le Président lève la séance et la reporte au
        [nouvelle date]. Une nouvelle convocation, portant le même ordre du jour, est adressée à
        l'ensemble des administrateurs.</p>
      <p><em>La feuille de présence constatant le défaut de quorum demeure annexée au présent
        procès-verbal (archivée automatiquement par BoardCA).</em></p>`;

  return `
    ${enTete(c)}
    <h2>1. Objet de la convocation</h2>
    ${aRediger("motif de la convocation extraordinaire")}
    <h2>2. Quorum</h2>
    ${blocQuorum(c)}
    <p><em>Liste nominative des présents et des représentés : voir la feuille d'émargement annexée.</em></p>
    ${corps}
    <h2>6. Signatures</h2>
    <p>Le Président du Conseil d'Administration ${c.pca ? `(${esc(c.pca.nom)}) ` : ""}scelle le
      présent procès-verbal. Le Secrétaire du Conseil en certifie la rédaction.</p>`;
}

// ─── Modèle 3 — probant / registre ────────────────────────────────
function probant(c: ContexteP): string {
  const points = [...c.reunion.ordreDuJour].sort((a, b) => a.position - b.position);
  const delibs = points
    .map(
      (p, i) => `
      <h3>Point ${i + 1} — ${esc(p.titre)}</h3>
      <p><strong>Pièces soumises au Conseil :</strong> [intitulés des pièces du Board Book]<br>
      <strong>Rapporteur :</strong> [à compléter]</p>
      <p><strong>Exposé</strong></p>
      ${aRediger("exposé, en renvoyant aux pièces")}
      <p><strong>Débats et positions exprimées</strong></p>
      ${aRediger("consigner nommément toute position dont un administrateur demande l'inscription")}
      <p><strong>Réserves ou oppositions</strong></p>
      ${aRediger("ou mentionner : « Aucune réserve n'a été formulée. »")}
      <p><strong>Délibération</strong></p>
      ${blocVote(c, i)}`,
    )
    .join("");

  return `
    ${enTete(c)}
    <h2>1. Régularité de la convocation</h2>
    <p>Les administrateurs ont été régulièrement convoqués. Le Board Book de la séance a été mis à
      leur disposition avant la séance. <em>[Compléter : date d'envoi des convocations, nombre de
      convocations émises, confirmations et excuses reçues — chiffres disponibles dans l'onglet
      Convocations.]</em></p>
    <h2>2. Composition de la séance</h2>
    <p><strong>Administrateurs présents ou représentés (${c.presences.length})</strong></p>
    ${listePresents(c)}
    <p><strong>Procurations</strong></p>
    ${listeProcurations(c)}
    ${blocQuorum(c)}
    <p>Le Conseil est régulièrement constitué.</p>
    <h2>3. Ordre du jour</h2>
    ${ordreDuJour(c)}
    <h2>4. Délibérations</h2>
    ${delibs || aRediger("délibérations, point par point")}
    <h2>5. Suivi des décisions</h2>
    <p>[Référence de résolution — action — responsable — échéance]</p>
    <h2>6. Jetons de présence</h2>
    <p>Pour mémoire, les jetons de présence dus au titre de la présente séance sont constatés
      conformément au barème en vigueur et versés après validation du secrétariat.</p>
    <h2>7. Clôture</h2>
    <p>Plus rien n'étant à l'ordre du jour, le Président lève la séance à ${esc(heureCloture(c))}.</p>
    <h2>8. Mentions de valeur probante</h2>
    <p>Le présent procès-verbal est scellé électroniquement. Son empreinte SHA-256, les signatures
      recueillies et leur horodatage sont annexés au document scellé. L'ensemble des actes de la
      séance — convocation, émargement, ouverture et clôture des scrutins, signatures, sceau — est
      horodaté et nominatif dans le journal d'audit de la plateforme.</p>
    <h2>9. Annexes</h2>
    <ul>
      <li>Feuille d'émargement (export BoardCA)</li>
      <li>Board Book de la séance (PDF compilé)</li>
      <li>Feuille de dépouillement de chaque scrutin</li>
      <li>Registre des convocations et des réponses</li>
    </ul>`;
}

export function genererPv(modele: ModelePv, c: ContexteP): string {
  const html =
    modele === "statutaire"
      ? statutaire(c)
      : modele === "synthetique"
        ? synthetique(c)
        : probant(c);
  // L'éditeur n'aime pas les indentations de gabarit : on nettoie les blancs superflus.
  return html.replace(/\n\s+/g, "\n").trim();
}
