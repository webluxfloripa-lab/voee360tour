import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";
const buildEnv = {
  ...loadEnv("production", process.cwd(), "VITE_"),
  ...process.env,
};
const providerUrl = buildEnv.VITE_SUPABASE_URL;
const publicKey = buildEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!providerUrl || !publicKey) {
  throw new Error(
    "Cloudflare build requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Configure build variables before deploying.",
  );
}
if (new URL(providerUrl).protocol !== "https:") {
  throw new Error("VITE_SUPABASE_URL must use HTTPS.");
}
if (!publicKey.startsWith("sb_publishable_")) {
  let role;
  try {
    role = JSON.parse(
      Buffer.from(publicKey.split(".")[1], "base64url").toString("utf8"),
    ).role;
  } catch {
    throw new Error("Use a Supabase publishable key or legacy anon key.");
  }
  if (role !== "anon") {
    throw new Error("Administrative Supabase keys cannot be included in a build.");
  }
}
// Generated output only. Source files, local environment and customer data stay intact.
await rm(".output", { recursive: true, force: true });
const built = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  {
    stdio: "inherit",
    env: {
      ...buildEnv,
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
