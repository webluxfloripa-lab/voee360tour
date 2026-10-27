-- Run using the owner's Supabase SQL integration. All business-data tests rollback
-- inside an exception subtransaction; no publication or draft is left changed.
create temporary table voee_qa_results(result jsonb);
do $$
declare pid uuid;other uuid;uid uuid;rev uuid;oldrev uuid;snap jsonb;v1 uuid;v2 uuid;v3 uuid;blocked boolean;results jsonb:='[]'::jsonb;before_count integer;
begin
select id into pid from public.projects where slug='seven-sports-bar';
select id into other from public.projects where slug='nostro-fumo';
select user_id into uid from public.profiles where role='super_admin';
if uid is null then raise exception 'An invited administrator must exist before running QA';end if;
begin
perform set_config('request.jwt.claim.sub',uid::text,true);
perform set_config('role','authenticated',true);
if not public.is_super_admin() then raise exception 'Owner role unavailable';end if;
select snapshot,revision into snap,rev from public.tour_drafts where project_id=pid;
select count(*) into before_count from public.tour_versions where project_id=pid;
oldrev:=rev;rev:=public.save_draft(pid,snap,rev);
blocked:=false;begin perform public.save_draft(pid,snap,oldrev);exception when others then blocked:=SQLERRM like '%REVISION_CONFLICT%';end;if not blocked then raise exception 'Conflict test failed';end if;
results:=results||'[{"test":"optimistic_conflict","passed":true}]';
v1:=public.publish_tour(pid,rev,'QA V1 — rolled back');
snap:=jsonb_set(snap,'{title}','"QA V2"');rev:=public.save_draft(pid,snap,rev);v2:=public.publish_tour(pid,rev,'QA V2 — rolled back');
rev:=public.restore_version(pid,v1,rev);
if (select revision from public.tour_drafts where project_id=pid)<>rev or (select snapshot->>'title' from public.tour_drafts where project_id=pid)='QA V2' then raise exception 'Restore did not persist';end if;
if (select version_id from public.published_tours where project_id=pid)<>v2 then raise exception 'Restore changed the publication';end if;
v3:=public.publish_tour(pid,rev,'QA V3 — rolled back');
if v3=v1 or v3=v2 or (select count(*) from public.tour_versions where project_id=pid)<>before_count+4 then raise exception 'History not preserved';end if;
results:=results||'[{"test":"publish_v1_v2_restore_v1_to_draft_publish_v3","passed":true},{"test":"historical_versions_immutable_and_retained","passed":true}]';
blocked:=false;begin perform public.save_draft(other,snap,(select revision from public.tour_drafts where project_id=other));exception when others then blocked:=SQLERRM like '%CROSS_PROJECT%';end;if not blocked then raise exception 'Cross-project media accepted';end if;
blocked:=false;begin perform public.restore_version(other,v1,(select revision from public.tour_drafts where project_id=other));exception when others then blocked:=true;end;if not blocked then raise exception 'Cross-project restore accepted';end if;
results:=results||'[{"test":"cross_project_media_and_restore_denied","passed":true}]';
snap:=jsonb_set(snap,'{scenes,0,panoramaAssetId}','null');rev:=public.save_draft(pid,snap,rev);
blocked:=false;begin perform public.publish_tour(pid,rev,'Must fail');exception when others then blocked:=SQLERRM like '%MEDIA_MISSING%';end;if not blocked then raise exception 'Missing media accepted';end if;
if (select version_id from public.published_tours where project_id=pid)<>v3 then raise exception 'Failed publication changed public state';end if;
results:=results||'[{"test":"missing_media_publication_atomic_failure","passed":true}]';
perform set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
if public.is_super_admin() or exists(select 1 from public.tour_drafts) then raise exception 'Ordinary user read drafts';end if;
blocked:=false;begin perform public.manage_client('{"name":"Unauthorized","slug":"unauthorized"}');exception when others then blocked:=SQLERRM like '%SUPER_ADMIN_REQUIRED%';end;if not blocked then raise exception 'Ordinary user write allowed';end if;
results:=results||'[{"test":"ordinary_user_cannot_access_or_mutate_admin_data","passed":true}]';
perform set_config('request.jwt.claim.sub','',true);perform set_config('role','anon',true);
if (select count(*) from public.published_tours)<>1 then raise exception 'Anonymous public snapshot unavailable';end if;
blocked:=false;begin perform public.publish_tour(pid,rev,'Anonymous');exception when insufficient_privilege then blocked:=true;end;if not blocked then raise exception 'Anonymous publish allowed';end if;
results:=results||'[{"test":"anonymous_can_only_read_complete_publication","passed":true}]';
raise sqlstate 'ZQA01' using message='Intentional QA rollback';
exception when sqlstate 'ZQA01' then null;
end;
insert into voee_qa_results values(results);
end $$;
select result from voee_qa_results;
