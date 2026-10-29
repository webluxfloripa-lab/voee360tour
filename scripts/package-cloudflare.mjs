import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import { rolldown } from "rolldown";

const output = ".cloudflare-output";
await mkdir(output, { recursive: true });
const assets = {};
const types = { ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };
async function scan(directory, prefix = "") {
  for (const file of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + "/" + file.name;
    if (file.isDirectory()) await scan(join(directory, file.name), name);
    else if (!["/_headers", "/_redirects"].includes(name) && !file.name.endsWith(".map")) {
      const bytes = await readFile(join(directory, file.name));
      assets[name] = { content: bytes.toString("base64"), contentType: types[extname(file.name)] || "application/octet-stream", etag: '"' + createHash("sha256").update(bytes).digest("hex") + '"' };
    }
  }
}
await scan(".output/public");
await writeFile(join(output, "assets.mjs"), "export default " + JSON.stringify(assets));
const bundle = await rolldown({ input: "cloudflare/worker.mjs", external: (id) => id.startsWith("node:") || id.startsWith("cloudflare:") });
await bundle.write({ file: join(output, "entry.js"), format: "esm", minify: true, codeSplitting: false });
await bundle.close();
// Use this explicit config when deploying; Nitro also emits its own config.
await writeFile(join(output, "wrangler.json"), JSON.stringify({ name: "voee360tour", main: "entry.js", compatibility_date: "2026-10-29", compatibility_flags: ["nodejs_compat"], observability: { enabled: true } }, null, 2));
console.log(`Cloudflare: ${Object.keys(assets).length} static assets embedded in ${output}/entry.js`);
