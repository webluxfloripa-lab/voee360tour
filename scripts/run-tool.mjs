import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Launch the same tools on Windows, macOS and Linux without shell-only env syntax.
const [tool, ...args] = process.argv.slice(2);
const entries = {
  vite: "vite",
  playwright: "@playwright/test",
};
function executable(name) {
  const manifest = fileURLToPath(import.meta.resolve(`${entries[name]}/package.json`));
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  return resolve(dirname(manifest), typeof pkg.bin === "string" ? pkg.bin : pkg.bin[name]);
}
const env = {
  ...process.env,
  DO_NOT_TRACK: "1",
  SUPABASE_TELEMETRY_DISABLED: "1",
};
async function run(entry, options = []) {
  const child = spawn(process.execPath, [entry, ...options], {
    env,
    stdio: "inherit",
  });
  const stop = () => child.kill();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const status = await new Promise((resolveStatus, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolveStatus(code ?? 1));
  });
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  if (status !== 0) process.exit(status);
}
if (tool === "cloudflare-build") {
  env.NITRO_PRESET = "cloudflare_module";
  await run(executable("vite"), ["build", ...args]);
  await run(fileURLToPath(new URL("./package-cloudflare.mjs", import.meta.url)));
} else if (Object.hasOwn(entries, tool)) {
  await run(executable(tool), args);
} else {
  throw new Error(`Unsupported tool: ${tool}`);
}
