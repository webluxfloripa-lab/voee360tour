import { z } from "zod";
import { presentationSchema } from "./presentation";
const id = z.string().uuid();
export const arrowSchema = z.object({
  id,
  to: id,
  pairId: id.nullable().default(null),
  yaw: z.number().min(-180).max(180),
  pitch: z.number().min(-62).max(80),
  rotation: z.number().min(-180).max(180).default(0),
  size: z.number().min(24).max(120).default(52),
  opacity: z.number().min(0.1).max(1).default(1),
  label: z.string().max(100).default(""),
  style: z.enum(["circle", "plain"]).default("circle"),
  tone: z.enum(["primary", "foreground"]).default("primary"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#b5ed80"),
  icon: z.enum(["arrow", "chevron"]).default("arrow"),
  visible: z.boolean().default(true),
});
export const sceneSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  group: z.string().max(100).default(""),
  panoramaAssetId: id.nullable(),
  thumbnailAssetId: id.nullable(),
  yaw: z.number().min(-180).max(180).default(0),
  pitch: z.number().min(-62).max(80).default(0),
  hfov: z.number().min(50).max(120).default(105),
  links: z.array(arrowSchema),
});
export const snapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    presentation: presentationSchema.optional(),
    title: z.string().min(1).max(160),
    description: z.string().max(1000).default(""),
    firstSceneId: id.nullable(),
    branding: z.object({
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      logoAssetId: id.nullable().default(null),
      ogAssetId: id.nullable().default(null),
    }),
    settings: z.object({
      hfov: z.number().min(50).max(120),
      minHfov: z.number().min(30).max(100),
      maxHfov: z.number().min(90).max(140),
      autoRotate: z.boolean(),
    }),
    scenes: z.array(sceneSchema),
  })
  .superRefine((v, ctx) => {
    const ids = new Set(v.scenes.map((s) => s.id));
    const arrows = new Set<string>();
    if (ids.size !== v.scenes.length)
      ctx.addIssue({ code: "custom", message: "Ambiente duplicado." });
    if (v.firstSceneId && !ids.has(v.firstSceneId))
      ctx.addIssue({ code: "custom", message: "Cena inicial inválida." });
    if (
      v.settings.minHfov > v.settings.hfov ||
      v.settings.hfov > v.settings.maxHfov
    )
      ctx.addIssue({ code: "custom", message: "Limites de zoom inválidos." });
    for (const s of v.scenes)
      for (const a of s.links) {
        if (!ids.has(a.to) || arrows.has(a.id))
          ctx.addIssue({
            code: "custom",
            message: "Destino inexistente ou seta duplicada.",
          });
        arrows.add(a.id);
      }
  });
export type Arrow = z.infer<typeof arrowSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Asset = {
  id: string;
  project_id: string;
  path: string;
  content_type: string;
  width: number;
  height: number;
  file_size: number;
  sha256: string;
  kind: "panorama" | "thumbnail" | "logo" | "social";
  status: string;
};
export type Client = {
  id: string;
  name: string;
  slug: string;
  contact: string;
  email: string;
  active: boolean;
  logo_asset_id: string | null;
  created_at: string;
};
export type Project = {
  id: string;
  client_id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "pending_media" | "archived";
  deletion_pending?: boolean;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
};
export type Version = {
  id: string;
  project_id: string;
  version_number: number;
  kind: string;
  note: string;
  created_at: string;
  snapshot: Snapshot;
  author_id: string;
};
export type Draft = {
  project_id: string;
  revision: string;
  snapshot: Snapshot;
  updated_at: string;
};
export function emptySnapshot(title: string): Snapshot {
  return {
    schemaVersion: 1,
    title,
    description: "",
    firstSceneId: null,
    branding: { accent: "#b5ed80", logoAssetId: null, ogAssetId: null },
    settings: { hfov: 105, minHfov: 50, maxHfov: 120, autoRotate: false },
    scenes: [],
  };
}
export function newArrow(to: string, yaw = 0, pitch = -15): Arrow {
  return arrowSchema.parse({ id: crypto.randomUUID(), to, yaw, pitch });
}
export function auditTour(s: Snapshot) {
  const errors: string[] = [],
    warnings: string[] = [];
  const missingReturns: Array<{
    sourceId: string;
    targetId: string;
    arrowId: string;
  }> = [];
  const withoutExits: string[] = [];
  const ids = new Set(s.scenes.map((s) => s.id));
  const pairs = new Map<string, Array<{ source: string; arrow: Arrow }>>();
  const complete = new Set<string>();
  for (const scene of s.scenes)
    for (const arrow of scene.links) {
      if (arrow.pairId)
        pairs.set(arrow.pairId, [
          ...(pairs.get(arrow.pairId) ?? []),
          { source: scene.id, arrow },
        ]);
    }
  for (const members of pairs.values()) {
    if (
      members.length > 2 ||
      (members.length === 2 &&
        (members[0]!.arrow.to !== members[1]!.source ||
          members[1]!.arrow.to !== members[0]!.source))
    )
      errors.push(
        "Há uma conexão com pareamento inconsistente. Revise a ida e a volta.",
      );
  }
  if (!s.scenes.length) errors.push("Adicione pelo menos um ambiente.");
  if (!s.firstSceneId || !ids.has(s.firstSceneId))
    errors.push("Defina o ambiente inicial.");
  for (const scene of s.scenes) {
    if (!scene.panoramaAssetId || !scene.thumbnailAssetId)
      errors.push(`${scene.name}: fotografia ou miniatura ausente.`);
    if (s.scenes.length > 1 && !scene.links.some((a) => a.visible)) {
      warnings.push(`${scene.name}: sem saída visível.`);
      withoutExits.push(scene.id);
    }
    for (const a of scene.links) {
      const dest = s.scenes.find((s) => s.id === a.to);
      const reverse =
        dest?.links.filter((b) => b.to === scene.id && b.visible) ?? [];
      const paired = reverse.find((b) => !!a.pairId && b.pairId === a.pairId);
      const unpaired = reverse.filter((b) => !b.pairId);
      const legacy =
        unpaired.length === 1 &&
        scene.links.filter((b) => b.to === a.to).length === 1
          ? unpaired[0]
          : undefined;
      const back = paired ?? legacy;
      if (!dest || dest.id === scene.id)
        errors.push(`${scene.name}: destino inválido.`);
      else if (a.visible && !back) {
        warnings.push(`${scene.name} → ${dest.name}: sem retorno visível.`);
        missingReturns.push({
          sourceId: scene.id,
          targetId: dest.id,
          arrowId: a.id,
        });
      }
      if (a.visible && back) complete.add([a.id, back.id].sort().join(":"));
      if (scene.links.some((b) => b.id !== a.id && b.to === a.to))
        warnings.push(
          `${scene.name}: conexões repetidas para o mesmo destino.`,
        );
      if (
        scene.links.some(
          (b) =>
            b.id !== a.id &&
            Math.hypot(((a.yaw - b.yaw + 540) % 360) - 180, a.pitch - b.pitch) <
              12,
        )
      )
        warnings.push(`${scene.name}: setas próximas; revise visualmente.`);
    }
  }
  const reachable = new Set<string>();
  const walk = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    s.scenes
      .find((x) => x.id === id)
      ?.links.filter((a) => a.visible)
      .forEach((a) => walk(a.to));
  };
  if (s.firstSceneId) walk(s.firstSceneId);
  for (const scene of s.scenes)
    if (!reachable.has(scene.id))
      errors.push(`${scene.name}: inacessível a partir do início.`);
  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    reachable: reachable.size,
    arrows: s.scenes.reduce((n, s) => n + s.links.length, 0),
    unreachableIds: s.scenes
      .filter((scene) => !reachable.has(scene.id))
      .map((scene) => scene.id),
    withoutExits,
    missingReturns,
    completeConnections: complete.size,
    isolatedIds: s.scenes
      .filter(
        (scene) =>
          !scene.links.length &&
          !s.scenes.some((other) => other.links.some((a) => a.to === scene.id)),
      )
      .map((scene) => scene.id),
  };
}
export function removeScene(s: Snapshot, id: string): Snapshot {
  const scenes = s.scenes
    .filter((x) => x.id !== id)
    .map((x) => ({ ...x, links: x.links.filter((a) => a.to !== id) }));
  return {
    ...s,
    scenes,
    firstSceneId:
      s.firstSceneId === id ? (scenes[0]?.id ?? null) : s.firstSceneId,
  };
}
export function snapshotDiff(a: Snapshot, b: Snapshot) {
  const ai = new Set(a.scenes.flatMap((s) => s.links.map((a) => a.id))),
    bi = new Set(b.scenes.flatMap((s) => s.links.map((a) => a.id)));
  return {
    scenes: b.scenes.length - a.scenes.length,
    added: [...bi].filter((x) => !ai.has(x)).length,
    removed: [...ai].filter((x) => !bi.has(x)).length,
  };
}
export function errorText(e: unknown) {
  const m =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e && "message" in e
        ? String(e.message)
        : "";
  if (typeof e === "object" && e && "code" in e && e.code === "23505")
    return "Este identificador ou endereço já está em uso. Escolha outro.";
  if (m.includes("REVISION_CONFLICT"))
    return "Outra aba salvou alterações. Exporte seu trabalho e recarregue antes de continuar.";
  if (m.includes("SUPER_ADMIN_REQUIRED"))
    return "Acesso exclusivo da superadministradora.";
  if (m.includes("MEDIA_MISSING"))
    return "Há fotografias ausentes ou inválidas. Revise os ambientes.";
  if (m.includes("Invalid login")) return "E-mail ou senha inválidos.";
  return m && m.length < 240 && !m.startsWith("[")
    ? m
    : "Não foi possível concluir. Confira os dados e tente novamente.";
}

export const clientInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(100),
  email: z.string().email().or(z.literal("")).default(""),
  contact: z.string().max(200).default(""),
  active: z.boolean().default(true),
  logo_asset_id: z.string().uuid().nullable().default(null),
});
export const projectInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(160).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(100)
      .optional(),
    status: z.enum(["draft", "archived"]).optional(),
  })
  .superRefine((v, c) => {
    if (!v.id && (!v.client_id || !v.title || !v.slug))
      c.addIssue({
        code: "custom",
        message: "Informe cliente, título e endereço.",
      });
  });
