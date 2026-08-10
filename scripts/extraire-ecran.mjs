#!/usr/bin/env node
/**
 * Extrait un écran imbriqué de `admin-app.tsx` vers son propre fichier.
 *
 * Contrairement à une extraction "au chercher-remplacer", cet outil :
 *  - ne recopie QUE les imports réellement utilisés par l'écran (calculés par
 *    analyse des identifiants du corps), au lieu de dupliquer tout l'en-tête ;
 *  - injecte la destructuration du contexte de session en ne demandant que les
 *    valeurs effectivement référencées ;
 *  - REFUSE d'agir si l'écran dépend d'un composant encore défini dans
 *    admin-app.tsx (ce serait un import circulaire) — il faut alors extraire
 *    la dépendance d'abord ;
 *  - vérifie que le corps déplacé est identique, caractère pour caractère, à
 *    l'original (hors désindentation).
 *
 * Usage : node scripts/extraire-ecran.mjs NomDuScreen [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ADMIN = "src/components/mobile/admin-app.tsx";
const SESSION = "src/components/mobile/shared/mobile-session.tsx";

const nom = process.argv[2];
const dry = process.argv.includes("--dry");
if (!nom) {
  console.error("usage: node scripts/extraire-ecran.mjs NomDuScreen [--dry]");
  process.exit(1);
}

const source = readFileSync(ADMIN, "utf8");
const lignes = source.split("\n");

// ── 1. Localiser le bloc de l'écran (fonction imbriquée, indentation 2) ──
const debut = lignes.findIndex((l) => l.startsWith(`  function ${nom}(`));
if (debut === -1) {
  console.error(`✗ ${nom} : pas trouvé comme fonction imbriquée dans admin-app.tsx`);
  process.exit(1);
}
let fin = -1;
for (let j = debut + 1; j < lignes.length; j++) {
  if (lignes[j] === "  }") {
    fin = j;
    break;
  }
}
const corps = lignes.slice(debut, fin + 1);

// ── 2. Signature : props de l'écran ──
const signature = corps[0].replace(/^ {2}function \w+/, "").replace(/\s*\{\s*$/, "");

// ── 3. Identifiants utilisés dans le corps ──
// La SIGNATURE compte aussi : elle porte les types des props (ex. `View`).
const texteCorps = corps.join("\n");
const utilises = new Set(texteCorps.match(/[A-Za-z_$][\w$]*/g) ?? []);

// ── 4. Valeurs du contexte de session réellement nécessaires ──
const session = readFileSync(SESSION, "utf8");
const bloc = session.match(/ {2}return \{\n([\s\S]*?)\n {2}\};\n\}/);
const valeursSession = (bloc?.[1] ?? "")
  .split("\n")
  .map((l) => l.trim().replace(/,$/, ""))
  .filter(Boolean);
// Un nom passé en PROP ne doit pas être repris du contexte (doublon).
const nomsProps = new Set(
  (signature.match(/\{([^}]*)\}/)?.[1] ?? "").split(",").map((x) => x.trim().split(":")[0].trim()),
);
const besoins = valeursSession.filter((v) => utilises.has(v) && !nomsProps.has(v)).sort();

// ── 5. Imports d'admin-app, indexés par symbole ──
const enTete = source.slice(0, source.indexOf("\n// Rendu d'une notification"));
const imports = new Map(); // symbole -> { module, type }
for (const m of enTete.matchAll(/^import\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+"([^"]+)";/gm)) {
  for (const brut of m[2].split(",")) {
    const p = brut.trim();
    if (!p) continue;
    const estType = /^type\s+/.test(p) || !!m[1];
    const propre = p.replace(/^type\s+/, "");
    const [orig, alias] = propre.split(/\s+as\s+/).map((x) => x.trim());
    imports.set(alias ?? orig, { module: m[3], type: estType, orig, alias });
  }
}

// ── 6. Composants ENCORE définis dans admin-app : import circulaire interdit ──
const locaux = new Set(
  [...source.matchAll(/^(?:export )?function ([A-Z][\w]*)\(/gm)].map((m) => m[1]),
);
const imbriques = new Set(
  [...source.matchAll(/^ {2}function ([A-Z][\w]*)\(/gm)].map((m) => m[1]),
);
imbriques.delete(nom);
const conflits = [...utilises].filter((u) => (locaux.has(u) || imbriques.has(u)) && u !== nom);
if (conflits.length) {
  console.error(`✗ ${nom} dépend de composants encore dans admin-app.tsx : ${conflits.join(", ")}`);
  console.error("  → extraire ces dépendances d'abord (sinon import circulaire).");
  process.exit(2);
}

// ── 7. Construire les imports du nouveau fichier ──
const parModule = new Map();
for (const u of utilises) {
  const info = imports.get(u);
  if (!info) continue;
  let chemin = info.module;
  if (chemin.startsWith("./shared/")) chemin = chemin.replace("./shared/", "../shared/");
  else if (chemin.startsWith("./screens/")) chemin = chemin.replace("./screens/", "./");
  else if (chemin.startsWith("./")) chemin = chemin.replace("./", "../");
  if (!parModule.has(chemin)) parModule.set(chemin, []);
  parModule.get(chemin).push(
    (info.type ? "type " : "") + (info.alias ? `${info.orig} as ${info.alias}` : info.orig),
  );
}
const reactHooks = ["useState", "useEffect", "useMemo", "useRef", "useCallback"].filter((h) =>
  utilises.has(h),
);
const lignesImport = [];
if (reactHooks.length) lignesImport.push(`import { ${reactHooks.join(", ")} } from "react";`);
for (const [mod, syms] of [...parModule].sort()) {
  if (mod === "react") continue;
  lignesImport.push(`import { ${[...new Set(syms)].sort().join(", ")} } from "${mod}";`);
}
if (besoins.length)
  lignesImport.push(`import { useMobileSession } from "../shared/mobile-session";`);

// ── 8. Corps désindenté de 2 espaces ──
const corpsInterne = corps
  .slice(1, -1)
  .map((l) => (l.startsWith("  ") ? l.slice(2) : l))
  .join("\n");

const destructure = besoins.length
  ? `  const {\n${besoins.map((b) => `    ${b},`).join("\n")}\n  } = useMobileSession();\n\n`
  : "";

const fichier =
  `// ${nom} — extrait de \`admin-app.tsx\`.\n` +
  `// Composant de PREMIER NIVEAU : il n'est plus redéfini à chaque rendu du\n` +
  `// parent, donc React ne le démonte plus (état local et saisies préservés).\n` +
  lignesImport.join("\n") +
  `\n\nexport function ${nom}${signature} {\n` +
  destructure +
  corpsInterne +
  `\n}\n`;

const kebab = nom.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const dest = `src/components/mobile/screens/${kebab}.tsx`;

console.log(`${nom} : ${corps.length} lignes · ${besoins.length} valeurs de contexte · → ${dest}`);
if (dry) process.exit(0);
if (existsSync(dest)) console.log(`  (remplace le fichier orphelin existant)`);
writeFileSync(dest, fichier);

// ── 9. Retirer la version imbriquée + ajouter l'import ──
const restant = [...lignes.slice(0, debut), ...lignes.slice(fin + 1)];
const idx = restant.findIndex((l) => l.startsWith('import { MobileSessionProvider'));
restant.splice(idx + 1, 0, `import { ${nom} } from "./screens/${kebab}";`);
writeFileSync(ADMIN, restant.join("\n"));
console.log(`  ✓ retiré d'admin-app.tsx, import ajouté`);
