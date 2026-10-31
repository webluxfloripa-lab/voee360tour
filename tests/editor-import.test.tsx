import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptySnapshot, snapshotSchema } from "../src/lib/model";
const api = vi.hoisted(() => ({
  getEditor: vi.fn(), saveDraft: vi.fn(), publishDraft: vi.fn(), rpc: vi.fn(),
  signedAssets: vi.fn(), downloadJson: vi.fn(), backupProject: vi.fn(),
}));
const media = vi.hoisted(() => ({ uploadPanorama: vi.fn(), uploadBrandImage: vi.fn() }));
vi.mock("../src/lib/api", () => api);
vi.mock("../src/lib/media", () => media);
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  ClientOnly: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../src/components/AdminPanorama", () => ({ default: () => <div>Panorama</div> }));
import { TourEditor } from "../src/components/TourEditor";

const projectId = "11111111-1111-4111-8111-111111111111";
const foreignId = "22222222-2222-4222-8222-222222222222";
function initial() {
  return {
    project: { id: projectId, client_id: foreignId, title: "Tour", slug: "tour", status: "draft" as const,
      published_version_id: null, created_at: "", updated_at: "" },
    draft: { project_id: projectId, revision: "revision", snapshot: emptySnapshot("Tour"), updated_at: "" },
    assets: [], versions: [],
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  api.signedAssets.mockResolvedValue({});
  vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each(["logoAssetId", "ogAssetId"] as const)("rejects an imported foreign %s before replacing the local draft", async (key) => {
  const view = render(<TourEditor initial={initial()} />);
  const snapshot = emptySnapshot("Arquivo estrangeiro");
  snapshot.branding[key] = foreignId;
  const file = new File([JSON.stringify(snapshot)], "tour.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => JSON.stringify(snapshot) });
  fireEvent.change(view.container.querySelector('input[accept="application/json,.json"]')!, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("não pertencem ao projeto"));
  fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
  expect(api.downloadJson.mock.calls[0]![0].title).toBe("Tour");
  expect(window.confirm).not.toHaveBeenCalled();
});

it("uploads a photograph with a long filename while keeping its new scene saveable", async () => {
  const panorama = { id: foreignId, project_id: projectId };
  const thumbnail = { id: "33333333-3333-4333-8333-333333333333", project_id: projectId };
  media.uploadPanorama.mockResolvedValue({ panorama, thumbnail });
  const view = render(<TourEditor initial={initial()} />);
  const file = new File(["photo"], "  " + "A".repeat(180) + ".jpg", { type: "image/jpeg" });
  fireEvent.change(view.container.querySelector('input[type="file"][multiple]')!, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Fotografias enviadas"));
  fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
  const saved = api.downloadJson.mock.calls[0]![0];
  expect(saved.scenes[0].name).toHaveLength(120);
  expect(saved.scenes[0].name).toBe("A".repeat(120));
  expect(snapshotSchema.safeParse(saved).success).toBe(true);
});
