import { beforeEach, expect, it, vi } from "vitest";
import { createDeleteHandler, type Backend } from "../supabase/functions/delete-tour/handler";
const projectId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const userRpc = vi.fn(), serviceRpc = vi.fn(), remove = vi.fn(), getUser = vi.fn();
const serviceClient = vi.fn(() => ({ rpc: serviceRpc, storage: { from: () => ({ remove }) } }) as unknown as Backend);
const handler = createDeleteHandler({
  userClient: () => ({ auth: { getUser }, rpc: userRpc }) as unknown as Backend,
  serviceClient,
});
const request = (body: unknown = { projectId, confirmation: "tour-qa" }, auth = true) => new Request("https://example.invalid/delete-tour", {
  method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer fixture-token" } : {}) }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "admin" } }, error: null });
  userRpc.mockImplementation(async (name: string) => ({ data: name === "is_super_admin" ? true : { job_id: jobId, project_id: projectId, paths: [] }, error: null }));
  remove.mockResolvedValue({ data: [], error: null });
  serviceRpc.mockResolvedValue({ data: { deleted: true }, error: null });
});
it("rejects missing, expired and non-admin sessions before accessing service privileges", async () => {
  expect((await handler(request(undefined, false))).status).toBe(401);
  getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("expired") });
  expect((await handler(request())).status).toBe(401);
  userRpc.mockResolvedValueOnce({ data: false, error: null });
  expect((await handler(request())).status).toBe(403);
  expect(serviceClient).not.toHaveBeenCalled();
});
it("deletes Storage objects in batches before finalizing database deletion", async () => {
  const paths = Array.from({ length: 205 }, (_, i) => `projects/${projectId}/${i}.jpg`);
  userRpc.mockImplementation(async (name: string) => ({ data: name === "is_super_admin" ? true : { job_id: jobId, project_id: projectId, paths }, error: null }));
  const r = await handler(request());
  expect(r.status).toBe(200);
  expect(remove.mock.calls.map(c => c[0].length)).toEqual([100,100,5]);
  expect(serviceRpc).toHaveBeenCalledWith("complete_project_deletion", { p_project: projectId, p_job: jobId });
  expect(remove.mock.invocationCallOrder.at(-1)).toBeLessThan(serviceRpc.mock.invocationCallOrder[0]!);
});
it("leaves a failed Storage operation resumable without deleting database history", async () => {
  userRpc.mockImplementation(async (name: string) => ({ data: name === "is_super_admin" ? true : { job_id: jobId, project_id: projectId, paths: [`projects/${projectId}/a.jpg`] }, error: null }));
  remove.mockResolvedValueOnce({ error: { message: "network failure" }, data: null });
  expect((await handler(request())).status).toBe(503);
  expect(serviceRpc).not.toHaveBeenCalled();
  expect((await handler(request())).status).toBe(200);
});
it("never deletes a path outside the selected project", async () => {
  userRpc.mockImplementation(async (name: string) => ({ data: name === "is_super_admin" ? true : { job_id: jobId, project_id: projectId, paths: ["projects/other/a.jpg"] }, error: null }));
  expect((await handler(request())).status).toBe(500);
  expect(serviceClient).not.toHaveBeenCalled();
});
it("does not report success if database finalization fails", async () => {
  serviceRpc.mockResolvedValueOnce({ data: null, error: { message: "MEDIA_DELETION_INCOMPLETE" } });
  expect((await handler(request())).status).toBe(503);
});
it("rejects invalid input and foreign browser origins", async () => {
  expect((await handler(request({ projectId: "not-a-uuid", confirmation: "tour-qa" }))).status).toBe(400);
  const r = new Request(request(), { headers: { Origin: "https://other.invalid", Authorization: "Bearer fixture-token" } });
  expect((await handler(r)).status).toBe(403);
  expect(serviceClient).not.toHaveBeenCalled();
});
