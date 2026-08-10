#!/usr/bin/env node
/**
 * Extrait un composant DÉJÀ au premier niveau de `admin-app.tsx` vers son
 * propre fichier. Plus simple que `extraire-ecran.mjs` : ces composants ne
 * capturent rien par fermeture, tout leur arrive en props.
 *
 * Mêmes garde-fous : imports calculés (pas recopiés en bloc), et refus d'agir
 * si le composant dépend d'un autre encore présent dans admin-app.tsx.
 *
 * Usage : node scripts/extraire-composant.mjs NomDuComposant <dossier> [--dry]
 *         dossier = screens | shared
 */
import { readFileSync, writeFileSync } from "node:fs";

const ADMIN = "src/components/mobile/admin-app.tsx";
const nom = process.argv[2];
const dossier = process.argv[3] ?? "screens";
const dry = process.argv.includes("--dry");

const source = readFileSync(ADMIN, "utf8");
const lignes = source.split("\n");

const debut = lignes.findIndex((l) => l.startsWith(`function ${nom}(`));
if (debut === -1) {
  console.error(`✗ ${nom} : pas trouvé au premier niveau`);
  process.exit(1);
}
let fin = -1;
for (let j = debut + 1; j < lignes.length; j++) {
  if (lignes[j] === "}") {
    fin = j;
    break;
  }
}
const corps = lignes.slice(debut, fin + 1);
const texte = corps.join("\n");
const utilises = new Set(texte.match(/[A-Za-z_$][\w$]*/g) ?? []);

// Dépendances encore dans admin-app → import circulaire
const restants = new Set(
  [...source.matchAll(/^(?:export )?function ([A-Z][\w]*)\(/gm)].map((m) => m[1]),
);
const imbriques = new Set([...source.matchAll(/^ {2}function ([A-Z][\w]*)\(/gm)].map((m) => m[1]));
restants.delete(nom);
const conflits = [...utilises].filter((u) => restants.has(u) || imbriques.has(u));
if (conflits.length) {
  console.error(`✗ ${nom} dépend de : ${conflits.join(", ")} — les extraire d'abord`);
  process.exit(2);
}

// Imports d'admin-app indexés par symbole
const enTete = source.slice(0, source.indexOf("\nexport function MobileAdminApp"));
const imports = new Map();
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

const parModule = new Map();
for (const u of utilises) {
  const info = imports.get(u);
  if (!info) continue;
  let chemin = info.module;
  if (chemin.startsWith("./shared/"))
    chemin = dossier === "shared" ? chemin.replace("./shared/", "./") : chemin.replace("./shared/", "../shared/");
  else if (chemin.startsWith("./screens/"))
    chemin = dossier === "screens" ? chemin.replace("./screens/", "./") : chemin.replace("./screens/", "../screens/");
  else if (chemin.startsWith("./")) chemin = chemin.replace("./", "../");
  if (!parModule.has(chemin)) parModule.set(chemin, []);
  parModule.get(chemin).push(
    (info.type ? "type " : "") + (info.alias ? `${info.orig} as ${info.alias}` : info.orig),
  );
}
const hooks = ["useState", "useEffect", "useMemo", "useRef", "useCallback"].filter((h) =>
  utilises.has(h),
);
const lignesImport = [];
if (hooks.length) lignesImport.push(`import { ${hooks.join(", ")} } from "react";`);
for (const [mod, syms] of [...parModule].sort()) {
  if (mod === "react") continue;
  lignesImport.push(`import { ${[...new Set(syms)].sort().join(", ")} } from "${mod}";`);
}

const kebab = nom.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const dest = `src/components/mobile/${dossier}/${kebab}.tsx`;
console.log(`${nom} : ${corps.length} lignes → ${dest}`);
if (dry) process.exit(0);

writeFileSync(
  dest,
  `// ${nom} — extrait de \`admin-app.tsx\`.\n` +
    lignesImport.join("\n") +
    "\n\nexport " +
    texte +
    "\n",
);

const restantsLignes = [...lignes.slice(0, debut), ...lignes.slice(fin + 1)];
const i = restantsLignes.findIndex((l) => l.startsWith("import { MobileSessionProvider"));
restantsLignes.splice(i + 1, 0, `import { ${nom} } from "./${dossier}/${kebab}";`);
writeFileSync(ADMIN, restantsLignes.join("\n"));
console.log(`  ✓ retiré d'admin-app.tsx, import ajouté`);
