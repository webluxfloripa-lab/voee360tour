import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ version: vi.fn(), tour: vi.fn() }));
vi.mock("../src/lib/api", () => ({ getPublicVersion: api.version, getPublicTour: api.tour }));
import { usePublishedTour } from "../src/lib/usePublishedTour";
import { emptySnapshot } from "../src/lib/model";
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it("an open public tour follows new publications and recovers after a failed read", async () => {
  const first = {slug: "tour", version_id: "v1", project_id: "p", updated_at: "", snapshot: emptySnapshot("V1"), urls: {}, media: []};
  const next = {...first, version_id: "v2", snapshot: emptySnapshot("V2")};
  api.version.mockResolvedValue("v1");
  api.tour.mockResolvedValue(next);
  const view = renderHook(() => usePublishedTour(first));
  await waitFor(() => expect(api.version).toHaveBeenCalled());
  expect(api.tour).not.toHaveBeenCalled();
  api.version.mockRejectedValueOnce(new Error("offline"));
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(view.result.current?.version_id).toBe("v1");
  api.version.mockResolvedValue("v2");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(view.result.current?.snapshot.title).toBe("V2");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(api.tour).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(api.tour).toHaveBeenCalledTimes(1);
});

it("renews signed media before expiry without resetting an unchanged tour", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
  const first = {
    slug: "tour", version_id: "v1", project_id: "p", updated_at: "",
    snapshot: emptySnapshot("V1"), urls: { logo: "old-signed-url" },
    media: [{ id: "logo", path: "projects/p/logo.png" }],
  };
  // The API returns fresh JSON objects even though this is the same version.
  api.version.mockResolvedValue("v1");
  api.tour.mockResolvedValue({
    ...first, snapshot: emptySnapshot("V1"), media: [...first.media],
    urls: { logo: "renewed-signed-url" },
  });
  const view = renderHook(() => usePublishedTour(first));
  await act(async () => { await vi.advanceTimersByTimeAsync(44 * 60 * 1000); });
  expect(api.tour).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(60 * 1000); });
  expect(api.tour).toHaveBeenCalledTimes(1);
  expect(view.result.current?.urls.logo).toBe("renewed-signed-url");
  expect(view.result.current?.snapshot).toBe(first.snapshot);
  expect(view.result.current?.media).toBe(first.media);
  await act(async () => { await vi.advanceTimersByTimeAsync(60 * 1000); });
  expect(api.tour).toHaveBeenCalledTimes(1);
  view.unmount();
});

it("hides a withdrawn publication and recovers if the same version returns", async () => {
  const first = {slug: "tour", version_id: "v1", project_id: "p", updated_at: "", snapshot: emptySnapshot("V1"), urls: {}, media: []};
  api.version.mockResolvedValue("v1");
  api.tour.mockResolvedValue(first);
  const view = renderHook(() => usePublishedTour(first));
  await waitFor(() => expect(api.version).toHaveBeenCalled());
  api.version.mockResolvedValue(undefined);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(view.result.current).toBeNull();
  api.version.mockRejectedValueOnce(new Error("offline"));
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(view.result.current).toBeNull();
  api.version.mockResolvedValue("v1");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(view.result.current?.snapshot.title).toBe("V1");
  expect(api.tour).toHaveBeenCalledTimes(1);
  view.unmount();
});

it("hides a publication withdrawn between its version and snapshot reads", async () => {
  const first = {slug: "tour", version_id: "v1", project_id: "p", updated_at: "", snapshot: emptySnapshot("V1"), urls: {}, media: []};
  api.version.mockResolvedValue("v1");
  const view = renderHook(() => usePublishedTour(first));
  await waitFor(() => expect(api.version).toHaveBeenCalled());
  api.version.mockResolvedValue("v2");
  api.tour.mockResolvedValue(null);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(view.result.current).toBeNull();
  view.unmount();
});
