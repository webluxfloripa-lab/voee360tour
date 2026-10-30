import { beforeEach, it, expect, vi } from "vitest";
import { emptySnapshot, type Asset } from "../src/lib/model";
const fixture = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  sign: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => {
  const client = {
    rpc: fixture.rpc,
    from: (table: string) => {
      const filters: Array<[string, string]> = [];
      let start = 0,
        end: number | undefined,
        single = false;
      const query = {
        select: () => query,
        order: () => query,
        eq: (key: string, value: string) => {
          filters.push([key, value]);
          return query;
        },
        range: (from: number, to: number) => {
          start = from;
          end = to;
          return query;
        },
        maybeSingle: () => { single = true; return query; },
        single: () => {
          single = true;
          return query;
        },
        then: (resolve: (value: unknown) => unknown) => {
          const filtered = (fixture.tables[table] ?? []).filter((row) =>
            filters.every(([key, value]) => row[key] === value),
          );
          // Simulate the real provider's default 1,000-row response cap.
          const rows = filtered.slice(
            start,
            end === undefined ? 1000 : end + 1,
          );
          return Promise.resolve({
            data: single ? rows[0] : rows,
            error: null,
          }).then(resolve);
        },
      };
      return query;
    },
    storage: { from: () => ({ createSignedUrls: fixture.sign }) },
  };
  return { supabase: client, publicSupabase: client };
});
import { getEditor, signedAssets, publishDraft } from "../src/lib/api";
beforeEach(() => {
  fixture.tables = {};
  fixture.sign.mockReset();
  fixture.rpc.mockReset();
});
it("loads and orders more than 1,000 immutable versions for editor and backup", async () => {
  const projectId = crypto.randomUUID();
  fixture.tables.projects = [{ id: projectId }];
  fixture.tables.tour_drafts = [
    { project_id: projectId, snapshot: emptySnapshot("QA") },
  ];
  fixture.tables.tour_versions = Array.from({ length: 1101 }, (_, i) => ({
    id: String(i),
    project_id: projectId,
    version_number: i + 1,
  }));
  const result = await getEditor(projectId);
  expect(result.versions).toHaveLength(1101);
  expect(result.versions[0]!.version_number).toBe(1101);
  expect(result.versions.at(-1)!.version_number).toBe(1);
});
it("signs every image in a larger project without a single unbounded request", async () => {
  const assets = Array.from({ length: 205 }, (_, i) => ({
    id: String(i),
    path: `projects/qa/${i}.jpg`,
  })) as Asset[];
  fixture.sign.mockImplementation(async (paths: string[]) => ({
    data: paths.map((path) => ({
      signedUrl: `https://example.invalid/${path}`,
    })),
    error: null,
  }));
  const result = await signedAssets(assets);
  expect(Object.keys(result)).toHaveLength(205);
  expect(fixture.sign).toHaveBeenCalledTimes(3);
  expect(result["204"]).toContain("204.jpg");
});

it("reports a failed photograph even when the signing batch itself succeeds", async () => {
  fixture.sign.mockResolvedValue({ data: [{ signedUrl: null, error: "Object not found" }], error: null });
  await expect(signedAssets([{ id: "photo", path: "missing.jpg" }])).rejects.toThrow("fotografias");
});

it("confirms publication through the public version, without publishing twice", async () => {
  fixture.rpc.mockResolvedValue({ data: "v2", error: null });
  fixture.tables.published_tours = [{ slug: "tour", version_id: "v2" }];
  await expect(publishDraft("project", "tour", "revision")).resolves.toEqual({version: "v2", verified: true});
  fixture.tables.published_tours[0]!.version_id = "v1";
  await expect(publishDraft("project", "tour", "revision")).resolves.toEqual({version: "v2", verified: false});
  expect(fixture.rpc).toHaveBeenCalledTimes(2);
});
