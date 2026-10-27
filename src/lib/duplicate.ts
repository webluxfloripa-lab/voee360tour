import { getEditor, rpc, saveDraft } from "./api";
import { supabase } from "./supabase";
import type { Project } from "./model";
export async function duplicateProject(project: Project) {
  const original = await getEditor(project.id);
  const id = await rpc<string>("manage_project", {
    p_data: {
      client_id: project.client_id,
      title: project.title + " · cópia",
      slug: project.slug + "-" + crypto.randomUUID().slice(0, 8),
    },
  });
  const map = new Map<string, string>();
  for (const asset of original.assets) {
    const aid = crypto.randomUUID(),
      path = asset.path
        .replace(`projects/${project.id}/`, `projects/${id}/`)
        .replace(asset.id, aid);
    const { data: blob, error } = await supabase.storage
      .from("tour-media")
      .download(asset.path);
    if (error) throw error;
    const { error: up } = await supabase.storage
      .from("tour-media")
      .upload(path, blob, { contentType: asset.content_type, upsert: false });
    if (up) throw up;
    await rpc("register_asset", {
      p_data: { ...asset, id: aid, project_id: id, path },
    });
    map.set(asset.id, aid);
  }
  const sceneMap = new Map(
    original.draft.snapshot.scenes.map((s) => [s.id, crypto.randomUUID()]),
  );
  const pairMap = new Map<string, string>();
  const snap = structuredClone(original.draft.snapshot);
  snap.title = project.title + " · cópia";
  snap.firstSceneId = snap.firstSceneId
    ? sceneMap.get(snap.firstSceneId)!
    : null;
  snap.branding.logoAssetId = map.get(snap.branding.logoAssetId ?? "") ?? null;
  snap.branding.ogAssetId = map.get(snap.branding.ogAssetId ?? "") ?? null;
  snap.scenes = snap.scenes.map((s) => ({
    ...s,
    id: sceneMap.get(s.id)!,
    panoramaAssetId: map.get(s.panoramaAssetId ?? "") ?? null,
    thumbnailAssetId: map.get(s.thumbnailAssetId ?? "") ?? null,
    links: s.links.map((a) => {
      if (a.pairId && !pairMap.has(a.pairId))
        pairMap.set(a.pairId, crypto.randomUUID());
      return {
        ...a,
        id: crypto.randomUUID(),
        to: sceneMap.get(a.to)!,
        pairId: a.pairId ? pairMap.get(a.pairId)! : null,
      };
    }),
  }));
  const state = await getEditor(id);
  await saveDraft(id, snap, state.draft.revision);
  return id;
}
