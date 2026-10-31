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
  .sort()) {
  if (m.endsWith("_restrict_public_workspace_data.sql")) {
    // Reproduce the live-only public-workspace migration before testing its
    // repair. This must remove both the grants and permissive RLS policies.
    await db.exec(`
      do $$ declare t text; begin
        foreach t in array array['clients','projects','scenes','hotspots','tour_drafts','tour_versions','publication_events','audit_events','media_assets'] loop
          execute format('grant select on public.%I to anon',t);
          execute format('create policy public_workspace_read on public.%I for select to anon using(true)',t);
        end loop;
      end $$;
      create policy public_workspace_media_read on storage.objects for select to anon using(bucket_id='tour-media');
    `);
  }
  await db.exec(readFileSync("supabase/migrations/" + m, "utf8"));
}
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
  presentation: {
    copy: { subtitle: "Texto V1" },
    layout: { logoWidth: 120 },
    blocks: [],
  },
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
check(
  (
    await db.query(
      "select snapshot->'presentation' as value from public.published_tours where project_id=$1",
      [project],
    )
  ).rows[0].value.copy.subtitle === "Texto V1",
  "publication preserves custom text and layout",
);
snap.presentation.copy.subtitle = "Texto V2";
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
  draft.snapshot.presentation.copy.subtitle === "Texto V1" &&
    draft.snapshot.presentation.layout.logoWidth === 120,
  "restore preserves versioned text and layout",
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
const unpublishedAsset = crypto.randomUUID();
const unpublishedPath = `projects/${other}/thumbnail/${unpublishedAsset}.jpg`;
await db.query(
  "insert into storage.objects(bucket_id,name,metadata) values('tour-media',$1,'{\"size\":100,\"mimetype\":\"image/jpeg\"}')",
  [unpublishedPath],
);
await rpc("select public.register_asset($1::jsonb)", [
  JSON.stringify({
    id: unpublishedAsset,
    project_id: other,
    path: unpublishedPath,
    kind: "thumbnail",
    width: 480,
    height: 240,
    content_type: "image/jpeg",
    file_size: 100,
    sha256: "c".repeat(64),
  }),
]);
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
for (const table of [
  "clients", "projects", "scenes", "hotspots", "tour_drafts",
  "tour_versions", "publication_events", "audit_events",
]) {
  await reject(
    () => db.query(`select * from public.${table}`),
    `anonymous cannot read internal ${table}`,
  );
}
check(
  (await db.query("select * from public.media_assets where id=$1", [unpublishedAsset])).rows.length === 0,
  "anonymous cannot read unpublished media metadata",
);
check(
  (await db.query("select * from storage.objects where name=$1", [unpublishedPath])).rows.length === 0,
  "anonymous cannot list or download unpublished media",
);
check(
  (await db.query("select * from storage.objects where name=$1", [`projects/${project}/thumbnail/${t}.jpg`])).rows.length === 1,
  "anonymous retains access to published media",
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
// Hard deletion is tested only against an isolated project in this local DB.
await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false)`);
const disposable = (
  await rpc("select public.manage_project($1::jsonb) id", [
    JSON.stringify({
      client_id: client,
      title: "Disposable deletion QA",
      slug: "disposable-delete-qa",
    }),
  ])
)[0].id;
const deleteAssets = [
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
];
for (let i = 0; i < deleteAssets.length; i++) {
  const path = `projects/${disposable}/${deleteAssets[i]}.jpg`;
  await db.query(
    'insert into storage.objects(bucket_id,name,metadata) values(\'tour-media\',$1,\'{"size":100,"mimetype":"image/jpeg"}\')',
    [path],
  );
  await rpc("select public.register_asset($1::jsonb)", [
    JSON.stringify({
      id: deleteAssets[i],
      project_id: disposable,
      path,
      kind: ["panorama", "thumbnail", "logo"][i],
      width: i === 0 ? 2000 : 480,
      height: i === 0 ? 1000 : 240,
      content_type: "image/jpeg",
      file_size: 100,
      sha256: "b".repeat(64),
    }),
  ]);
}
const deleteSnapshot = structuredClone(snap);
deleteSnapshot.title = "Disposable deletion QA";
deleteSnapshot.scenes[0].panoramaAssetId = deleteAssets[0];
deleteSnapshot.scenes[0].thumbnailAssetId = deleteAssets[1];
deleteSnapshot.branding.logoAssetId = deleteAssets[2];
const deleteRevision = (
  await rpc(
    "select public.save_draft($1,$2::jsonb,(select revision from public.tour_drafts where project_id=$1)) id",
    [disposable, JSON.stringify(deleteSnapshot)],
  )
)[0].id;
await rpc("select public.publish_tour($1,$2,'Disposable local QA')", [
  disposable,
  deleteRevision,
]);
await db.query("update public.clients set logo_asset_id=$1 where id=$2", [
  deleteAssets[2],
  client,
]);
await db.query(
  "insert into private.legacy_imports(project_id,source_snapshot,media_inventory) values($1,'{}','[]')",
  [disposable],
);
await db.query(
  "insert into private.media_import_manifest(id,project_id,manifest) values(gen_random_uuid(),$1,'{}')",
  [disposable],
);
await reject(
  () =>
    rpc("select public.prepare_project_deletion($1,'wrong-slug')", [
      disposable,
    ]),
  "deletion requires exact project confirmation",
);
await db.exec(
  "select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false)",
);
await reject(
  () =>
    rpc("select public.prepare_project_deletion($1,'disposable-delete-qa')", [
      disposable,
    ]),
  "ordinary user cannot request deletion",
);
await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false)`);
const job = (
  await rpc(
    "select public.prepare_project_deletion($1,'disposable-delete-qa') job",
    [disposable],
  )
)[0].job;
const repeated = (
  await rpc(
    "select public.prepare_project_deletion($1,'disposable-delete-qa') job",
    [disposable],
  )
)[0].job;
check(
  job.job_id === repeated.job_id && job.paths.length === 3,
  "preparation is scoped and resumable",
);
check(
  (
    await db.query(
      "select status,deletion_pending from public.projects where id=$1",
      [disposable],
    )
  ).rows[0].deletion_pending &&
    (
      await db.query(
        "select * from public.published_tours where project_id=$1",
        [disposable],
      )
    ).rows.length === 0,
  "deletion immediately withdraws public access",
);
await reject(
  () =>
    rpc("select public.manage_project($1::jsonb)", [
      JSON.stringify({ id: disposable, status: "draft" }),
    ]),
  "a pending deletion cannot be reopened",
);
await reject(
  () =>
    rpc("select public.save_draft($1,$2::jsonb,$3)", [
      disposable,
      JSON.stringify(deleteSnapshot),
      deleteRevision,
    ]),
  "a pending deletion cannot be edited",
);
await reject(
  () =>
    db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('tour-media',$1,'{}')",
      [`projects/${disposable}/late-upload.jpg`],
    ),
  "in-flight uploads cannot enter a deleting project",
);
await reject(
  () =>
    db.query("delete from public.tour_versions where project_id=$1", [
      disposable,
    ]),
  "history remains immutable while media deletion is pending",
);
await reject(
  () =>
    rpc("select public.complete_project_deletion($1,$2)", [
      disposable,
      job.job_id,
    ]),
  "a browser session cannot finalize deletion directly",
);
const service = async (sql, args) => {
  await db.exec("set role service_role");
  try {
    return (await db.query(sql, args)).rows;
  } finally {
    await db.exec("reset role");
  }
};
await reject(
  () =>
    service("select public.complete_project_deletion($1,$2)", [
      disposable,
      job.job_id,
    ]),
  "finalization rejects files that still exist in Storage",
);
// Local Storage metadata models a successful Storage API deletion here only.
await db.query("delete from storage.objects where name like $1", [
  `projects/${disposable}/%`,
]);
const deleted = (
  await service("select public.complete_project_deletion($1,$2) result", [
    disposable,
    job.job_id,
  ])
)[0].result;
check(
  deleted.deleted && deleted.removed_assets === 3,
  "finalization hard-deletes the disposable tour",
);
for (const table of [
  "tour_drafts",
  "tour_versions",
  "published_tours",
  "publication_events",
  "audit_events",
  "scenes",
  "hotspots",
  "project_members",
  "media_assets",
  "private.legacy_imports",
  "private.media_import_manifest",
  "private.project_deletion_jobs",
])
  check(
    (
      await db.query(
        `select count(*)::int n from ${table} where project_id=$1`,
        [disposable],
      )
    ).rows[0].n === 0,
    `no deleted project records remain in ${table}`,
  );
check(
  (await db.query("select * from public.projects where id=$1", [disposable]))
    .rows.length === 0,
  "deleted project itself is removed from database",
);
check(
  (
    await db.query("select logo_asset_id from public.clients where id=$1", [
      client,
    ])
  ).rows[0].logo_asset_id === null,
  "client remains with its deleted logo detached",
);
check(
  (await db.query("select * from public.projects where id=$1", [other])).rows
    .length === 1,
  "another tour is preserved",
);
await reject(
  () =>
    db.query(
      "update public.tour_versions set note='tampered' where project_id=$1",
      [project],
    ),
  "other project history is still immutable after deletion",
);
check(
  (
    await service("select public.complete_project_deletion($1,$2) result", [
      disposable,
      job.job_id,
    ])
  )[0].result.already_deleted === true,
  "finalization can be safely retried after completion",
);
await db.close();
console.log("ALL DATABASE TESTS PASSED");
