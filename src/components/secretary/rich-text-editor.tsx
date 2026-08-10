import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Minus,
  RemoveFormatting,
  Type,
  Table as TableIcon,
  Baseline,
  Highlighter,
  ChevronDown,
} from "lucide-react";

// Palettes proposées pour la couleur du texte et le surlignage.
const COULEURS_TEXTE = [
  "#0D1B3E",
  "#111827",
  "#374151",
  "#6B7280",
  "#B91C1C",
  "#DC2626",
  "#EA580C",
  "#CA8A04",
  "#C9A84C",
  "#15803D",
  "#059669",
  "#0369A1",
  "#2563EB",
  "#7C3AED",
];
const COULEURS_SURLIGNAGE = [
  "#FEF08A",
  "#FDE68A",
  "#FED7AA",
  "#BBF7D0",
  "#A7F3D0",
  "#BFDBFE",
  "#DBEAFE",
  "#E9D5FF",
  "#FBCFE8",
  "#E5E7EB",
];

/**
 * Éditeur de texte riche « façon traitement de texte », sans dépendance.
 *
 * Il s'appuie sur `contentEditable` + `document.execCommand`. L'API est certes
 * marquée obsolète, mais elle reste implémentée par tous les navigateurs et c'est
 * le seul moyen d'avoir gras/italique/titres/listes/alignement sans embarquer un
 * moteur d'édition complet (ProseMirror & co pèsent plusieurs centaines de Ko).
 *
 * Contrat : la valeur est du HTML. Le parent la stocke telle quelle ; l'export PDF
 * et les archives la reconvertissent en texte via `@/lib/pv-format`.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder,
  minHeight = 520,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [, forcerRendu] = useState(0);

  // On n'écrit dans le DOM que si la valeur DIFFÈRE de ce que l'utilisateur voit :
  // réinjecter le HTML à chaque frappe replacerait le curseur au début du document.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  const emettre = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const commande = (cmd: string, arg?: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emettre();
    forcerRendu((n) => n + 1); // rafraîchit l'état actif des boutons
  };

  const actif = (cmd: string) => {
    try {
      return document.queryCommandState(cmd);
    } catch {
      return false;
    }
  };

  const bloc = (tag: string) => commande("formatBlock", tag);

  // Insertion d'un tableau (execCommand ne le fait pas) : on injecte le HTML, suivi
  // d'un paragraphe vide pour que le curseur puisse ressortir sous le tableau.
  const insererTableau = () => {
    const lignes = 3;
    const colonnes = 3;
    let html = '<table class="pv-tableau"><tbody>';
    for (let r = 0; r < lignes; r++) {
      html += "<tr>";
      for (let c = 0; c < colonnes; c++) html += "<td>&nbsp;</td>";
      html += "</tr>";
    }
    html += "</tbody></table><p><br></p>";
    commande("insertHTML", html);
  };

  // Ctrl/Cmd + B / I / U : les raccourcis que tout le monde a dans les doigts.
  const surTouche = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b" || k === "i" || k === "u") {
      e.preventDefault();
      commande(k === "b" ? "bold" : k === "i" ? "italic" : "underline");
    }
  };

  // Collage : on n'accepte que du texte, sinon les styles de Word ou du web
  // entrent dans le PV et le rendent illisible dans le PDF.
  const surCollage = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const texte = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, texte);
    emettre();
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div
        role="toolbar"
        aria-label="Mise en forme du procès-verbal"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/60 px-2 py-1.5 backdrop-blur"
      >
        <Groupe>
          <Bouton
            titre="Gras (Ctrl+B)"
            actif={actif("bold")}
            onClick={() => commande("bold")}
            disabled={disabled}
          >
            <Bold className="h-4 w-4" />
          </Bouton>
          <Bouton
            titre="Italique (Ctrl+I)"
            actif={actif("italic")}
            onClick={() => commande("italic")}
            disabled={disabled}
          >
            <Italic className="h-4 w-4" />
          </Bouton>
          <Bouton
            titre="Souligné (Ctrl+U)"
            actif={actif("underline")}
            onClick={() => commande("underline")}
            disabled={disabled}
          >
            <Underline className="h-4 w-4" />
          </Bouton>
          <Bouton
            titre="Barré"
            actif={actif("strikeThrough")}
            onClick={() => commande("strikeThrough")}
            disabled={disabled}
          >
            <Strikethrough className="h-4 w-4" />
          </Bouton>
        </Groupe>

        <Separateur />

        <Groupe>
          <Bouton titre="Titre principal" onClick={() => bloc("H1")} disabled={disabled}>
            <Heading1 className="h-4 w-4" />
          </Bouton>
          <Bouton titre="Titre de section" onClick={() => bloc("H2")} disabled={disabled}>
            <Heading2 className="h-4 w-4" />
          </Bouton>
          <Bouton titre="Sous-titre" onClick={() => bloc("H3")} disabled={disabled}>
            <Heading3 className="h-4 w-4" />
          </Bouton>
          <Bouton titre="Paragraphe" onClick={() => bloc("P")} disabled={disabled}>
            <Type className="h-4 w-4" />
          </Bouton>
        </Groupe>

        <Separateur />

        {/* execCommand ne connaît que les tailles 1 à 7 ; on n'expose que les utiles. */}
        <select
          aria-label="Taille du texte"
          disabled={disabled}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) commande("fontSize", e.target.value);
            e.currentTarget.value = "";
          }}
          className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
        >
          <option value="">Taille…</option>
          <option value="2">Petit</option>
          <option value="3">Normal</option>
          <option value="5">Grand</option>
          <option value="6">Très grand</option>
        </select>

        <Separateur />

        <Groupe>
          <MenuCouleur
            titre="Couleur du texte"
            icon={Baseline}
            couleurs={COULEURS_TEXTE}
            disabled={disabled}
            onChoisir={(c) => commande("foreColor", c)}
          />
          <MenuCouleur
            titre="Couleur de surlignage"
            icon={Highlighter}
            couleurs={COULEURS_SURLIGNAGE}
            disabled={disabled}
            avecAucune
            // `hiliteColor` couvre le fond du texte ; certains navigateurs n'exposent
            // que `backColor`, appliqué en repli.
            onChoisir={(c) => {
              const arg = c === "" ? "transparent" : c;
              ref.current?.focus();
              if (!document.execCommand("hiliteColor", false, arg))
                document.execCommand("backColor", false, arg);
              emettre();
              forcerRendu((n) => n + 1);
            }}
          />
          <Bouton titre="Insérer un tableau" onClick={insererTableau} disabled={disabled}>
            <TableIcon className="h-4 w-4" />
          </Bouton>
        </Groupe>

        <Separateur />

        <Groupe>
          <Bouton
            titre="Liste à puces"
            onClick={() => commande("insertUnorderedList")}
            disabled={disabled}
          >
            <List className="h-4 w-4" />
          </Bouton>
          <Bouton
            titre="Liste numérotée"
            onClick={() => commande("insertOrderedList")}
            disabled={disabled}
          >
            <ListOrdered className="h-4 w-4" />
          </Bouton>
        </Groupe>

        <Separateur />

        <Groupe>
          <Bouton
            titre="Aligner à gauche"
            onClick={() => commande("justifyLeft")}
            disabled={disabled}
          >
            <AlignLeft className="h-4 w-4" />
          </Bouton>
          <Bouton titre="Centrer" onClick={() => commande("justifyCenter")} disabled={disabled}>
            <AlignCenter className="h-4 w-4" />
          </Bouton>
          <Bouton
            titre="Aligner à droite"
            onClick={() => commande("justifyRight")}
            disabled={disabled}
          >
            <AlignRight className="h-4 w-4" />
          </Bouton>
          <Bouton titre="Justifier" onClick={() => commande("justifyFull")} disabled={disabled}>
            <AlignJustify className="h-4 w-4" />
          </Bouton>
        </Groupe>

        <Separateur />

        <Groupe>
          <Bouton
            titre="Trait de séparation"
            onClick={() => commande("insertHorizontalRule")}
            disabled={disabled}
          >
            <Minus className="h-4 w-4" />
          </Bouton>
          <Bouton
            titre="Effacer la mise en forme"
            onClick={() => commande("removeFormat")}
            disabled={disabled}
          >
            <RemoveFormatting className="h-4 w-4" />
          </Bouton>
        </Groupe>

        <Separateur />

        <Groupe>
          <Bouton titre="Annuler (Ctrl+Z)" onClick={() => commande("undo")} disabled={disabled}>
            <Undo2 className="h-4 w-4" />
          </Bouton>
          <Bouton titre="Rétablir (Ctrl+Y)" onClick={() => commande("redo")} disabled={disabled}>
            <Redo2 className="h-4 w-4" />
          </Bouton>
        </Groupe>
      </div>

      {/* La feuille : marges généreuses et interligne confortable — on relit un PV
          plus souvent qu'on ne l'écrit. */}
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Contenu du procès-verbal"
        data-placeholder={placeholder}
        onInput={emettre}
        onBlur={emettre}
        onKeyDown={surTouche}
        onPaste={surCollage}
        onMouseUp={() => forcerRendu((n) => n + 1)}
        onKeyUp={() => forcerRendu((n) => n + 1)}
        style={{ minHeight }}
        className="pv-editeur max-w-none bg-white px-10 py-8 text-[16px] leading-relaxed text-slate-800 focus:outline-none"
      />
    </div>
  );
}

function Groupe({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

// Sélecteur de couleur : un bouton qui déplie une palette. Boutons et pastilles
// utilisent onMouseDown+preventDefault pour ne pas perdre la sélection de l'éditeur.
function MenuCouleur({
  titre,
  icon: Icon,
  couleurs,
  onChoisir,
  disabled,
  avecAucune,
}: {
  titre: string;
  icon: React.ComponentType<{ className?: string }>;
  couleurs: string[];
  onChoisir: (couleur: string) => void;
  disabled?: boolean;
  /** Ajoute une pastille « Aucune » (retire le surlignage). */
  avecAucune?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [ouvert]);

  const choisir = (c: string) => {
    onChoisir(c);
    setOuvert(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={titre}
        aria-label={titre}
        aria-haspopup="true"
        aria-expanded={ouvert}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOuvert((o) => !o)}
        className="inline-flex h-8 items-center gap-0.5 rounded-lg px-1.5 text-muted-foreground transition hover:bg-background hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-40"
      >
        <Icon className="h-4 w-4" />
        <ChevronDown className="h-3 w-3" />
      </button>
      {ouvert && (
        <div className="absolute left-0 top-full z-30 mt-1 grid grid-cols-7 gap-1 rounded-xl border border-border bg-white p-2 shadow-xl">
          {couleurs.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir(c)}
              className="h-5 w-5 rounded ring-1 ring-inset ring-black/10 transition hover:scale-110"
              style={{ backgroundColor: c }}
            />
          ))}
          {avecAucune && (
            <button
              type="button"
              title="Aucune"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir("")}
              className="flex h-5 w-5 items-center justify-center rounded bg-white text-[12px] font-bold text-rose-500 ring-1 ring-inset ring-border transition hover:scale-110"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Separateur() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />;
}

function Bouton({
  titre,
  onClick,
  actif = false,
  disabled = false,
  children,
}: {
  titre: string;
  onClick: () => void;
  actif?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titre}
      aria-label={titre}
      aria-pressed={actif}
      disabled={disabled}
      // `onMouseDown` + preventDefault : sans ça, le clic sur le bouton fait perdre
      // la sélection dans l'éditeur, et la commande s'applique dans le vide.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-40 ${
        actif ? "bg-navy text-gold" : "text-muted-foreground hover:bg-background hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}
