begin;
drop trigger voee_invite_only on auth.users;
create or replace function private.guard_auth_user() returns trigger language plpgsql security definer set search_path='' as $$begin
-- Only the owner identity during the service-only invitation claim window may be inserted.
if not exists(select 1 from private.admin_bootstrap where email=lower(new.email) and completed_at is null and claimed_at>now()-interval '10 minutes') then raise exception 'Registration is closed. Administrator invitation required.';end if;
return new;end $$;
create trigger voee_invite_only before insert on auth.users for each row execute function private.guard_auth_user();
create function private.activate_invited_admin() returns trigger language plpgsql security definer set search_path='' as $$begin
-- invited_at is a protected Auth column. User-editable metadata never grants privileges.
if new.invited_at is not null and exists(select 1 from private.admin_bootstrap where email=lower(new.email)) then
insert into public.profiles(user_id,name,role) values(new.id,'Dani','super_admin') on conflict(user_id) do nothing;
end if;return new;end $$;
revoke all on function private.activate_invited_admin() from public,anon,authenticated;
create trigger voee_activate_invited_admin after insert or update of invited_at on auth.users for each row execute function private.activate_invited_admin();
commit;
