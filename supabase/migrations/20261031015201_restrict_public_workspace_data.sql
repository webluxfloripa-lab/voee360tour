-- Remove the temporary, unrestricted workspace reads introduced outside the
-- repository. Public visitors keep the published snapshot and its media only.
begin;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'clients', 'projects', 'scenes', 'hotspots', 'tour_drafts',
    'tour_versions', 'publication_events', 'audit_events', 'media_assets'
  ] loop
    execute format('drop policy if exists public_workspace_read on public.%I', table_name);
  end loop;
end $$;

revoke select on public.clients, public.projects, public.scenes,
  public.hotspots, public.tour_drafts, public.tour_versions,
  public.publication_events, public.audit_events from anon;

drop policy if exists public_workspace_media_read on storage.objects;

-- Preserve the original grants. Existing RLS policies restrict media_assets and
-- storage.objects to assets referenced by the current published snapshot.
grant select on public.published_tours, public.media_assets to anon;

commit;
