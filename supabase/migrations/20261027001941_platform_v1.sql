-- voee360tour V1. Canonical drafts + transactional relational projections.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table private.admin_bootstrap(email text primary key, claimed_at timestamptz, completed_at timestamptz);
insert into private.admin_bootstrap(email) values ('wowdanielnadal@gmail.com');
create table public.profiles(user_id uuid primary key references auth.users(id) on delete restrict, name text not null default '', role text not null check(role='super_admin'), created_at timestamptz not null default now());
create function private.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and exists(select 1 from public.profiles where user_id=auth.uid() and role='super_admin') $$;
revoke all on function private.is_super_admin() from public,anon;
grant execute on function private.is_super_admin() to authenticated;
create function private.require_admin() returns void language plpgsql stable security invoker set search_path='' as $$ begin if not private.is_super_admin() then raise exception 'SUPER_ADMIN_REQUIRED' using errcode='42501'; end if; end $$;
create function private.guard_auth_user() returns trigger language plpgsql security definer set search_path='' as $$ begin
-- V1 is invitation-only. Even a direct Auth signup cannot create an account.
if new.invited_at is null or not exists(select 1 from private.admin_bootstrap where email=lower(new.email)) then raise exception 'Registration is closed. Administrator invitation required.'; end if;
insert into public.profiles(user_id,name,role) values(new.id,'Dani','super_admin');
return new; end $$;
create trigger voee_invite_only after insert on auth.users for each row execute function private.guard_auth_user();
create table public.clients(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 160),slug text not null unique check(slug~'^[a-z0-9]+(-[a-z0-9]+)*$'),contact text not null default '',email text not null default '',logo_asset_id uuid,active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.projects(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.clients(id) on delete restrict,slug text not null unique check(length(slug)<=100 and slug~'^[a-z0-9]+(-[a-z0-9]+)*$'),title text not null check(length(title) between 1 and 160),status text not null default 'draft' check(status in ('draft','pending_media','published','archived')),first_scene_id uuid,published_version_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index projects_client_idx on public.projects(client_id);
create table public.project_members(project_id uuid not null references public.projects(id) on delete cascade,user_id uuid not null references auth.users(id),role text not null check(role in ('viewer','editor')),primary key(project_id,user_id));
create index project_members_user_idx on public.project_members(user_id);
create table public.media_assets(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete restrict,path text not null unique,content_type text not null check(content_type in ('image/jpeg','image/png','image/webp')),width integer not null check(width>0 and width<=32768),height integer not null check(height>0 and height<=16384),file_size bigint not null check(file_size>0 and file_size<=41943040),sha256 text not null check(sha256~'^[0-9a-f]{64}$'),kind text not null check(kind in ('panorama','thumbnail','logo','social')),status text not null default 'ready' check(status in ('ready','missing')),created_at timestamptz not null default now(),unique(project_id,id),check(path like 'projects/'||project_id::text||'/%'));
create index assets_project_idx on public.media_assets(project_id);
create table public.scenes(id uuid not null,project_id uuid not null references public.projects(id) on delete restrict,name text not null,sort_order integer not null,panorama_asset_id uuid,thumbnail_asset_id uuid,default_yaw numeric not null default 0 check(default_yaw between -180 and 180),default_pitch numeric not null default 0 check(default_pitch between -62 and 80),hfov numeric not null default 105 check(hfov between 50 and 120),primary key(project_id,id),foreign key(project_id,panorama_asset_id) references public.media_assets(project_id,id),foreign key(project_id,thumbnail_asset_id) references public.media_assets(project_id,id));
create table public.hotspots(id uuid not null,project_id uuid not null,source_scene_id uuid not null,target_scene_id uuid not null,pair_id uuid,yaw numeric not null check(yaw between -180 and 180),pitch numeric not null check(pitch between -62 and 80),rotation numeric not null default 0 check(rotation between -180 and 180),size numeric not null default 52 check(size between 24 and 120),opacity numeric not null default 1 check(opacity between .1 and 1),label text not null default '' check(length(label)<=100),style jsonb not null default '{}',sort_order integer not null default 0,primary key(project_id,id),foreign key(project_id,source_scene_id) references public.scenes(project_id,id) on delete cascade,foreign key(project_id,target_scene_id) references public.scenes(project_id,id) on delete cascade);
create index hotspots_source_idx on public.hotspots(project_id,source_scene_id);
create index hotspots_target_idx on public.hotspots(project_id,target_scene_id);
create table public.tour_drafts(project_id uuid primary key references public.projects(id) on delete restrict,revision uuid not null default gen_random_uuid(),snapshot jsonb not null,updated_at timestamptz not null default now(),author_id uuid references auth.users(id));
create index drafts_author_idx on public.tour_drafts(author_id);
create table public.tour_versions(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id) on delete restrict,version_number integer not null,kind text not null check(kind in ('published','checkpoint')),snapshot jsonb not null,author_id uuid references auth.users(id),note text not null default '' check(length(note)<=500),created_at timestamptz not null default now(),unique(project_id,version_number),unique(project_id,id));
create index versions_author_idx on public.tour_versions(author_id);
alter table public.projects add constraint project_published_version_fk foreign key(id,published_version_id) references public.tour_versions(project_id,id) deferrable initially deferred;
create table public.published_tours(project_id uuid primary key references public.projects(id) on delete restrict,slug text not null unique,version_id uuid not null,snapshot jsonb not null,updated_at timestamptz not null default now(),foreign key(project_id,version_id) references public.tour_versions(project_id,id));
create table public.publication_events(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),previous_version_id uuid,new_version_id uuid not null,author_id uuid references auth.users(id),created_at timestamptz not null default now(),foreign key(project_id,new_version_id) references public.tour_versions(project_id,id));
create index publication_project_idx on public.publication_events(project_id);
create index publication_author_idx on public.publication_events(author_id);
create table public.audit_events(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects(id),actor_id uuid references auth.users(id),operation text not null,detail jsonb not null default '{}',created_at timestamptz not null default now());
create index audit_project_idx on public.audit_events(project_id);
create index audit_actor_idx on public.audit_events(actor_id);
create function private.immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'IMMUTABLE_HISTORY'; end $$;
create trigger immutable_versions before update or delete on public.tour_versions for each row execute function private.immutable();
create trigger immutable_audit before update or delete on public.audit_events for each row execute function private.immutable();
create trigger immutable_publications before update or delete on public.publication_events for each row execute function private.immutable();
-- No direct client mutation grants. Every write passes an authenticated RPC.
do $$ declare t text;begin foreach t in array array['profiles','clients','projects','project_members','media_assets','scenes','hotspots','tour_drafts','tour_versions','published_tours','publication_events','audit_events'] loop
execute format('alter table public.%I enable row level security',t);
execute format('revoke all on public.%I from anon, authenticated',t);
execute format('grant select on public.%I to authenticated',t);
execute format('create policy super_admin_read on public.%I for select to authenticated using ((select private.is_super_admin()))',t);
end loop;end $$;
grant select on public.published_tours to anon;
create policy public_published_read on public.published_tours for select to anon, authenticated using(true);
-- Published asset lookup avoids exposing drafts, media metadata, or version history.
create function private.asset_is_published(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.published_tours p where exists(select 1 from jsonb_array_elements(p.snapshot->'scenes') s where s->>'panoramaAssetId'=p_id::text or s->>'thumbnailAssetId'=p_id::text) or p.snapshot->'branding'->>'ogAssetId'=p_id::text or p.snapshot->'branding'->>'logoAssetId'=p_id::text) $$;
grant usage on schema private to anon;
grant execute on function private.asset_is_published(uuid) to anon,authenticated;
create policy published_asset_read on public.media_assets for select to anon,authenticated using(private.asset_is_published(id));
grant select on public.media_assets to anon;
create function private.validate_snapshot(p_project uuid,snap jsonb,strict_media boolean default false) returns void language plpgsql set search_path='' as $$
declare s jsonb;a jsonb;asset uuid;sid uuid;first_id text;cnt integer;reached integer;begin
if jsonb_typeof(snap) is distinct from 'object' or snap->>'schemaVersion' is distinct from '1' or length(coalesce(snap->>'title','')) not between 1 and 160 or jsonb_typeof(snap->'scenes') is distinct from 'array' then raise exception 'INVALID_SNAPSHOT';end if;
if length(coalesce(snap->>'description',''))>1000 or (snap->'branding'->>'accent') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_SNAPSHOT'; end if;
if not coalesce((snap->'settings'->>'minHfov')::numeric between 30 and 100,false) or not coalesce((snap->'settings'->>'maxHfov')::numeric between 90 and 140,false) or not coalesce((snap->'settings'->>'hfov')::numeric between 50 and 120,false) or (snap->'settings'->>'minHfov')::numeric>(snap->'settings'->>'hfov')::numeric or (snap->'settings'->>'maxHfov')::numeric<(snap->'settings'->>'hfov')::numeric then raise exception 'INVALID_ZOOM'; end if;
select count(*) into cnt from jsonb_array_elements(snap->'scenes');
if (select count(distinct x->>'id') from jsonb_array_elements(snap->'scenes') x)<>cnt then raise exception 'DUPLICATE_SCENE';end if;
first_id:=snap->>'firstSceneId';
if first_id is not null and not exists(select 1 from jsonb_array_elements(snap->'scenes') x where x->>'id'=first_id) then raise exception 'INVALID_FIRST_SCENE';end if;
if strict_media and (cnt=0 or first_id is null) then raise exception 'EMPTY_TOUR';end if;
if (select count(*) from jsonb_array_elements(snap->'scenes') x cross join lateral jsonb_array_elements(x->'links') y)<>(select count(distinct y->>'id') from jsonb_array_elements(snap->'scenes') x cross join lateral jsonb_array_elements(x->'links') y) then raise exception 'DUPLICATE_ARROW';end if;
for s in select * from jsonb_array_elements(snap->'scenes') loop
sid:=(s->>'id')::uuid;
if length(coalesce(s->>'name','')) not between 1 and 120 or jsonb_typeof(s->'links') is distinct from 'array' or not coalesce((s->>'yaw')::numeric between -180 and 180,false) or not coalesce((s->>'pitch')::numeric between -62 and 80,false) or not coalesce((s->>'hfov')::numeric between 50 and 120,false) then raise exception 'INVALID_SCENE';end if;
foreach asset in array array[(s->>'panoramaAssetId')::uuid,(s->>'thumbnailAssetId')::uuid] loop
if asset is not null and not exists(select 1 from public.media_assets m where m.id=asset and m.project_id=p_project and m.status='ready' and (not strict_media or exists(select 1 from storage.objects o where o.bucket_id='tour-media' and o.name=m.path))) then raise exception 'MEDIA_MISSING_OR_CROSS_PROJECT';end if;
if strict_media and asset is null then raise exception 'MEDIA_MISSING';end if;
end loop;
for a in select * from jsonb_array_elements(s->'links') loop
perform (a->>'id')::uuid;
if not exists(select 1 from jsonb_array_elements(snap->'scenes') t where t->>'id'=a->>'to') then raise exception 'CROSS_PROJECT_OR_INVALID_TARGET';end if;
if not coalesce((a->>'yaw')::numeric between -180 and 180,false) or not coalesce((a->>'pitch')::numeric between -62 and 80,false) or not coalesce((a->>'rotation')::numeric between -180 and 180,false) or not coalesce((a->>'size')::numeric between 24 and 120,false) or not coalesce((a->>'opacity')::numeric between .1 and 1,false) or length(coalesce(a->>'label',''))>100 or a->>'style' not in ('circle','plain') or a->>'icon' not in ('arrow','chevron') or (a->>'color')!~'^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_ARROW';end if;
end loop;end loop;
foreach asset in array array[(snap->'branding'->>'logoAssetId')::uuid,(snap->'branding'->>'ogAssetId')::uuid] loop
if asset is not null and not exists(select 1 from public.media_assets m where m.id=asset and m.project_id=p_project and m.status='ready' and (not strict_media or exists(select 1 from storage.objects o where o.bucket_id='tour-media' and o.name=m.path))) then raise exception 'MEDIA_MISSING_OR_CROSS_PROJECT';end if;end loop;
if strict_media then
with recursive reachable(id) as (select first_id union select a->>'to' from reachable r join lateral (select x from jsonb_array_elements(snap->'scenes') x where x->>'id'=r.id) s on true cross join lateral jsonb_array_elements(s.x->'links') a where (a->>'visible')::boolean)
select count(*) into reached from reachable;
if reached<>cnt then raise exception 'UNREACHABLE_SCENES';end if;end if;
end $$;
create function private.materialize(p_project uuid,snap jsonb) returns void language plpgsql set search_path='' as $$
declare s jsonb;a jsonb;i integer:=0;j integer;begin
perform private.validate_snapshot(p_project,snap,false);
delete from public.hotspots where project_id=p_project;
delete from public.scenes where project_id=p_project;
for s in select * from jsonb_array_elements(snap->'scenes') loop
insert into public.scenes(project_id,id,name,sort_order,panorama_asset_id,thumbnail_asset_id,default_yaw,default_pitch,hfov) values(p_project,(s->>'id')::uuid,s->>'name',i,(s->>'panoramaAssetId')::uuid,(s->>'thumbnailAssetId')::uuid,(s->>'yaw')::numeric,(s->>'pitch')::numeric,(s->>'hfov')::numeric);i:=i+1;end loop;
for s in select * from jsonb_array_elements(snap->'scenes') loop j:=0;for a in select * from jsonb_array_elements(s->'links') loop
insert into public.hotspots(project_id,id,source_scene_id,target_scene_id,pair_id,yaw,pitch,rotation,size,opacity,label,style,sort_order) values(p_project,(a->>'id')::uuid,(s->>'id')::uuid,(a->>'to')::uuid,(a->>'pairId')::uuid,(a->>'yaw')::numeric,(a->>'pitch')::numeric,(a->>'rotation')::numeric,(a->>'size')::numeric,(a->>'opacity')::numeric,a->>'label',a-'id'-'to'-'pairId'-'yaw'-'pitch'-'rotation'-'size'-'opacity'-'label',j);j:=j+1;end loop;end loop;
update public.projects set title=snap->>'title',first_scene_id=(snap->>'firstSceneId')::uuid,updated_at=now() where id=p_project;
end $$;
create function private.save_draft(p_project uuid,p_snapshot jsonb,p_expected uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.tour_drafts;rev uuid:=gen_random_uuid();begin
perform private.require_admin();perform 1 from public.projects where id=p_project and status<>'archived' for update;if not found then raise exception 'PROJECT_NOT_FOUND';end if;
select * into strict d from public.tour_drafts where project_id=p_project for update;if d.revision is distinct from p_expected then raise exception 'REVISION_CONFLICT';end if;
perform private.materialize(p_project,p_snapshot);
update public.tour_drafts set snapshot=p_snapshot,revision=rev,updated_at=now(),author_id=auth.uid() where project_id=p_project;
insert into public.audit_events(project_id,actor_id,operation,detail) values(p_project,auth.uid(),'draft.saved',jsonb_build_object('previousRevision',d.revision,'revision',rev));return rev;end $$;
create function private.publish_tour(p_project uuid,p_expected uuid,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.tour_drafts;v uuid;old uuid;n integer;slug_value text;begin
perform private.require_admin();select published_version_id,slug into old,slug_value from public.projects where id=p_project and status<>'archived' for update;if not found then raise exception 'PROJECT_NOT_FOUND';end if;
select * into strict d from public.tour_drafts where project_id=p_project for update;if d.revision is distinct from p_expected then raise exception 'REVISION_CONFLICT';end if;
perform private.validate_snapshot(p_project,d.snapshot,true);
select coalesce(max(version_number),0)+1 into n from public.tour_versions where project_id=p_project;
insert into public.tour_versions(project_id,version_number,kind,snapshot,author_id,note) values(p_project,n,'published',d.snapshot,auth.uid(),coalesce(p_note,'')) returning id into v;
insert into public.published_tours(project_id,slug,version_id,snapshot) values(p_project,slug_value,v,d.snapshot) on conflict(project_id) do update set slug=excluded.slug,version_id=excluded.version_id,snapshot=excluded.snapshot,updated_at=now();
update public.projects set published_version_id=v,status='published',updated_at=now() where id=p_project;
insert into public.publication_events(project_id,previous_version_id,new_version_id,author_id) values(p_project,old,v,auth.uid());
insert into public.audit_events(project_id,actor_id,operation,detail) values(p_project,auth.uid(),'tour.published',jsonb_build_object('version',v,'previous',old));return v;end $$;
create function private.restore_version(p_project uuid,p_version uuid,p_expected uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.tour_drafts;v public.tour_versions;n integer;rev uuid:=gen_random_uuid();begin
perform private.require_admin();perform 1 from public.projects where id=p_project and status<>'archived' for update;if not found then raise exception 'PROJECT_NOT_FOUND';end if;
select * into strict d from public.tour_drafts where project_id=p_project for update;if d.revision is distinct from p_expected then raise exception 'REVISION_CONFLICT';end if;
select * into strict v from public.tour_versions where id=p_version and project_id=p_project;
perform private.validate_snapshot(p_project,v.snapshot,true);
select coalesce(max(version_number),0)+1 into n from public.tour_versions where project_id=p_project;
insert into public.tour_versions(project_id,version_number,kind,snapshot,author_id,note) values(p_project,n,'checkpoint',d.snapshot,auth.uid(),'Rascunho preservado antes da restauração');
perform private.materialize(p_project,v.snapshot);
update public.tour_drafts set snapshot=v.snapshot,revision=rev,author_id=auth.uid(),updated_at=now() where project_id=p_project;
insert into public.audit_events(project_id,actor_id,operation,detail) values(p_project,auth.uid(),'version.restored_to_draft',jsonb_build_object('source',p_version,'revision',rev,'checkpoint',n));return rev;end $$;
create function private.manage_client(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid:=coalesce((p_data->>'id')::uuid,gen_random_uuid());begin perform private.require_admin();
insert into public.clients(id,name,slug,contact,email,active) values(i,p_data->>'name',p_data->>'slug',coalesce(p_data->>'contact',''),coalesce(p_data->>'email',''),coalesce((p_data->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,slug=excluded.slug,contact=excluded.contact,email=excluded.email,active=excluded.active,updated_at=now();
insert into public.audit_events(actor_id,operation,detail) values(auth.uid(),'client.saved',jsonb_build_object('clientId',i));return i;end $$;
create function private.manage_project(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid:=coalesce((p_data->>'id')::uuid,gen_random_uuid());snap jsonb;st text;begin perform private.require_admin();
if p_data->>'id' is null then
snap:=jsonb_build_object('schemaVersion',1,'title',p_data->>'title','description','','firstSceneId',null,'branding',jsonb_build_object('accent','#b5ed80','logoAssetId',null,'ogAssetId',null),'settings',jsonb_build_object('hfov',105,'minHfov',50,'maxHfov',120,'autoRotate',false),'scenes','[]'::jsonb);
insert into public.projects(id,client_id,slug,title) values(i,(p_data->>'client_id')::uuid,p_data->>'slug',p_data->>'title');
insert into public.tour_drafts(project_id,snapshot,author_id) values(i,snap,auth.uid());
else
perform 1 from public.projects where id=i for update;if not found then raise exception 'PROJECT_NOT_FOUND';end if;
st:=p_data->>'status';if st is not null and st not in ('archived','draft') then raise exception 'INVALID_STATUS';end if;
if st='archived' then delete from public.published_tours where project_id=i;end if;
update public.projects set title=coalesce(p_data->>'title',title),slug=coalesce(p_data->>'slug',slug),status=coalesce(st,status),updated_at=now() where id=i;
if p_data->>'slug' is not null then update public.published_tours set slug=p_data->>'slug' where project_id=i;end if;
end if;
insert into public.audit_events(project_id,actor_id,operation,detail) values(i,auth.uid(),'project.saved',p_data);return i;end $$;
-- Register an already uploaded immutable object. Publishing independently checks object existence.
create function private.register_asset(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid:=(p_data->>'id')::uuid;pid uuid:=(p_data->>'project_id')::uuid;begin perform private.require_admin();
perform 1 from public.projects where id=pid and status<>'archived' for update;if not found then raise exception 'PROJECT_NOT_FOUND';end if;
if not exists(select 1 from storage.objects where bucket_id='tour-media' and name=p_data->>'path' and (metadata->>'size')::bigint=(p_data->>'file_size')::bigint and metadata->>'mimetype'=p_data->>'content_type') then raise exception 'MEDIA_MISSING_OR_INVALID_OBJECT';end if;
if p_data->>'kind'='panorama' and abs((p_data->>'width')::numeric/(p_data->>'height')::numeric-2)>.03 then raise exception 'PANORAMA_MUST_BE_2_TO_1';end if;
insert into public.media_assets(id,project_id,path,content_type,width,height,file_size,sha256,kind) values(i,pid,p_data->>'path',p_data->>'content_type',(p_data->>'width')::int,(p_data->>'height')::int,(p_data->>'file_size')::bigint,p_data->>'sha256',p_data->>'kind');return i;end $$;
-- Wrapper functions expose a small RPC API, while privileged implementation stays unexposed.
create function public.is_super_admin() returns boolean language sql stable security invoker set search_path='' as $$select private.is_super_admin()$$;
create function public.save_draft(p_project uuid,p_snapshot jsonb,p_expected uuid) returns uuid language sql security invoker set search_path='' as $$select private.save_draft(p_project,p_snapshot,p_expected)$$;
create function public.publish_tour(p_project uuid,p_expected uuid,p_note text default '') returns uuid language sql security invoker set search_path='' as $$select private.publish_tour(p_project,p_expected,p_note)$$;
create function public.restore_version(p_project uuid,p_version uuid,p_expected uuid) returns uuid language sql security invoker set search_path='' as $$select private.restore_version(p_project,p_version,p_expected)$$;
create function public.manage_client(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select private.manage_client(p_data)$$;
create function public.manage_project(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select private.manage_project(p_data)$$;
create function public.register_asset(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select private.register_asset(p_data)$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.asset_is_published(uuid) to anon,authenticated;
do $$ declare n text;begin foreach n in array array['save_draft','publish_tour','restore_version','manage_client','manage_project','register_asset'] loop
execute (select format('grant execute on function %s to authenticated',p.oid::regprocedure) from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='private' and p.proname=n);
end loop;end $$;
do $$declare f record;begin for f in select p.oid::regprocedure fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_super_admin','save_draft','publish_tour','restore_version','manage_client','manage_project','register_asset') loop execute format('revoke all on function %s from public,anon',f.fn);execute format('grant execute on function %s to authenticated',f.fn);end loop;end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('tour-media','tour-media',false,41943040,array['image/jpeg','image/png','image/webp']);
create policy admin_storage_read on storage.objects for select to authenticated using(bucket_id='tour-media' and (select private.is_super_admin()));
create policy admin_storage_insert on storage.objects for insert to authenticated with check(bucket_id='tour-media' and (select private.is_super_admin()) and exists(select 1 from public.projects p where name like 'projects/'||p.id::text||'/%' and p.status<>'archived'));
-- No UPDATE/DELETE: existing versions retain their immutable media. Garbage collection is a later controlled maintenance job.
create policy public_storage_read on storage.objects for select to anon,authenticated using(bucket_id='tour-media' and exists(select 1 from public.media_assets m where m.path=name and private.asset_is_published(m.id)));
commit;
