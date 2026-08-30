import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["run", "dev"], {
  env: { ...process.env, VITE_WINGOSY_DEBUG: "1" },
  stdio: "inherit",
});

if (result.error) {
  console.error(`Failed to start debug development app: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
