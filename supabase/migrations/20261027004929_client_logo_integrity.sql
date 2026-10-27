alter table public.clients add constraint client_logo_asset_fk foreign key(logo_asset_id) references public.media_assets(id) on delete restrict;
create index clients_logo_asset_idx on public.clients(logo_asset_id);
create or replace function private.manage_client(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid:=coalesce((p_data->>'id')::uuid,gen_random_uuid());begin perform private.require_admin();
if p_data->>'logo_asset_id' is not null and not exists(select 1 from public.media_assets m join public.projects p on p.id=m.project_id where m.id=(p_data->>'logo_asset_id')::uuid and p.client_id=i and m.kind='logo') then raise exception 'CROSS_CLIENT_LOGO';end if;
insert into public.clients(id,name,slug,contact,email,active,logo_asset_id) values(i,p_data->>'name',p_data->>'slug',coalesce(p_data->>'contact',''),coalesce(p_data->>'email',''),coalesce((p_data->>'active')::boolean,true),(p_data->>'logo_asset_id')::uuid) on conflict(id) do update set name=excluded.name,slug=excluded.slug,contact=excluded.contact,email=excluded.email,active=excluded.active,logo_asset_id=excluded.logo_asset_id,updated_at=now();
insert into public.audit_events(actor_id,operation,detail) values(auth.uid(),'client.saved',jsonb_build_object('clientId',i));return i;end $$;
