import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function parseSemverStrict(s) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(s).trim());
  if (!m) throw new Error(`Invalid semver (expected MAJOR.MINOR.PATCH): ${s}`);
  return `${m[1]}.${m[2]}.${m[3]}`;
}

export function writeAppVersion(version) {
  const v = parseSemverStrict(version);

  const pkgPath = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.version = v;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  const cargoPath = join(root, "src-tauri", "Cargo.toml");
  let cargo = readFileSync(cargoPath, "utf8");
  cargo = cargo.replace(/^version = "[^"]+"/m, `version = "${v}"`);
  writeFileSync(cargoPath, cargo);

  syncCargoLockWorkspaceVersion(v);

  const tauriPath = join(root, "src-tauri", "tauri.conf.json");
  const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
  tauri.version = v;
  if (tauri.package) {
    delete tauri.package;
  }
  writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");

  return v;
}

/** Keep Cargo.lock in sync with `[package].version` (no `cargo` CLI required). */
function syncCargoLockWorkspaceVersion(version) {
  const lockPath = join(root, "src-tauri", "Cargo.lock");
  let text = "";
  try {
    text = readFileSync(lockPath, "utf8");
  } catch {
    // Cargo.lock may not exist yet in some CI/checkout states.
    return;
  }

  // Be tolerant of CRLF/LF differences on Windows.
  const re = /(^|\r?\n)name = "wingosy-launcher"\r?\nversion = "[^"]*"/m;
  if (!re.test(text)) {
    // If the package block isn't present yet, don't fail the workflow — Cargo will regenerate it on build.
    return;
  }
  text = text.replace(re, `$1name = "wingosy-launcher"\nversion = "${version}"`);
  writeFileSync(lockPath, text);
}
