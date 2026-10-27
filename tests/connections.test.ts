import { describe, it, expect } from "vitest";
import {
  emptySnapshot,
  sceneSchema,
  newArrow,
  auditTour,
  snapshotSchema,
} from "../src/lib/model";
import {
  confirmDestination,
  positionReturn,
  counterpart,
  connections,
} from "../src/lib/connections";

function fixture() {
  const snapshot = emptySnapshot("Homologação isolada");
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  snapshot.firstSceneId = a;
  snapshot.scenes = [a, b].map((id, i) =>
    sceneSchema.parse({
      id,
      name: i ? "B" : "A",
      panoramaAssetId: id,
      thumbnailAssetId: id,
      links: [],
    }),
  );
  return { snapshot, a, b };
}
describe("guided project connections", () => {
  it("requires a different destination in this project", () => {
    const { snapshot: s, a } = fixture();
    expect(() => confirmDestination(s, a, a, newArrow(a))).toThrow();
    expect(() =>
      confirmDestination(s, a, crypto.randomUUID(), newArrow(a)),
    ).toThrow();
    expect(s.scenes.flatMap((s) => s.links)).toHaveLength(0);
  });
  it("keeps the confirmed outgoing arrow pending until the physical return is chosen", () => {
    const { snapshot: s, a, b } = fixture();
    const result = confirmDestination(s, a, b, newArrow(a, 37, -15));
    expect(s.scenes[0]!.links).toHaveLength(0);
    expect(result.snapshot.scenes[1]!.links).toHaveLength(0);
    expect(connections(result.snapshot)[0]!.status).toBe("pending");
    expect(auditTour(result.snapshot).missingReturns).toHaveLength(1);
  });
  it("persists independent positions and visual properties under one pair ID", () => {
    const { snapshot: s, a, b } = fixture();
    const forward = confirmDestination(s, a, b, {
      ...newArrow(a, 37, -15),
      size: 80,
      color: "#112233",
    });
    const result = positionReturn(forward.snapshot, a, forward.arrow.id, {
      yaw: -72,
      pitch: -25,
    });
    const [out] = result.snapshot.scenes[0]!.links;
    expect(out).toMatchObject({
      yaw: 37,
      pitch: -15,
      size: 80,
      color: "#112233",
    });
    expect(result.back).toMatchObject({ yaw: -72, pitch: -25, to: a });
    expect(result.back.id).not.toBe(out!.id);
    expect(result.back.pairId).toBe(out!.pairId);
    expect(
      snapshotSchema.parse(JSON.parse(JSON.stringify(result.snapshot))),
    ).toEqual(result.snapshot);
    expect(auditTour(result.snapshot).completeConnections).toBe(1);
    expect(auditTour(result.snapshot).missingReturns).toHaveLength(0);
  });
  it("reopens the same destination without adding arrows or changing the old position", () => {
    const { snapshot: s, a, b } = fixture();
    const first = confirmDestination(s, a, b, newArrow(a, 11, -10));
    const repeated = confirmDestination(
      first.snapshot,
      a,
      b,
      newArrow(a, 90, 40),
    );
    expect(repeated.reused).toBe(true);
    expect(repeated.snapshot).toBe(first.snapshot);
    expect(repeated.arrow.id).toBe(first.arrow.id);
    expect(repeated.arrow.yaw).toBe(11);
  });
  it("repositions only the existing return and preserves both IDs", () => {
    const { snapshot: s, a, b } = fixture();
    const first = confirmDestination(s, a, b, newArrow(a, 21, -10));
    const pair = positionReturn(first.snapshot, a, first.arrow.id, {
      yaw: -54,
      pitch: -17,
    });
    const edited = positionReturn(pair.snapshot, a, first.arrow.id, {
      yaw: -80,
      pitch: -22,
    });
    expect(edited.back.id).toBe(pair.back.id);
    expect(edited.snapshot.scenes[0]).toEqual(pair.snapshot.scenes[0]);
    expect(edited.snapshot.scenes.flatMap((s) => s.links)).toHaveLength(2);
  });
  it("recognizes legacy reciprocal arrows and pairs them only after explicit confirmation", () => {
    const { snapshot: s, a, b } = fixture();
    const out = newArrow(b, 18, -11),
      back = newArrow(a, -80, -22);
    s.scenes[0]!.links = [out];
    s.scenes[1]!.links = [back];
    expect(counterpart(s, a, out.id)?.id).toBe(back.id);
    expect(connections(s)).toHaveLength(1);
    expect(back.pairId).toBeNull();
    const result = positionReturn(s, a, out.id, {
      yaw: back.yaw,
      pitch: back.pitch,
    });
    expect(result.back.id).toBe(back.id);
    expect(result.snapshot.scenes.flatMap((s) => s.links)).toHaveLength(2);
    expect(result.snapshot.scenes[0]!.links[0]!.yaw).toBe(18);
  });
  it("never steals the return of a different paired connection", () => {
    const { snapshot: s, a, b } = fixture();
    const out = newArrow(b),
      back = { ...newArrow(a), pairId: crypto.randomUUID() };
    s.scenes[0]!.links = [out];
    s.scenes[1]!.links = [back];
    expect(counterpart(s, a, out.id)).toBeNull();
    expect(auditTour(s).missingReturns).toHaveLength(1);
    expect(() => positionReturn(s, a, out.id, { yaw: 10, pitch: -10 })).toThrow(
      "Já existe uma volta",
    );
    expect(s.scenes[1]!.links[0]).toEqual(back);
  });
  it("rejects stale targets, invalid positions and inconsistent pair membership", () => {
    const { snapshot: s, a, b } = fixture();
    const first = confirmDestination(s, a, b, newArrow(a));
    expect(() =>
      positionReturn(first.snapshot, a, first.arrow.id, { yaw: NaN, pitch: 0 }),
    ).toThrow();
    expect(() =>
      positionReturn(first.snapshot, a, crypto.randomUUID(), {
        yaw: 0,
        pitch: 0,
      }),
    ).toThrow();
    first.snapshot.scenes[1]!.links.push({
      ...newArrow(b),
      pairId: first.arrow.pairId,
    });
    expect(() =>
      positionReturn(first.snapshot, a, first.arrow.id, { yaw: 0, pitch: 0 }),
    ).toThrow();
    expect(
      auditTour(first.snapshot).errors.some((e) => e.includes("pareamento")),
    ).toBe(true);
  });
});
