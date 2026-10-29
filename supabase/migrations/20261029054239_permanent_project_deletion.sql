-- A resumable hard deletion. Storage is removed through its API, never by SQL.
alter table public.projects add column deletion_pending boolean not null default false;
create table private.project_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  phase text not null default 'removing_media' check (phase in ('removing_media','finalizing')),
  created_at timestamptz not null default now()
);
alter table private.project_deletion_jobs enable row level security;
create index project_deletion_requested_by_idx on private.project_deletion_jobs(requested_by);
revoke all on private.project_deletion_jobs from public,anon,authenticated,service_role;

create function private.guard_project_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from private.project_deletion_jobs where project_id=old.id and phase='removing_media') then
    raise exception 'PROJECT_DELETION_IN_PROGRESS';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.guard_project_deletion() from public,anon,authenticated;
create trigger project_deletion_guard before update or delete on public.projects
for each row execute function private.guard_project_deletion();

-- Serialize in-flight uploads with preparation so no object can arrive after
-- the deletion manifest is captured. Existing Storage RLS still applies.
create function private.guard_deleting_project_upload() returns trigger
language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
  if new.bucket_id='tour-media' and new.name ~ '^projects/[0-9a-f-]{36}/' then
    pid:=split_part(new.name,'/',2)::uuid;
    perform 1 from public.projects where id=pid for key share;
    if not found or exists(select 1 from private.project_deletion_jobs where project_id=pid) then
      raise exception 'PROJECT_NOT_WRITABLE';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_deleting_project_upload() from public,anon,authenticated;
create trigger project_upload_deletion_guard before insert or update on storage.objects
for each row execute function private.guard_deleting_project_upload();

-- History can only be deleted for the one project being finalized by the
-- service-only operation in this transaction. Updates remain forbidden.
create or replace function private.immutable() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' and exists(select 1 from private.project_deletion_jobs where project_id=old.project_id and phase='finalizing') then
    return old;
  end if;
  raise exception 'IMMUTABLE_HISTORY';
end $$;

create function private.prepare_project_deletion(p_project uuid,p_confirmation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pr public.projects; j private.project_deletion_jobs; paths jsonb; prefix text;
begin
  perform private.require_admin();
  select * into pr from public.projects where id=p_project for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if p_confirmation is distinct from pr.slug then raise exception 'DELETE_CONFIRMATION_REQUIRED'; end if;
  prefix:='projects/'||pr.id::text||'/';
  if exists(select 1 from public.media_assets where project_id=pr.id and left(path,length(prefix))<>prefix) then
    raise exception 'INVALID_MEDIA_SCOPE';
  end if;
  select * into j from private.project_deletion_jobs where project_id=pr.id;
  if not found then
    update public.projects set status='archived',deletion_pending=true,updated_at=now() where id=pr.id;
    delete from public.published_tours where project_id=pr.id;
    insert into private.project_deletion_jobs(project_id,requested_by) values(pr.id,auth.uid()) returning * into j;
  end if;
  select coalesce(jsonb_agg(path order by path),'[]'::jsonb) into paths from (
    select path from public.media_assets where project_id=pr.id
    union
    select name from storage.objects where bucket_id='tour-media' and left(name,length(prefix))=prefix
  ) inventory;
  return jsonb_build_object('job_id',j.id,'project_id',pr.id,'paths',paths);
end $$;
revoke all on function private.prepare_project_deletion(uuid,text) from public,anon,authenticated;
grant execute on function private.prepare_project_deletion(uuid,text) to authenticated;
create function public.prepare_project_deletion(p_project uuid,p_confirmation text) returns jsonb
language sql security invoker set search_path='' as $$select private.prepare_project_deletion(p_project,p_confirmation)$$;
revoke all on function public.prepare_project_deletion(uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_project_deletion(uuid,text) to authenticated;

create function private.complete_project_deletion(p_project uuid,p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.project_deletion_jobs; prefix text; asset_count integer;
begin
  perform 1 from public.projects where id=p_project for update;
  if not found then return jsonb_build_object('deleted',true,'already_deleted',true); end if;
  select * into strict j from private.project_deletion_jobs where project_id=p_project and id=p_job for update;
  prefix:='projects/'||p_project::text||'/';
  if exists(select 1 from storage.objects o where o.bucket_id='tour-media' and (
    left(o.name,length(prefix))=prefix or exists(select 1 from public.media_assets a where a.project_id=p_project and a.path=o.name)
  )) then raise exception 'MEDIA_DELETION_INCOMPLETE'; end if;
  select count(*) into asset_count from public.media_assets where project_id=p_project;
  update private.project_deletion_jobs set phase='finalizing' where id=j.id;
  update public.clients set logo_asset_id=null where logo_asset_id in(select id from public.media_assets where project_id=p_project);
  update public.projects set published_version_id=null,first_scene_id=null where id=p_project;
  delete from public.published_tours where project_id=p_project;
  delete from public.publication_events where project_id=p_project;
  delete from public.audit_events where project_id=p_project;
  delete from public.tour_versions where project_id=p_project;
  delete from public.tour_drafts where project_id=p_project;
  delete from public.hotspots where project_id=p_project;
  delete from public.scenes where project_id=p_project;
  delete from public.project_members where project_id=p_project;
  delete from private.media_import_manifest where project_id=p_project;
  delete from private.legacy_imports where project_id=p_project;
  delete from public.media_assets where project_id=p_project;
  delete from public.projects where id=p_project;
  -- Minimal operation receipt: no project id, slug, title, path or snapshot.
  insert into public.audit_events(actor_id,operation,detail) values(j.requested_by,'tour.deleted',jsonb_build_object('receipt',j.id,'removed_assets',asset_count));
  return jsonb_build_object('deleted',true,'removed_assets',asset_count);
end $$;
revoke all on function private.complete_project_deletion(uuid,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.complete_project_deletion(uuid,uuid) to service_role;
create function public.complete_project_deletion(p_project uuid,p_job uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.complete_project_deletion(p_project,p_job)$$;
revoke all on function public.complete_project_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_project_deletion(uuid,uuid) to service_role;
