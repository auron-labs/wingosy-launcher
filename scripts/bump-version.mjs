/**
 * Bump app version using channel rules (committed package.json is the source of truth):
 * - nightly: PATCH + 1  (0.1.3 → 0.1.4)
 * - beta:    MINOR + 1, PATCH = 0  (0.1.3 → 0.2.0) — resets nightly counter
 * - release: MAJOR + 1, MINOR = 0, PATCH = 0  (1.2.3 → 2.0.0) — resets beta and nightly
 *
 * Usage: bun scripts/bump-version.mjs <nightly|beta|release>
 * Prints the new semver as the only stdout line (for CI).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeAppVersion, parseSemverStrict } from "./lib/write-app-version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readCurrentParts() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const v = parseSemverStrict(pkg.version);
  const [a, b, c] = v.split(".").map(Number);
  return { major: a, minor: b, patch: c };
}

function bump(kind, cur) {
  let { major, minor, patch } = cur;
  if (kind === "nightly") {
    return { major, minor, patch: patch + 1 };
  }
  if (kind === "beta") {
    return { major, minor: minor + 1, patch: 0 };
  }
  if (kind === "release") {
    return { major: major + 1, minor: 0, patch: 0 };
  }
  throw new Error(`Unknown bump kind "${kind}" (use nightly, beta, release)`);
}

const kind = (process.argv[2] || "").toLowerCase();
if (!kind) {
  console.error("Usage: bun scripts/bump-version.mjs <nightly|beta|release>");
  process.exit(1);
}

const next = bump(kind, readCurrentParts());
const version = `${next.major}.${next.minor}.${next.patch}`;
console.log(writeAppVersion(version));
