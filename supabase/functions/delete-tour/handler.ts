type Result = { data: any; error: { message: string } | null };
export type Backend = {
  auth: { getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<Result>;
  storage: { from(bucket: string): { remove(paths: string[]): Promise<Result> } };
};
type Dependencies = { userClient: (authorization: string) => Backend; serviceClient: () => Backend };
const origins = new Set([
  "https://voee360tour.webluxfloripa-lab.workers.dev",
  "https://voee360tour.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function createDeleteHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get("origin");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    };
    if (origin && origins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !origins.has(origin)) return reply(403, { message: "Origem não autorizada." });
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return reply(405, { message: "Método não permitido." });
    const authorization = req.headers.get("authorization") || "";
    if (!/^Bearer \S+$/.test(authorization)) return reply(401, { message: "Entre novamente para excluir o passeio." });
    try {
      const client = deps.userClient(authorization);
      const { data: { user }, error: authError } = await client.auth.getUser(authorization.slice(7));
      if (authError || !user) return reply(401, { message: "Sua sessão expirou. Entre novamente." });
      const { data: admin, error: roleError } = await client.rpc("is_super_admin");
      if (roleError || admin !== true) return reply(403, { message: "A exclusão é exclusiva da superadministradora." });
      const raw = await req.text();
      if (raw.length > 2048) return reply(400, { message: "Solicitação inválida." });
      let body: any;
      try { body = JSON.parse(raw); } catch { return reply(400, { message: "Solicitação inválida." }); }
      if (!body || typeof body.projectId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.projectId)
        || typeof body.confirmation !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.confirmation) || body.confirmation.length > 100)
        return reply(400, { message: "Confira o identificador do passeio." });
      const { data: job, error: prepareError } = await client.rpc("prepare_project_deletion", {
        p_project: body.projectId, p_confirmation: body.confirmation,
      });
      if (prepareError) {
        if (prepareError.message.includes("PROJECT_NOT_FOUND")) return reply(200, { deleted: true, already_deleted: true });
        if (prepareError.message.includes("DELETE_CONFIRMATION_REQUIRED")) return reply(409, { message: "O identificador não confere. Atualize a lista e confirme novamente." });
        return reply(409, { message: "Não foi possível iniciar a exclusão. Atualize a lista e tente novamente." });
      }
      const prefix = `projects/${body.projectId.toLowerCase()}/`;
      if (!job || job.project_id !== body.projectId.toLowerCase() || typeof job.job_id !== "string"
        || !Array.isArray(job.paths) || job.paths.some((path: unknown) => typeof path !== "string" || !path.startsWith(prefix)))
        return reply(500, { message: "Não foi possível validar os arquivos deste passeio." });
      const service = deps.serviceClient();
      for (let offset = 0; offset < job.paths.length; offset += 100) {
        const { error } = await service.storage.from("tour-media").remove(job.paths.slice(offset, offset + 100));
        if (error) return reply(503, { message: "A exclusão dos arquivos não terminou. O passeio saiu do ar. Tente excluir novamente para concluir." });
      }
      const { data, error } = await service.rpc("complete_project_deletion", { p_project: body.projectId, p_job: job.job_id });
      if (error || data?.deleted !== true)
        return reply(503, { message: "A exclusão não terminou. O passeio saiu do ar. Tente excluir novamente para concluir." });
      return reply(200, data);
    } catch {
      return reply(503, { message: "Não foi possível concluir a exclusão agora. Tente novamente." });
    }
  };
}
