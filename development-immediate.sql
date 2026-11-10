-- At most one active development request per environment, including concurrent tabs.
create unique index ip_dev_one_active on public.ip_development_jobs(environment) where status in ('queued','processing');
alter table public.ip_development_jobs add column runner_state jsonb not null default '{}'::jsonb;
alter table public.ip_development_jobs add column runner_lock uuid;
alter table public.ip_development_jobs add column runner_until timestamptz;
create function public.ip_dev_runner_claim(job uuid default null) returns setof public.ip_development_jobs language plpgsql security invoker set search_path='' as $$
begin
 return query with chosen as (
 select id from public.ip_development_jobs where (job is null and environment='production' or id=job) and status in ('queued','processing') and (runner_until is null or runner_until<now()) order by created_at for update skip locked limit 1
 ) update public.ip_development_jobs j set status='processing',runner_lock=gen_random_uuid(),runner_until=now()+interval '90 seconds',lease_token=coalesce(lease_token,gen_random_uuid()),lease_until=now()+interval '2 hours',updated_at=now() from chosen c where j.id=c.id returning j.*;
end $$;
create function public.ip_dev_runner_save(job uuid, lock_token uuid, state jsonb, stage_label text) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.ip_development_jobs set runner_state=state,stage=stage_label,runner_until=null,runner_lock=null,updated_at=now() where id=job and runner_lock=lock_token and runner_until>now();
 if not found then raise exception '실행 잠금 만료'; end if;
end $$;
create table ip_dashboard_private.development_runner_config(id boolean primary key default true check(id), token text not null);
insert into ip_dashboard_private.development_runner_config(token) values(encode(gen_random_bytes(32),'hex'));
revoke all on ip_dashboard_private.development_runner_config from public,anon,authenticated;
create function public.ip_dev_runner_token() returns text language sql security definer set search_path='' as $$ select token from ip_dashboard_private.development_runner_config where id=true $$;
revoke all on function public.ip_dev_runner_token() from public,anon,authenticated;
grant execute on function public.ip_dev_runner_token() to service_role;
revoke all on function public.ip_dev_runner_claim(uuid),public.ip_dev_runner_save(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.ip_dev_runner_claim(uuid),public.ip_dev_runner_save(uuid,uuid,jsonb,text) to service_role;
