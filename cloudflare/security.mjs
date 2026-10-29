export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
};

export function secureResponse(request, response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  const path = new URL(request.url).pathname;
  if (/^\/admin(?:\/|$)|^\/(login|definir-senha)\/?$/.test(path)) {
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Frame-Options", "DENY");
  } else if (!headers.has("Cache-Control")) {
    // SSR and server functions can contain expiring image links.
    headers.set("Cache-Control", "no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function serveAsset(request, asset) {
  if (!asset) return null;
  const headers = new Headers({
    "Content-Type": asset.contentType,
    ETag: asset.etag,
    "Cache-Control": new URL(request.url).pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable" : "public, max-age=3600",
  });
  if (!["GET", "HEAD"].includes(request.method)) {
    headers.set("Allow", "GET, HEAD");
    return new Response(null, { status: 405, headers });
  }
  if (request.headers.get("If-None-Match")?.split(",").some((value) => value.trim() === "*" || value.trim().replace(/^W\//, "") === asset.etag))
    return new Response(null, { status: 304, headers });
  const bytes = Uint8Array.from(atob(asset.content), (c) => c.charCodeAt(0));
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(request.method === "HEAD" ? null : bytes, { headers });
}
