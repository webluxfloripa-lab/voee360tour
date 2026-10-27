create function public.claim_admin_invite() returns text language plpgsql security definer set search_path='' as $$
declare target text;begin
-- Service-only setup operation. Never accepts an arbitrary email or returns an auth token.
update private.admin_bootstrap set claimed_at=now() where email='wowdanielnadal@gmail.com' and completed_at is null and (claimed_at is null or claimed_at<now()-interval '10 minutes') returning email into target;return target;end $$;
create function public.finish_admin_invite(p_success boolean) returns void language plpgsql security definer set search_path='' as $$begin update private.admin_bootstrap set completed_at=case when p_success then now() else null end,claimed_at=case when p_success then claimed_at else null end where email='wowdanielnadal@gmail.com';end $$;
revoke all on function public.claim_admin_invite() from public,anon,authenticated;
revoke all on function public.finish_admin_invite(boolean) from public,anon,authenticated;
grant execute on function public.claim_admin_invite() to service_role;
grant execute on function public.finish_admin_invite(boolean) to service_role;
