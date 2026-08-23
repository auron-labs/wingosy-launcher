/**
 * Rebuild and re-upload latest.json for an existing GitHub release (fixes bad installer URLs).
 *
 * Usage (requires `gh` auth):
 *   GITHUB_REPOSITORY=yash-1o1/wingosy-launcher RELEASE_TAG=nightly-26156660512 bun scripts/repair-updater-manifest.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = process.env.GITHUB_REPOSITORY || "yash-1o1/wingosy-launcher";
const tag = process.env.RELEASE_TAG;
const token = process.env.GITHUB_TOKEN;

if (!tag) {
  console.error("repair-updater-manifest: set RELEASE_TAG (e.g. nightly-26156660512 or v0.0.24)");
  process.exit(1);
}
if (!token) {
  console.error("repair-updater-manifest: set GITHUB_TOKEN (or run `gh auth login`)");
  process.exit(1);
}

const ghEnv = { ...process.env, GH_TOKEN: token };

const release = JSON.parse(
  execFileSync(
    "gh",
    ["api", `repos/${repo}/releases/tags/${encodeURIComponent(tag)}`],
    { encoding: "utf8", env: ghEnv }
  )
);

const setup = release.assets.find(
  (a) => a.name.endsWith("-setup.exe") && !a.name.endsWith(".sig")
);
const sigAsset = release.assets.find((a) => a.name === `${setup?.name}.sig`);

if (!setup || !sigAsset) {
  console.error("repair-updater-manifest: missing setup.exe or .sig on", tag);
  process.exit(1);
}

execFileSync(
  "gh",
  ["release", "download", tag, sigAsset.name, "--dir", root, "--clobber", "--repo", repo],
  { stdio: "inherit", env: ghEnv }
);
const signature = readFileSync(join(root, sigAsset.name), "utf8").trim();

const versionMatch = setup.name.match(/_(\d+\.\d+\.\d+)_/);
const version = versionMatch ? versionMatch[1] : release.name?.replace(/^.*v/, "") || "0.0.0";

const manifest = {
  version,
  notes: "",
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: setup.browser_download_url,
    },
  },
};

const outPath = join(root, "latest.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("Installer URL:", setup.browser_download_url);

const head = await fetch(setup.browser_download_url, { method: "HEAD" });
if (!head.ok) {
  console.error(`repair-updater-manifest: installer HEAD failed (${head.status})`);
  process.exit(1);
}

execFileSync(
  "gh",
  ["release", "upload", tag, outPath, "--clobber", "--repo", repo],
  { stdio: "inherit", env: ghEnv }
);
console.log(`Repaired latest.json on ${tag}`);
