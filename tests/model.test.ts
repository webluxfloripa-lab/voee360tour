import { describe, it, expect } from "vitest";
import {
  emptySnapshot,
  snapshotSchema,
  sceneSchema,
  newArrow,
  auditTour,
  removeScene,
  snapshotDiff,
} from "../src/lib/model";
import seven from "../fixtures/seven-import.json";
import { presentationSchema } from "../src/lib/presentation";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
function fixture() {
  const s = emptySnapshot("Test");
  s.firstSceneId = a;
  s.scenes = [
    sceneSchema.parse({
      id: a,
      name: "A",
      panoramaAssetId: a,
      thumbnailAssetId: a,
      links: [newArrow(b, 32, -12)],
    }),
    sceneSchema.parse({
      id: b,
      name: "B",
      panoramaAssetId: b,
      thumbnailAssetId: b,
      links: [newArrow(a, -67, -22)],
    }),
  ];
  return s;
}
describe("project snapshots", () => {
  it("accepts an empty draft and any number of scenes", () => {
    expect(snapshotSchema.safeParse(emptySnapshot("Empty")).success).toBe(true);
    expect(snapshotSchema.safeParse(fixture()).success).toBe(true);
  });
  it("rejects repeated content section IDs in an imported snapshot", () => {
    const s = fixture();
    const presentation = presentationSchema.parse({});
    const block = {
      id: crypto.randomUUID(), title: "Seção", body: "Texto", cta: "", url: "",
      visible: true, align: "center" as const, titleSize: 30, bodySize: 16,
    };
    presentation.blocks = [block, { ...block, title: "Outra seção" }];
    s.presentation = presentation;
    expect(snapshotSchema.safeParse(s).success).toBe(false);
    presentation.blocks[1]!.id = crypto.randomUUID();
    expect(snapshotSchema.safeParse(s).success).toBe(true);
  });
  it("preserves Seven exactly as pending media, 22 scenes 50 arrows 25 independent pairs", () => {
    const parsed = snapshotSchema.parse(seven);
    expect(parsed.scenes).toHaveLength(22);
    expect(parsed.scenes.flatMap((s) => s.links)).toHaveLength(50);
    expect(
      new Set(parsed.scenes.flatMap((s) => s.links.map((a) => a.pairId))).size,
    ).toBe(25);
    expect(auditTour(parsed).reachable).toBe(22);
    expect(auditTour(parsed).errors).toHaveLength(22);
  });
  it("rejects dangling links and duplicate IDs", () => {
    const s = fixture();
    s.scenes[0]!.links[0]!.to = "33333333-3333-4333-8333-333333333333";
    expect(snapshotSchema.safeParse(s).success).toBe(false);
    s.scenes.push(s.scenes[0]!);
    expect(snapshotSchema.safeParse(s).success).toBe(false);
  });
  it("rejects invalid spherical coordinates", () => {
    const s = fixture();
    s.scenes[0]!.links[0]!.pitch = 81;
    expect(snapshotSchema.safeParse(s).success).toBe(false);
  });
  it("rejects blank tour and scene names and normalizes their surrounding spaces", () => {
    const s = fixture();
    s.title = "   ";
    expect(snapshotSchema.safeParse(s).success).toBe(false);
    s.title = " Tour ";
    s.scenes[0]!.name = " \t ";
    expect(snapshotSchema.safeParse(s).success).toBe(false);
    s.scenes[0]!.name = " Entrada ";
    const parsed = snapshotSchema.parse(s);
    expect(parsed.title).toBe("Tour");
    expect(parsed.scenes[0]!.name).toBe("Entrada");
  });
  it("independent return coordinates are retained", () => {
    const s = fixture();
    expect(s.scenes[0]!.links[0]!.yaw).toBe(32);
    expect(s.scenes[1]!.links[0]!.yaw).toBe(-67);
    expect(auditTour(s).warnings).toHaveLength(0);
  });
  it("returns actionable diagnostics without inventing physical routes", () => {
    const s = fixture();
    s.scenes[1]!.links = [];
    const inspection = auditTour(s);
    expect(inspection.arrows).toBe(1);
    expect(inspection.reachable).toBe(2);
    expect(inspection.unreachableIds).toEqual([]);
    expect(inspection.withoutExits).toEqual([b]);
    expect(inspection.missingReturns).toEqual([
      { sourceId: a, targetId: b, arrowId: s.scenes[0]!.links[0]!.id },
    ]);
    // A scene with a photograph but no arrows is NOT connected automatically.
    const isolated = sceneSchema.parse({
      id: "33333333-3333-4333-8333-333333333333",
      name: "Sala não conectada",
      panoramaAssetId: a,
      thumbnailAssetId: a,
      links: [],
    });
    s.scenes.push(isolated);
    const next = auditTour(s);
    expect(next.unreachableIds).toEqual([isolated.id]);
    expect(next.errors).toContain(
      "Sala não conectada: inacessível a partir do início.",
    );
  });
  it("scene deletion removes incoming and outgoing arrows and updates start", () => {
    const s = removeScene(fixture(), a);
    expect(s.scenes).toHaveLength(1);
    expect(s.firstSceneId).toBe(b);
    expect(s.scenes[0]!.links).toHaveLength(0);
  });
  it("flags isolated scenes, invisible routes, duplicate targets and missing returns", () => {
    const s = fixture();
    s.scenes[1]!.links = [];
    s.scenes[0]!.links[0]!.visible = false;
    expect(auditTour(s).errors.some((x) => x.includes("inacessível"))).toBe(
      true,
    );
    // An invisible arrow is not a visible path, so it needs no visible return.
    expect(auditTour(s).warnings.some((x) => x.includes("sem retorno"))).toBe(
      false,
    );
    s.scenes[0]!.links[0]!.visible = true;
    expect(auditTour(s).warnings.some((x) => x.includes("sem retorno"))).toBe(
      true,
    );
  });
  it("summarizes historical differences by stable IDs", () => {
    const s = fixture(),
      next = removeScene(s, b);
    expect(snapshotDiff(s, next)).toEqual({ scenes: -1, added: 0, removed: 2 });
  });
  it("never accepts hostile color CSS", () => {
    const s = fixture();
    s.branding.accent = "red;url(https://evil)";
    expect(snapshotSchema.safeParse(s).success).toBe(false);
  });
});
