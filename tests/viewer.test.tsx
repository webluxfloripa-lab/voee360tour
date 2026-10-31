import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptySnapshot, sceneSchema } from "../src/lib/model";
const state = vi.hoisted(() => ({
  sign: vi.fn(),
  viewers: [] as { config: any; handlers: Record<string, (...args: any[]) => void>; stop: ReturnType<typeof vi.fn> }[],
}));
vi.mock("../src/lib/api", () => ({ signedAssets: state.sign }));
vi.mock("../src/lib/pannellum-loader", () => ({
  loadPannellum: async () => ({ viewer: (_el: unknown, config: any) => {
    const item = { config, handlers: {} as Record<string, (...args: any[]) => void>, stop: vi.fn() };
    state.viewers.push(item);
    return { on: (event: string, handler: (...args: any[]) => void) => { item.handlers[event] = handler; }, resize: vi.fn(), destroy: vi.fn(), stopAutoRotate: item.stop };
  } }),
}));
const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222";
const snapshot = emptySnapshot("QA");
snapshot.firstSceneId = a;
snapshot.settings.autoRotate = true;
snapshot.scenes = [sceneSchema.parse({ id: a, name: "Entrada", panoramaAssetId: a, thumbnailAssetId: a, links: [] }), sceneSchema.parse({ id: b, name: "Salão", panoramaAssetId: b, thumbnailAssetId: b, links: [] })];
const urls = { [a]: "old-a.jpg", [b]: "old-b.jpg" };
const media = [{ id: a, path: "a.jpg" }, { id: b, path: "b.jpg" }];
const Viewer = (await import("../src/components/TourViewer")).default;
beforeEach(() => {
  vi.useFakeTimers();
  state.viewers.length = 0;
  state.sign.mockReset();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("renews expiring image URLs and preserves the current scene and pause preference", async () => {
  state.sign.mockResolvedValue({ [a]: "new-a.jpg", [b]: "new-b.jpg" });
  render(<Viewer snapshot={snapshot} urls={urls} media={media} />);
  await act(async () => {});
  act(() => state.viewers[0]!.handlers.scenechange!(b));
  fireEvent.click(screen.getByRole("button", { name: "Pausar movimento automático" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(46 * 60 * 1000); });
  expect(state.sign).toHaveBeenCalledTimes(1);
  expect(state.viewers.at(-1)!.config.default.firstScene).toBe(b);
  expect(state.viewers.at(-1)!.config.scenes[b].panorama).toBe("new-b.jpg");
  expect(state.viewers.at(-1)!.config.default.autoRotate).toBe(false);
  expect(screen.getByText("Salão")).toBeVisible();
});
it("recovers expired media with retry and closes the scene dialog with Escape", async () => {
  state.sign.mockResolvedValue({ [a]: "new-a.jpg", [b]: "new-b.jpg" });
  render(<Viewer snapshot={snapshot} urls={urls} media={media} />);
  await act(async () => {});
  act(() => state.viewers[0]!.handlers.error!());
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" })); });
  expect(state.sign).toHaveBeenCalledTimes(1);
  expect(state.viewers.at(-1)!.config.scenes[a].panorama).toBe("new-a.jpg");
  screen.getByRole("button", { name: "Ambientes" }).focus();
  fireEvent.click(screen.getByRole("button", { name: "Ambientes" }));
  expect(screen.getByRole("dialog", { name: "Menu de ambientes" })).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ambientes" })).toHaveFocus();
});
it("ignores a late media renewal after a newer publication supplies its URLs", async () => {
  let finishRenewal!: (urls: Record<string, string>) => void;
  state.sign.mockReturnValue(new Promise<Record<string, string>>((resolve) => {
    finishRenewal = resolve;
  }));
  const view = render(<Viewer snapshot={snapshot} urls={urls} media={media} />);
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(45 * 60 * 1000); });
  expect(state.sign).toHaveBeenCalledTimes(1);

  const nextSnapshot = { ...snapshot, title: "Nova publicação" };
  const nextUrls = { [a]: "published-a.jpg", [b]: "published-b.jpg" };
  const nextMedia = media.map((asset) => ({ ...asset, path: "published/" + asset.path }));
  view.rerender(<Viewer snapshot={nextSnapshot} urls={nextUrls} media={nextMedia} />);
  await act(async () => {});
  await act(async () => {
    finishRenewal({ [a]: "expired-publication-a.jpg", [b]: "expired-publication-b.jpg" });
  });
  expect(state.viewers.at(-1)!.config.scenes[a].panorama).toBe("published-a.jpg");
  expect(state.viewers.at(-1)!.config.scenes[b].panorama).toBe("published-b.jpg");
});
