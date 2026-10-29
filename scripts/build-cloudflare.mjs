import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
// Generated output only. Source files, local environment and customer data stay intact.
await rm(".output", { recursive: true, force: true });
const built = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DEPLOY_TARGET: "cloudflare",
      DO_NOT_TRACK: "1",
      SUPABASE_TELEMETRY_DISABLED: "1",
      WRANGLER_SEND_METRICS: "false",
      VITE_SITE_URL:
        process.env.VITE_SITE_URL ||
        "https://voee360tour.webluxfloripa-lab.workers.dev",
    },
  },
);
if (built.status !== 0) process.exit(built.status ?? 1);
await import("./package-cloudflare.mjs");
