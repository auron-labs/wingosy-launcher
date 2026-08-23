/**
 * One-shot: build src/data/consoleIconSet.json from @iconify-json/simple-icons.
 * Run: bun scripts/extract-console-icons.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const bigPath = join(root, "node_modules/@iconify-json/simple-icons/icons.json");
const big = JSON.parse(readFileSync(bigPath, "utf8"));

const SLUGS = [
  "nintendo",
  "nintendoswitch",
  "nintendo3ds",
  "nintendogamecube",
  "playstation",
  "playstation2",
  "playstation3",
  "playstation4",
  "playstation5",
  "playstationportable",
  "playstationvita",
  "sega",
  "xbox",
  "windows",
  "retroarch",
];

const icons = {};
for (const slug of SLUGS) {
  if (!big.icons[slug]) {
    console.warn("missing slug:", slug);
    continue;
  }
  icons[slug] = big.icons[slug];
}

// Root width/height required so @iconify/react scales glyphs correctly (matches simple-icons 24×24 viewBox).
const out = {
  prefix: "wingosy-console",
  width: 24,
  height: 24,
  icons,
};

const outDir = join(root, "src/data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "consoleIconSet.json");
writeFileSync(outPath, JSON.stringify(out));
console.log("wrote", outPath, "icons:", Object.keys(icons).length);
