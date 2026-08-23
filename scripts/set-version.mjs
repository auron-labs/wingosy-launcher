/**
 * Sync app version across package.json, Cargo.toml, tauri.conf.json, and Cargo.lock.
 * Usage: bun scripts/set-version.mjs <semver>
 * Example: bun scripts/set-version.mjs 1.2.3
 *
 * Used by the stable Release workflow from the git tag (e.g. v1.2.3 → 1.2.3).
 */
import { writeAppVersion } from "./lib/write-app-version.mjs";

const version = process.argv[2] || "";
console.log(writeAppVersion(version));
