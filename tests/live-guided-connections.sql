-- Isolated real-database QA: all created client/project/drafts rollback.
-- No customer snapshots, Storage files, Auth credentials or public tours change.
create temporary table guided_connection_results(result jsonb);
do $$
declare uid uuid; cid uuid; pid uuid; rev uuid; oldrev uuid; snapshot jsonb; blocked boolean; results jsonb := '[]'::jsonb;
begin
select user_id into uid from public.profiles where role='super_admin' limit 1;
if uid is null then raise exception 'Administrator required'; end if;
begin
perform set_config('request.jwt.claim.sub',uid::text,true);
perform set_config('role','authenticated',true);
cid := public.manage_client('{"name":"Homologação guiada isolada","slug":"qa-guided-5813554e"}');
pid := public.manage_project(jsonb_build_object('client_id',cid,'title','Homologação guiada isolada','slug','qa-guided-5813554e'));
select revision into rev from public.tour_drafts where project_id=pid;
rev := public.save_draft(pid,'{"schemaVersion": 1, "title": "Homologação guiada isolada", "description": "QA transacional, sem publicação", "firstSceneId": "27155b1e-96e7-4e85-9c27-793565c66303", "branding": {"accent": "#b5ed80", "logoAssetId": null, "ogAssetId": null}, "settings": {"hfov": 105, "minHfov": 50, "maxHfov": 120, "autoRotate": false}, "scenes": [{"id": "27155b1e-96e7-4e85-9c27-793565c66303", "name": "Ambiente A", "group": "QA", "panoramaAssetId": null, "thumbnailAssetId": null, "yaw": 0, "pitch": 0, "hfov": 105, "links": [{"id": "4b4cd180-e493-473b-8aaf-43374585c2bc", "to": "3038d83f-1911-4681-ad5c-b2af0540fd4b", "pairId": "a90df67a-b392-404c-b8cd-3279738e0074", "yaw": 32, "pitch": -12, "rotation": 0, "size": 52, "opacity": 1, "label": "", "style": "circle", "tone": "primary", "color": "#b5ed80", "icon": "arrow", "visible": true}]}, {"id": "3038d83f-1911-4681-ad5c-b2af0540fd4b", "name": "Ambiente B", "group": "QA", "panoramaAssetId": null, "thumbnailAssetId": null, "yaw": 0, "pitch": 0, "hfov": 105, "links": []}]}'::jsonb,rev);
if (select count(*) from public.hotspots where project_id=pid) <> 1 then raise exception 'Outgoing missing'; end if;
results := results || '[{"test":"isolated_project_pending_return_saved","passed":true}]';
rev := public.save_draft(pid,'{"schemaVersion": 1, "title": "Homologação guiada isolada", "description": "QA transacional, sem publicação", "firstSceneId": "27155b1e-96e7-4e85-9c27-793565c66303", "branding": {"accent": "#b5ed80", "logoAssetId": null, "ogAssetId": null}, "settings": {"hfov": 105, "minHfov": 50, "maxHfov": 120, "autoRotate": false}, "scenes": [{"id": "27155b1e-96e7-4e85-9c27-793565c66303", "name": "Ambiente A", "group": "QA", "panoramaAssetId": null, "thumbnailAssetId": null, "yaw": 0, "pitch": 0, "hfov": 105, "links": [{"id": "4b4cd180-e493-473b-8aaf-43374585c2bc", "to": "3038d83f-1911-4681-ad5c-b2af0540fd4b", "pairId": "a90df67a-b392-404c-b8cd-3279738e0074", "yaw": 32, "pitch": -12, "rotation": 0, "size": 52, "opacity": 1, "label": "", "style": "circle", "tone": "primary", "color": "#b5ed80", "icon": "arrow", "visible": true}]}, {"id": "3038d83f-1911-4681-ad5c-b2af0540fd4b", "name": "Ambiente B", "group": "QA", "panoramaAssetId": null, "thumbnailAssetId": null, "yaw": 0, "pitch": 0, "hfov": 105, "links": [{"id": "a7b82fd6-bb45-44d2-a299-dc0249ae14d2", "to": "27155b1e-96e7-4e85-9c27-793565c66303", "pairId": "a90df67a-b392-404c-b8cd-3279738e0074", "yaw": -67, "pitch": -22, "rotation": 0, "size": 52, "opacity": 1, "label": "", "style": "circle", "tone": "primary", "color": "#b5ed80", "icon": "arrow", "visible": true}]}]}'::jsonb,rev);
select d.snapshot into snapshot from public.tour_drafts d where d.project_id=pid;
if (select count(*) from public.hotspots where project_id=pid) <> 2 or (select count(distinct pair_id) from public.hotspots where project_id=pid) <> 1 then raise exception 'Pair missing'; end if;
if (snapshot#>>'{scenes,0,links,0,yaw}')::numeric <> 32 or (snapshot#>>'{scenes,1,links,0,yaw}')::numeric <> -67 then raise exception 'Positions changed'; end if;
results := results || '[{"test":"saved_pair_normalized_and_reloaded_with_independent_positions","passed":true}]';
snapshot := jsonb_set(snapshot,'{scenes,0,links,0,yaw}','40');
oldrev := rev; rev := public.save_draft(pid,snapshot,rev);
if (select yaw from public.hotspots where project_id=pid and id='a7b82fd6-bb45-44d2-a299-dc0249ae14d2') <> -67 then raise exception 'Opposite side changed'; end if;
blocked := false; begin perform public.save_draft(pid,snapshot,oldrev); exception when others then blocked := SQLERRM like '%REVISION_CONFLICT%'; end;
if not blocked then raise exception 'Conflict not rejected'; end if;
if exists(select 1 from public.published_tours where project_id=pid) then raise exception 'Unexpected publication'; end if;
results := results || '[{"test":"independent_edit_optimistic_conflict_and_no_publication","passed":true}]';
raise sqlstate 'ZQG01' using message='Intentional rollback of isolated QA';
exception when sqlstate 'ZQG01' then null;
end;
insert into guided_connection_results values(results);
end $$;
select result from guided_connection_results;
