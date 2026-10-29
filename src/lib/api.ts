import { supabase } from "./supabase";
import {
  snapshotSchema,
  clientInputSchema,
  projectInputSchema,
  type Asset,
  type Client,
  type Draft,
  type Project,
  type Snapshot,
  type Version,
} from "./model";
export async function rpc<T>(name: string, args: Record<string, unknown>) {
  if (name === "manage_client")
    args = { ...args, p_data: clientInputSchema.parse(args.p_data) };
  if (name === "manage_project")
    args = { ...args, p_data: projectInputSchema.parse(args.p_data) };
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function fetchAll(
  table: string,
  filter?: { key: string; value: string },
) {
  const rows: any[] = [];
  for (let from = 0; ; from += 500) {
    let q = supabase
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + 499);
    if (filter) q = q.eq(filter.key, filter.value);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export async function getDashboard() {
  const [clients, projects, assets, v] = await Promise.all([
    fetchAll("clients"),
    fetchAll("projects"),
    fetchAll("media_assets"),
    supabase
      .from("tour_versions")
      .select("id,project_id,version_number,kind,note,created_at,author_id")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (v.error) throw v.error;
  return {
    clients: clients as Client[],
    projects: (projects as Project[]).sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    ),
    assets: assets as Asset[],
    versions: v.data as Version[],
  };
}
export async function getEditor(projectId: string) {
  const [p, d, a, v] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase
      .from("tour_drafts")
      .select("*")
      .eq("project_id", projectId)
      .single(),
    fetchAll("media_assets", { key: "project_id", value: projectId }).then(
      (data) => ({ data, error: null }),
    ),
    fetchAll("tour_versions", { key: "project_id", value: projectId }).then(
      (data) => ({
        data: data.sort((a, b) => b.version_number - a.version_number),
        error: null,
      }),
    ),
  ]);
  for (const r of [p, d, a, v]) if (r.error) throw r.error;
  const draft = d.data as Draft;
  draft.snapshot = snapshotSchema.parse(draft.snapshot);
  return {
    project: p.data as Project,
    draft,
    assets: a.data as Asset[],
    versions: v.data as Version[],
  };
}
export async function saveDraft(
  projectId: string,
  snapshot: Snapshot,
  revision: string,
) {
  return rpc<string>("save_draft", {
    p_project: projectId,
    p_snapshot: snapshotSchema.parse(snapshot),
    p_expected: revision,
  });
}
export async function signedAssets(assets: Pick<Asset, "id" | "path">[]) {
  const map: Record<string, string> = {};
  if (!assets.length) return map;
  for (let offset = 0; offset < assets.length; offset += 100) {
    const batch = assets.slice(offset, offset + 100);
    const { data, error } = await supabase.storage
      .from("tour-media")
      .createSignedUrls(
        batch.map((a) => a.path),
        3600,
      );
    if (error) throw error;
    for (let i = 0; i < batch.length; i++) {
      const result = data?.[i];
      if (!result?.signedUrl || result.error)
        throw new Error("Não foi possível carregar uma das fotografias. Tente novamente.");
      map[batch[i]!.id] = result.signedUrl;
    }
  }
  return map;
}
export async function getPublicTour(slug: string) {
  const { data, error } = await supabase
    .from("published_tours")
    .select("project_id,slug,version_id,snapshot,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const snapshot = snapshotSchema.parse(data.snapshot);
  const ids = new Set(
    snapshot.scenes
      .flatMap((s) => [s.panoramaAssetId, s.thumbnailAssetId])
      .concat([snapshot.branding.logoAssetId, snapshot.branding.ogAssetId])
      .filter((s): s is string => !!s),
  );
  // Anonymous RLS exposes only assets referenced by this publication. Paging
  // avoids both PostgREST's row cap and a very large `in` URL on larger tours.
  const assets = await fetchAll("media_assets", {
    key: "project_id",
    value: data.project_id,
  });
  const media = (assets as Asset[])
    .filter((a) => ids.has(a.id))
    .map(({ id, path }) => ({ id, path }));
  const urls = await signedAssets(media);
  return { ...data, snapshot, urls, media };
}
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteProject(projectId: string, confirmation: string) {
  const { data, error } = await supabase.functions.invoke("delete-tour", {
    body: { projectId, confirmation },
  });
  if (error) {
    let message = "Não foi possível excluir o passeio. Tente novamente.";
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json();
        if (typeof body.message === "string") message = body.message;
      } catch { /* Keep the safe default message. */ }
    }
    throw new Error(message);
  }
  if (data?.deleted !== true) throw new Error("A exclusão ainda não foi concluída.");
}

export async function backupProject(
  projectId: string,
  onProgress: (message: string) => void,
) {
  const state = await getEditor(projectId);
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file(
    "project.json",
    JSON.stringify(
      {
        format: "voee360tour-backup-v1",
        project: state.project,
        draft: state.draft,
        versions: state.versions,
        assets: state.assets,
      },
      null,
      2,
    ),
  );
  for (let i = 0; i < state.assets.length; i++) {
    const asset = state.assets[i]!;
    onProgress(`Baixando fotografia ${i + 1}/${state.assets.length}…`);
    const { data, error } = await supabase.storage
      .from("tour-media")
      .download(asset.path);
    if (error) throw error;
    const bytes = await data.arrayBuffer();
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== asset.sha256)
      throw new Error(
        "Falha na integridade de uma fotografia. O backup foi interrompido.",
      );
    zip.file("media/" + asset.path, bytes);
  }
  onProgress("Preparando backup…");
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = state.project.slug + "-backup.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
