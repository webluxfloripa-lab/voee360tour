// Browser interaction fixtures only. No production credentials or auth bypass.
// Every provider request is intercepted; authorization and transactions are
// separately tested on the real Supabase database using live-db.sql.
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { emptySnapshot, type Snapshot } from "../../src/lib/model";
export async function mockPlatform(page: Page) {
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return host === "127.0.0.1" || host === "localhost"
      ? route.continue()
      : route.abort("blockedbyclient");
  });
  const userId = randomUUID(),
    clientId = randomUUID(),
    projectId = randomUUID();
  const clients: any[] = [
    {
      id: clientId,
      name: "Cliente de teste de interface",
      slug: "cliente-qa",
      contact: "",
      email: "",
      active: true,
      created_at: new Date().toISOString(),
    },
  ];
  const projects: any[] = [
    {
      id: projectId,
      client_id: clientId,
      title: "Tour QA",
      slug: "tour-qa",
      status: "draft",
      published_version_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  const drafts: Record<string, any> = {
    [projectId]: {
      project_id: projectId,
      revision: randomUUID(),
      snapshot: emptySnapshot("Tour QA"),
      updated_at: new Date().toISOString(),
    },
  };
  const assets: any[] = [],
    versions: any[] = [],
    files: Record<string, Buffer> = {};
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "qa@example.invalid",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const jwt =
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(
      JSON.stringify({
        sub: userId,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".fixture-signature";
  await page.addInitScript(
    ({ user, jwt }) => {
      localStorage.setItem(
        "sb-fbfdchnttkiovcpwcgfn-auth-token",
        JSON.stringify({
          access_token: jwt,
          refresh_token: "local-ui-fixture",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { user, jwt },
  );
  await page.route(
    "https://fbfdchnttkiovcpwcgfn.supabase.co/**",
    async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname;
      let body: any = {};
      try {
        body = request.postDataJSON();
      } catch {
        /* binary */
      }
      const json = (data: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "GET,POST,OPTIONS",
          },
        });
      if (request.method() === "OPTIONS") return json({});
      if (path === "/auth/v1/user") return json(user);
      if (path === "/auth/v1/logout") return json({});
      if (path === "/functions/v1/delete-tour") {
        const index = projects.findIndex(p => p.id === body.projectId);
        if (index < 0) return json({ deleted: true, already_deleted: true });
        if (body.confirmation !== projects[index]!.slug) return json({ message: "O identificador não confere." }, 409);
        for (let i=assets.length-1;i>=0;i--) if (assets[i].project_id===body.projectId) {
          delete files[assets[i].path];
          assets.splice(i,1);
        }
        for (let i=versions.length-1;i>=0;i--) if (versions[i].project_id===body.projectId) versions.splice(i,1);
        delete drafts[body.projectId];
        projects.splice(index,1);
        return json({ deleted: true });
      }
      if (path.startsWith("/rest/v1/rpc/")) {
        const name = path.split("/").at(-1)!;
        if (name === "is_super_admin") return json(true);
        if (name === "manage_client") {
          const d = body.p_data;
          const id = d.id || randomUUID();
          const old = clients.find((c) => c.id === id);
          if (old) Object.assign(old, d);
          else clients.push({ id, ...d, created_at: new Date().toISOString() });
          return json(id);
        }
        if (name === "manage_project") {
          const d = body.p_data,
            id = d.id || randomUUID();
          const old = projects.find((p) => p.id === id);
          if (old) Object.assign(old, d);
          else {
            projects.push({
              id,
              ...d,
              status: "draft",
              published_version_id: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            drafts[id] = {
              project_id: id,
              revision: randomUUID(),
              snapshot: emptySnapshot(d.title),
              updated_at: new Date().toISOString(),
            };
          }
          return json(id);
        }
        if (name === "register_asset") {
          assets.push(body.p_data);
          return json(body.p_data.id);
        }
        if (name === "save_draft") {
          const d = drafts[body.p_project];
          if (d.revision !== body.p_expected)
            return json({ code: "P0001", message: "REVISION_CONFLICT" }, 409);
          d.snapshot = structuredClone(body.p_snapshot);
          d.revision = randomUUID();
          return json(d.revision);
        }
        if (name === "publish_tour") {
          const p = projects.find((p) => p.id === body.p_project),
            d = drafts[p.id];
          const id = randomUUID();
          versions.unshift({
            id,
            project_id: p.id,
            version_number:
              versions.filter((v) => v.project_id === p.id).length + 1,
            kind: "published",
            note: body.p_note,
            created_at: new Date().toISOString(),
            snapshot: structuredClone(d.snapshot),
          });
          p.status = "published";
          p.published_version_id = id;
          return json(id);
        }
        if (name === "restore_version") {
          const d = drafts[body.p_project],
            v = versions.find((v) => v.id === body.p_version);
          if (d.revision !== body.p_expected)
            return json({ message: "REVISION_CONFLICT" }, 409);
          versions.unshift({
            id: randomUUID(),
            project_id: body.p_project,
            version_number:
              versions.filter((v) => v.project_id === body.p_project).length +
              1,
            kind: "checkpoint",
            snapshot: structuredClone(d.snapshot),
            created_at: new Date().toISOString(),
            note: "Checkpoint",
          });
          d.snapshot = structuredClone(v.snapshot);
          d.revision = randomUUID();
          return json(d.revision);
        }
        return json({ message: "Unhandled fixture RPC " + name }, 500);
      }
      if (path.startsWith("/rest/v1/")) {
        const table = path.split("/").at(-1)!;
        let rows: any[] =
          table === "clients"
            ? clients
            : table === "projects"
              ? projects
              : table === "tour_drafts"
                ? Object.values(drafts)
                : table === "tour_versions"
                  ? versions
                  : table === "published_tours"
                    ? projects.filter((p) => p.status === "published").map((p) => ({
                      project_id: p.id, slug: p.slug, version_id: p.published_version_id,
                      snapshot: versions.find((v) => v.id === p.published_version_id)?.snapshot,
                    }))
                  : table === "media_assets"
                    ? assets
                    : [];
        for (const key of ["id", "project_id", "slug"]) {
          const f = url.searchParams.get(key);
          if (f?.startsWith("eq."))
            rows = rows.filter((r) => r[key] === f.slice(3));
        }
        if (table === "tour_versions")
          rows = [...rows].sort((a, b) => b.version_number - a.version_number);
        const object = request
          .headers()
          .accept?.includes("application/vnd.pgrst.object+json");
        return json(object ? (rows[0] ?? null) : rows);
      }
      if (path === "/storage/v1/object/sign/tour-media")
        return json(
          (body.paths || []).map((p: string) => ({
            path: p,
            signedURL: "/object/sign/tour-media/" + p + "?token=fixture",
          })),
        );
      if (path.startsWith("/storage/v1/object/sign/tour-media/")) {
        const key = decodeURIComponent(
          path.slice("/storage/v1/object/sign/tour-media/".length),
        );
        const data = files[key];
        if (!data)
          return route.fulfill({ status: 404, body: "Missing fixture image" });
        return route.fulfill({
          status: 200,
          contentType:
            assets.find((a) => a.path === key)?.content_type || "image/jpeg",
          body: data,
          headers: { "access-control-allow-origin": "*" },
        });
      }
      if (
        path.startsWith("/storage/v1/object/tour-media/") &&
        request.method() === "POST"
      ) {
        const key = decodeURIComponent(
          path.slice("/storage/v1/object/tour-media/".length),
        );
        const isPanorama = key.includes("/panorama/");
        const index =
          (Object.keys(files).filter((k) =>
            k.includes(isPanorama ? "/panorama/" : "/thumbnail/"),
          ).length %
            2) +
          1;
        files[key] =
          request.postDataBuffer() ||
          readFileSync(
            new URL(
              `../assets/seven-${index}-${isPanorama ? "image" : "thumb"}.jpg`,
              import.meta.url,
            ),
          );
        return json({ Key: key });
      }
      return json(
        { message: "Unexpected provider request blocked by UI test" },
        500,
      );
    },
  );
  return {
    clientId,
    projectId,
    projects,
    clients,
    drafts,
    assets,
    versions,
    readSnapshot: () => drafts[projectId]!.snapshot as Snapshot,
  };
}
export const realSevenImage = (index: number) =>
  readFileSync(new URL(`../assets/seven-${index}-image.jpg`, import.meta.url));
