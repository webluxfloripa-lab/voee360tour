create or replace function private.validate_snapshot(p_project uuid,snap jsonb,strict_media boolean default false) returns void language plpgsql set search_path='' as $$
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
with recursive reachable(id) as (select first_id union select edge.value->>'to' from reachable r join lateral (select x from jsonb_array_elements(snap->'scenes') x where x->>'id'=r.id) sc on true cross join lateral jsonb_array_elements(sc.x->'links') edge(value) where (edge.value->>'visible')::boolean)
select count(*) into reached from reachable;
if reached<>cnt then raise exception 'UNREACHABLE_SCENES';end if;end if;
end $$;
