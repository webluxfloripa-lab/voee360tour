import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,invited_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema public,auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;grant select,insert on storage.objects to authenticated;grant select on storage.objects to anon;`,
);
const migration = readdirSync("supabase/migrations").find((x) =>
  x.endsWith("_platform_v1.sql"),
);
await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
for (const m of readdirSync("supabase/migrations")
  .filter((x) => x !== migration)
  .sort())
  await db.exec(readFileSync("supabase/migrations/" + m, "utf8"));
console.log("PASS schema migration");
const uid = "11111111-1111-4111-8111-111111111111";
await db.exec(
  `update private.admin_bootstrap set claimed_at=now() where email='wowdanielnadal@gmail.com';insert into auth.users values('${uid}','wowdanielnadal@gmail.com',now());select set_config('request.jwt.claim.sub','${uid}',false);`,
);
const rpc = async (sql, args = []) => {
  await db.exec("set role authenticated");
  try {
    return (await db.query(sql, args)).rows;
  } finally {
    await db.exec("reset role");
  }
};
const check = (v, msg) => {
  if (!v) throw new Error(msg);
  console.log("PASS " + msg);
};
const reject = async (fn, msg) => {
  let ok = false;
  try {
    await fn();
  } catch {
    ok = true;
  }
  check(ok, msg);
};
const client = (
  await rpc(`select public.manage_client($1::jsonb) id`, [
    JSON.stringify({ name: "QA Client", slug: "qa-client" }),
  ])
)[0].id;
const project = (
  await rpc("select public.manage_project($1::jsonb) id", [
    JSON.stringify({ client_id: client, title: "QA Tour", slug: "qa-tour" }),
  ])
)[0].id;
const other = (
  await rpc("select public.manage_project($1::jsonb) id", [
    JSON.stringify({ client_id: client, title: "Other", slug: "other" }),
  ])
)[0].id;
const a = "22222222-2222-4222-8222-222222222222",
  t = "33333333-3333-4333-8333-333333333333",
  scene = "44444444-4444-4444-8444-444444444444";
for (const [id, kind, w, h] of [
  [a, "panorama", 2000, 1000],
  [t, "thumbnail", 480, 240],
]) {
  const path = `projects/${project}/${kind}/${id}.jpg`;
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata) values(\'tour-media\',$1,\'{"size":100,"mimetype":"image/jpeg"}\')',
    [path],
  );
  await rpc("select public.register_asset($1::jsonb)", [
    JSON.stringify({
      id,
      project_id: project,
      path,
      kind,
      width: w,
      height: h,
      content_type: "image/jpeg",
      file_size: 100,
      sha256: "a".repeat(64),
    }),
  ]);
}
const snap = {
  schemaVersion: 1,
  title: "V1",
  description: "",
  firstSceneId: scene,
  branding: { accent: "#b5ed80", logoAssetId: null, ogAssetId: null },
  settings: { hfov: 105, minHfov: 50, maxHfov: 120, autoRotate: false },
  scenes: [
    {
      id: scene,
      name: "Room",
      group: "",
      panoramaAssetId: a,
      thumbnailAssetId: t,
      yaw: 0,
      pitch: 0,
      hfov: 105,
      links: [],
    },
  ],
};
let rev = (
  await db.query(
    "select revision from public.tour_drafts where project_id=$1",
    [project],
  )
).rows[0].revision;
const save = async (s, r = rev) =>
  (
    await rpc("select public.save_draft($1,$2::jsonb,$3) id", [
      project,
      JSON.stringify(s),
      r,
    ])
  )[0].id;
const oldRev = rev;
rev = await save(snap);
await reject(() => save(snap, oldRev), "optimistic revision conflict rejected");
const publish = async () =>
  (await rpc("select public.publish_tour($1,$2,'QA') id", [project, rev]))[0]
    .id;
const v1 = await publish();
check(!!v1, "publish V1");
snap.title = "V2";
rev = await save(snap);
const v2 = await publish();
check(v2 !== v1, "publish V2 creates immutable version");
rev = (
  await rpc("select public.restore_version($1,$2,$3) id", [project, v1, rev])
)[0].id;
const draft = (
  await rpc("select * from public.tour_drafts where project_id=$1", [project])
)[0];
check(
  draft.snapshot.title === "V1" && draft.revision === rev,
  "restore persists V1 draft with new revision",
);
check(
  (
    await db.query(
      "select version_id from public.published_tours where project_id=$1",
      [project],
    )
  ).rows[0].version_id === v2,
  "restore leaves publication V2 unchanged",
);
const v3 = await publish();
check(v3 !== v1 && v3 !== v2, "V3 publication is new snapshot");
check(
  (
    await db.query(
      "select count(*)::int n from public.tour_versions where project_id=$1",
      [project],
    )
  ).rows[0].n === 4,
  "V1 V2 checkpoint V3 all retained",
);
await reject(
  () => rpc("update public.tour_versions set note='tampered'"),
  "direct history mutation denied",
);
await reject(
  () => rpc("select public.restore_version($1,$2,$3)", [other, v1, rev]),
  "cross-project restore rejected",
);
await reject(
  () =>
    rpc(
      "select public.save_draft($1,$2::jsonb,(select revision from public.tour_drafts where project_id=$1))",
      [other, JSON.stringify(snap)],
    ),
  "cross-project media rejected",
);
await db.query("delete from storage.objects where name like $1", [`%${a}.jpg`]);
await reject(() => publish(), "missing media blocks publication");
await db.exec(
  "select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false)",
);
check(
  (await rpc("select * from public.tour_drafts")).length === 0,
  "ordinary user cannot read drafts",
);
await reject(
  () =>
    rpc("select public.manage_client($1::jsonb)", [
      JSON.stringify({ name: "Bad", slug: "bad" }),
    ]),
  "ordinary user cannot mutate clients",
);
await db.exec(
  "select set_config('request.jwt.claim.sub','',false);set role anon",
);
check(
  (await db.query("select * from public.published_tours")).rows.length === 1,
  "anonymous reads only complete published snapshot",
);
await reject(
  () => db.query("select public.publish_tour($1,$2)", [project, rev]),
  "anonymous publish denied",
);
await db.exec("reset role");
await reject(
  () =>
    db.exec(
      "insert into auth.users values('66666666-6666-4666-8666-666666666666','intruder@example.test',null)",
    ),
  "public signup blocked by database guard",
);
await db.close();
console.log("ALL DATABASE TESTS PASSED");
