import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { createDeleteHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
Deno.serve(createDeleteHandler({
  userClient: (authorization) => createClient(url, anon, { ...options, global: { headers: { Authorization: authorization } } }),
  serviceClient: () => createClient(url, serviceKey, options),
}));
