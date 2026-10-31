import { expect, it, vi } from "vitest";
import { emptySnapshot, projectInputSchema, snapshotSchema, type Project } from "../src/lib/model";
const api = vi.hoisted(() => ({ getEditor: vi.fn(), rpc: vi.fn(), saveDraft: vi.fn() }));
vi.mock("../src/lib/api", () => api);
vi.mock("../src/lib/supabase", () => ({ supabase: { storage: { from: vi.fn() } } }));
import { duplicateProject } from "../src/lib/duplicate";

it("duplicates maximum-length titles and slugs with valid unique copy metadata", async () => {
  const project = {
    id: "11111111-1111-4111-8111-111111111111",
    client_id: "22222222-2222-4222-8222-222222222222",
    title: "T".repeat(160),
    slug: "a".repeat(90) + "-" + "b".repeat(9),
  } as Project;
  const clone = "33333333-3333-4333-8333-333333333333";
  api.getEditor.mockResolvedValueOnce({ assets: [], draft: { snapshot: emptySnapshot(project.title) } })
    .mockResolvedValueOnce({ draft: { revision: "new-revision" } });
  api.rpc.mockImplementation(async (_name: string, args: { p_data: unknown }) => {
    expect(projectInputSchema.safeParse(args.p_data).success).toBe(true);
    return clone;
  });
  api.saveDraft.mockResolvedValue("saved-revision");

  await expect(duplicateProject(project)).resolves.toBe(clone);
  const input = api.rpc.mock.calls[0]![1].p_data;
  expect(input.title).toHaveLength(160);
  expect(input.title).toMatch(/ · cópia$/);
  expect(input.slug).not.toContain("--");
  expect(input.slug.length).toBeLessThanOrEqual(100);
  expect(input.slug).not.toBe(project.slug);
  const saved = api.saveDraft.mock.calls[0]![1];
  expect(snapshotSchema.safeParse(saved).success).toBe(true);
  expect(saved.title).toBe(input.title);
});
