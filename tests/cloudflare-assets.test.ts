import { describe, it, expect } from "vitest";
import { serveAsset, secureResponse } from "../cloudflare/asset-handler";
const asset = {
  content: btoa("console.log('real build')"),
  contentType: "application/javascript",
  etag: '"sha256-test"',
};
describe("additional Cloudflare hosting", () => {
  it("serves the actual binary, HEAD and conditional responses with stable cache policy", async () => {
    const request = new Request("https://tour.workers.dev/assets/app.js");
    const response = serveAsset(request, asset)!;
    expect(await response.text()).toBe("console.log('real build')");
    expect(response.headers.get("Content-Type")).toBe("application/javascript");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    expect(
      await serveAsset(new Request(request, { method: "HEAD" }), asset)!.text(),
    ).toBe("");
    const cached = serveAsset(
      new Request(request, { headers: { "If-None-Match": 'W/"sha256-test"' } }),
      asset,
    )!;
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");
    expect(
      serveAsset(new Request(request, { method: "POST" }), asset)!.status,
    ).toBe(405);
    expect(serveAsset(request, undefined)).toBeNull();
  });
  it("prevents caching or framing of admin and login without blocking tour embeds", () => {
    for (const path of [
      "/admin",
      "/admin/projetos",
      "/login",
      "/definir-senha",
    ]) {
      const response = secureResponse(
        new Request("https://tour.workers.dev" + path),
        new Response("shell"),
        { "X-Content-Type-Options": "nosniff" },
      );
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    }
    const embed = secureResponse(
      new Request("https://tour.workers.dev/embed/loja"),
      new Response("tour"),
      {},
    );
    expect(embed.headers.has("X-Frame-Options")).toBe(false);
  });
});
