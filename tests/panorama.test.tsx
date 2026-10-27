import { render, act, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import AdminPanorama from "../src/components/AdminPanorama";
import { sceneSchema, newArrow } from "../src/lib/model";
const viewers: {
  loaded: boolean;
  added: number;
  handlers: Record<string, () => void>;
}[] = [];
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const scenes = [
  sceneSchema.parse({
    id: a,
    name: "A",
    panoramaAssetId: a,
    thumbnailAssetId: a,
    links: [newArrow(b)],
  }),
  sceneSchema.parse({
    id: b,
    name: "B",
    panoramaAssetId: b,
    thumbnailAssetId: b,
    links: [newArrow(a)],
  }),
];
const props = {
  scenes,
  selected: "",
  mode: "pan" as const,
  onSelect: vi.fn(),
  onPlace: vi.fn(),
  onMove: vi.fn(),
  onNavigate: vi.fn(),
  onView: vi.fn(),
};
beforeEach(() => {
  viewers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  window.pannellum = {
    viewer: () => {
      const state = {
        loaded: false,
        added: 0,
        handlers: {} as Record<string, () => void>,
      };
      viewers.push(state);
      const config: { hotSpots?: { id: string }[] } = {};
      return {
        on: (e: string, fn: () => void) => {
          state.handlers[e] = () => {
            if (e === "load") {
              state.loaded = true;
              config.hotSpots = [];
            }
            fn();
          };
        },
        getConfig: () => config,
        addHotSpot: (h: { id: string }) => {
          if (!state.loaded) throw new Error("not loaded");
          state.added++;
          config.hotSpots!.push(h);
        },
        removeHotSpot: vi.fn(),
        resize: vi.fn(),
        destroy: vi.fn(),
      };
    },
  };
});
afterEach(() => {
  cleanup();
  delete window.pannellum;
  vi.unstubAllGlobals();
});
describe("Pannellum load lifecycle regression", () => {
  it("adds hotspots only after new panorama load", async () => {
    const view = render(
      <AdminPanorama
        {...props}
        scene={scenes[0]!}
        image="a.jpg"
        arrows={scenes[0]!.links}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(viewers[0]!.added).toBe(0);
    act(() => viewers[0]!.handlers.load!());
    expect(viewers[0]!.added).toBe(1);
    view.rerender(
      <AdminPanorama
        {...props}
        scene={scenes[1]!}
        image="b.jpg"
        arrows={scenes[1]!.links}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(viewers[1]!.added).toBe(0);
    act(() => viewers[1]!.handlers.load!());
    expect(viewers[1]!.added).toBe(1);
  });
});
