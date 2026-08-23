/**
 * Rasterize branding/windows/wingosy-launcher-icon.svg → Tauri bundle icons + web favicon.
 * Run from repo root: bun run icons:windows
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import png2icons from "png2icons";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "branding", "windows", "wingosy-launcher-icon.svg");
const iconsDir = join(root, "src-tauri", "icons");
const publicDir = join(root, "public");

mkdirSync(iconsDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

const svg = readFileSync(svgPath);

const tauriPngs = [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
];

for (const [name, size] of tauriPngs) {
  const buf = await sharp(svg).resize(size, size).png().toBuffer();
  writeFileSync(join(iconsDir, name), buf);
}

const icoSizes = [256, 128, 64, 48, 32, 16];
const icoBuffers = await Promise.all(
  icoSizes.map((s) => sharp(svg).resize(s, s).png().toBuffer())
);
const icoBuf = await pngToIco(icoBuffers);
writeFileSync(join(iconsDir, "icon.ico"), icoBuf);

const png1024 = await sharp(svg).resize(1024, 1024).png().toBuffer();
const icns = png2icons.createICNS(png1024, png2icons.BICUBIC, 0);
if (!icns) {
  throw new Error("png2icons.createICNS returned empty buffer");
}
writeFileSync(join(iconsDir, "icon.icns"), Buffer.from(icns));

copyFileSync(svgPath, join(iconsDir, "icon.svg"));
copyFileSync(svgPath, join(publicDir, "icon.svg"));

console.log("Wrote Tauri icons:", iconsDir);
console.log("  32x32.png, 128x128.png, 128x128@2x.png, icon.ico, icon.icns, icon.svg");
console.log("Wrote web favicon:", join(publicDir, "icon.svg"));
