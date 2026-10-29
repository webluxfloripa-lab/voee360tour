export type PackagedAsset = {
  content: string;
  contentType: string;
  etag: string;
};

/** Only immutable public build files belong in this map, never customer media. */
export function serveAsset(request: Request, asset: PackagedAsset | undefined) {
  if (!asset) return null;
  const headers = new Headers({
    "Content-Type": asset.contentType,
    ETag: asset.etag,
    "Cache-Control": new URL(request.url).pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method !== "GET" && request.method !== "HEAD") {
    headers.set("Allow", "GET, HEAD");
    return new Response(null, { status: 405, headers });
  }
  const matches = request.headers
    .get("If-None-Match")
    ?.split(",")
    .map((s) => s.trim());
  if (
    matches?.some(
      (tag) => tag === "*" || tag.replace(/^W\//, "") === asset.etag,
    )
  )
    return new Response(null, { status: 304, headers });
  if (request.method === "HEAD") return new Response(null, { headers });
  const data = Uint8Array.from(atob(asset.content), (c) => c.charCodeAt(0));
  headers.set("Content-Length", String(data.byteLength));
  return new Response(data, { headers });
}

/** Match the existing Vercel security policy on the additional hosting. */
export function secureResponse(
  request: Request,
  response: Response,
  policy: Record<string, string>,
) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(policy)) headers.set(key, value);
  if (
    /^\/admin(?:\/|$)|^\/(login|definir-senha)\/?$/.test(
      new URL(request.url).pathname,
    )
  ) {
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Frame-Options", "DENY");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
