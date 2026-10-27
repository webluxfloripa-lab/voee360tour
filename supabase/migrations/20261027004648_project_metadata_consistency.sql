create or replace function private.manage_project(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
if p_data->>'title' is not null then update public.tour_drafts set snapshot=jsonb_set(snapshot,'{title}',to_jsonb(p_data->>'title')),revision=gen_random_uuid(),updated_at=now(),author_id=auth.uid() where project_id=i;end if;
if p_data->>'slug' is not null then update public.published_tours set slug=p_data->>'slug' where project_id=i;end if;
end if;
insert into public.audit_events(project_id,actor_id,operation,detail) values(i,auth.uid(),'project.saved',p_data);return i;end $$;
