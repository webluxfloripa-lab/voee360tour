import nitro from "../.output/server/index.mjs";
import assets from "../.cloudflare-output/assets.mjs";
import { secureResponse, serveAsset } from "./security.mjs";

export default {
  async fetch(request, env, context) {
    const path = new URL(request.url).pathname;
    const response = serveAsset(request, Object.hasOwn(assets, path) ? assets[path] : undefined)
      ?? await nitro.fetch(request, env, context);
    return secureResponse(request, response);
  },
};
