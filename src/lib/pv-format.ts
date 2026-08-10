// Le procès-verbal est désormais rédigé en HTML (éditeur riche). Deux besoins en
// découlent, traités ici pour n'avoir qu'une seule implémentation :
//
//  1. Les PV existants sont du TEXTE BRUT. Il faut les rouvrir sans les casser.
//  2. Le PDF (jsPDF) et les écrans d'archive lisent du texte, pas du HTML.
//
// Aucune dépendance : on s'appuie sur le parseur du navigateur (DOMParser), donc ces
// fonctions ne tournent que côté client — ce qui est le cas de tous leurs appelants.

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Un contenu sans balise est un ancien PV en texte brut : on le remonte en HTML. */
export function versHtml(contenu: string): string {
  if (!contenu.trim()) return "";
  if (/<[a-z][\s\S]*>/i.test(contenu)) return contenu;
  return contenu
    .split(/\n{2,}/)
    .map((bloc) => `<p>${echapper(bloc).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// Balises qui referment une ligne : sans ça, tout le PV se collerait en un seul bloc.
const BLOCS = new Set(["P", "DIV", "H1", "H2", "H3", "LI", "BLOCKQUOTE", "TR", "HR", "BR"]);

/**
 * HTML → texte, en préservant la structure du document (titres en majuscules, puces,
 * sauts de ligne). C'est cette forme qui part dans le PDF signé et dans le hash du
 * sceau : le PV probant est un texte, pas un balisage.
 */
export function htmlVersTexte(html: string): string {
  if (!html.trim()) return "";
  if (!/<[a-z][\s\S]*>/i.test(html)) return html; // déjà du texte brut

  const doc = new DOMParser().parseFromString(html, "text/html");
  const lignes: string[] = [];
  let courante = "";

  const pousser = () => {
    lignes.push(courante.replace(/[ \t]+/g, " ").trim());
    courante = "";
  };

  const parcourir = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      courante += n.textContent ?? "";
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;

    const el = n as HTMLElement;
    const tag = el.tagName;

    if (tag === "BR") {
      pousser();
      return;
    }
    if (tag === "HR") {
      pousser();
      lignes.push("─────────────────────────────");
      return;
    }

    const estListe = tag === "LI";
    const estTitre = tag === "H1" || tag === "H2" || tag === "H3";
    const estCellule = tag === "TD" || tag === "TH";

    if (BLOCS.has(tag) && courante.trim()) pousser();
    if (estListe) courante += "  • ";
    // Séparateur entre cellules d'une même ligne de tableau : « a | b | c ».
    if (estCellule && courante.trim()) courante += " | ";

    for (const enfant of Array.from(el.childNodes)) parcourir(enfant);

    if (BLOCS.has(tag)) {
      if (estTitre) courante = courante.toUpperCase();
      pousser();
      // Un titre respire : une ligne vide avant lui, une après.
      if (estTitre) lignes.push("");
    }
  };

  for (const enfant of Array.from(doc.body.childNodes)) parcourir(enfant);
  if (courante.trim()) pousser();

  // Trois lignes vides d'affilée ne servent à rien : on ramène à une.
  return lignes
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Le PV est-il vide ? (une coquille `<p><br></p>` ne compte pas.) */
export function pvEstVide(html: string): boolean {
  return htmlVersTexte(html).trim().length === 0;
}

// Balises autorisées à l'affichage du PV. Tout le reste (script, iframe, on*, style
// exotique…) est retiré : le PV est rendu via innerHTML, donc il DOIT être assaini,
// même si aujourd'hui il n'est produit que par l'éditeur maison.
const BALISES_OK = new Set([
  "P",
  "BR",
  "DIV",
  "SPAN",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "STRIKE",
  "H1",
  "H2",
  "H3",
  "UL",
  "OL",
  "LI",
  "HR",
  "BLOCKQUOTE",
  "TABLE",
  "THEAD",
  "TBODY",
  "TR",
  "TD",
  "TH",
  "FONT", // execCommand("foreColor") produit <font color="…">
]);
// Styles inline conservés : mise en forme + couleurs (texte et surlignage).
const STYLES_OK = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "color",
  "background-color",
]);
// Attributs non-style conservés pour quelques balises (couleur héritée d'execCommand).
const ATTRS_OK = new Set(["color", "colspan", "rowspan"]);

/**
 * Assainit le HTML du PV avant un rendu `dangerouslySetInnerHTML` : ne garde que les
 * balises de mise en forme, purge les attributs (hormis un `style` filtré), et neutralise
 * tout script ou gestionnaire d'événement. Renvoie du HTML sûr à afficher.
 */
export function htmlProtege(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const nettoyer = (el: Element) => {
    for (const enfant of Array.from(el.children)) {
      if (!BALISES_OK.has(enfant.tagName)) {
        // Balise interdite : on la remplace par son contenu texte, on ne le perd pas.
        enfant.replaceWith(...Array.from(enfant.childNodes));
        continue;
      }
      for (const attr of Array.from(enfant.attributes)) {
        if (attr.name === "style") {
          const garde = attr.value
            .split(";")
            .map((d) => d.trim())
            .filter((d) => STYLES_OK.has(d.split(":")[0]?.trim().toLowerCase()))
            .join("; ");
          if (garde) enfant.setAttribute("style", garde);
          else enfant.removeAttribute("style");
        } else if (!ATTRS_OK.has(attr.name.toLowerCase())) {
          enfant.removeAttribute(attr.name);
        }
      }
      nettoyer(enfant);
    }
  };

  nettoyer(doc.body);
  return doc.body.innerHTML;
}
