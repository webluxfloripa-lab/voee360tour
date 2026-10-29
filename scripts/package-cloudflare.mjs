import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
const output = ".output/cloudflare";
const root = ".output/public";
const types = {
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
const assets = {};
async function collect(dir, prefix = "") {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw new Error("Symlink in public assets");
    const path = join(dir, item.name),
      route = prefix + "/" + item.name;
    if (item.isDirectory()) await collect(path, route);
    else if (!item.name.startsWith("_") && !item.name.endsWith(".map")) {
      const body = await readFile(path);
      assets[route] = {
        content: body.toString("base64"),
        contentType: types[extname(path)] ?? "application/octet-stream",
        etag: '"' + createHash("sha256").update(body).digest("hex") + '"',
      };
    }
  }
}
await collect(root);
const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
const policy = Object.fromEntries(
  vercel.headers
    .find((rule) => rule.source === "/(.*)")
    .headers.map(({ key, value }) => [key, value]),
);
await mkdir(output, { recursive: true });
await writeFile(join(output, "assets.json"), JSON.stringify(assets));
await writeFile(
  join(output, "entry.mjs"),
  `
import app from '../server/index.mjs';
import assets from './assets.json';
import { serveAsset, secureResponse } from '../../cloudflare/asset-handler.ts';
const policy = ${JSON.stringify(policy)};
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    const response = serveAsset(request, Object.hasOwn(assets, path) ? assets[path] : undefined)
      ?? await app.fetch(request, env, ctx);
    return secureResponse(request, response, policy);
  }
};
`,
);
const config = JSON.parse(
  await readFile(".output/server/wrangler.json", "utf8"),
);
delete config.assets;
delete config.no_bundle;
delete config.rules;
config.main = "entry.mjs";
config.minify = true;
config.upload_source_maps = false;
await writeFile(
  join(output, "wrangler.json"),
  JSON.stringify(config, null, 2) + "\n",
);
console.log(
  `Cloudflare package: ${Object.keys(assets).length} public assets; customer media remains private in Supabase.`,
);
