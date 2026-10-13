create table public.ip_analysis_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 environment text not null default 'production' check(environment in ('production','test')),
 title text not null check(char_length(btrim(title)) between 1 and 200),
 source_url text not null default '' check(char_length(source_url)<=2000 and (source_url='' or source_url ~ '^https?://')),
 purpose text not null default '드라마화 가능성' check(char_length(purpose) between 1 and 200),
 questions text not null default '' check(char_length(questions)<=5000),
 status text not null default 'queued' check(status in ('queued','processing','completed','failed')),
 attempts integer not null default 0,
 lease_token uuid,
 lease_until timestamptz,
 result_id text,
 error_message text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz
);
create index ip_requests_pending on public.ip_analysis_requests(environment,status,created_at);
alter table public.ip_analysis_requests enable row level security;
revoke all on public.ip_analysis_requests from anon,authenticated;
grant select on public.ip_analysis_requests to authenticated;
grant insert (title,source_url,purpose,questions,environment) on public.ip_analysis_requests to authenticated;
grant update (status) on public.ip_analysis_requests to authenticated;
grant all on public.ip_analysis_requests to service_role;
create policy ip_requests_owner_read on public.ip_analysis_requests for select to authenticated using ((select public.ip_dashboard_can_write()) and user_id=(select auth.uid()));
create policy ip_requests_owner_insert on public.ip_analysis_requests for insert to authenticated with check ((select public.ip_dashboard_can_write()) and user_id=(select auth.uid()) and status='queued' and attempts=0 and result_id is null);
create policy ip_requests_owner_retry on public.ip_analysis_requests for update to authenticated using ((select public.ip_dashboard_can_write()) and user_id=(select auth.uid()) and status='failed') with check ((select public.ip_dashboard_can_write()) and user_id=(select auth.uid()) and status='queued');
create function public.ip_request_retry_reset() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='failed' and new.status='queued' then new.attempts:=0;new.error_message:='';new.updated_at:=now();new.lease_token:=null;new.lease_until:=null;end if;
 return new;
end $$;
create trigger ip_request_retry before update on public.ip_analysis_requests for each row execute function public.ip_request_retry_reset();
revoke all on function public.ip_request_retry_reset() from public,anon,authenticated;
create function public.ip_claim_analysis_request() returns setof public.ip_analysis_requests language plpgsql security invoker set search_path='' as $$
begin
 update public.ip_analysis_requests set status='failed',error_message='분석이 반복해서 중단되었습니다. 다시 의뢰를 실행해 주세요.',lease_token=null,lease_until=null,updated_at=now() where environment='production' and status='processing' and lease_until<now() and attempts>=3;
 return query
 with candidate as (
 select id from public.ip_analysis_requests where environment='production' and (status='queued' or (status='processing' and lease_until<now())) and attempts<3 order by created_at for update skip locked limit 1
 ) update public.ip_analysis_requests r set status='processing',attempts=r.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 hours',error_message='',updated_at=now() from candidate c where r.id=c.id returning r.*;
end $$;
create function public.ip_finish_analysis_request(request_id uuid,token uuid,analysis jsonb) returns text language plpgsql security invoker set search_path='' as $$
declare r public.ip_analysis_requests; result text; stamp text; payload jsonb; key text;
begin
 select * into r from public.ip_analysis_requests where id=request_id for update;
 if not found or r.status<>'processing' or r.lease_token is distinct from token then raise exception '의뢰 처리 권한이 만료됐습니다.';end if;
 if jsonb_typeof(analysis)<>'object' or coalesce(btrim(analysis->>'title'),'')='' or coalesce(btrim(analysis->>'logline'),'')='' or coalesce(btrim(analysis->>'premise'),'')='' then raise exception '분석 필수 항목이 누락됐습니다.';end if;
 if coalesce(analysis->>'recommendation','') not in ('추천','보류','리서치 필요') then raise exception '분석 판정을 확인하세요.';end if;
 if coalesce(jsonb_typeof(analysis->'sources'),'')<>'array' or jsonb_array_length(analysis->'sources')=0 then raise exception '검증 출처가 필요합니다.';end if;
 foreach key in array array['dramaFit','marketPotential','productionFeasibility','originality','scalability','globalPotential','characterAppeal'] loop
 if coalesce(jsonb_typeof(analysis->'scores'->key),'')<>'number' or (analysis->'scores'->>key)::numeric not between 0 and 10 or coalesce(btrim(analysis->'scoreRationales'->>key),'')='' then raise exception '점수와 근거를 확인하세요: %',key;end if;
 end loop;
 result:='request-'||r.id::text;stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 payload:=analysis||jsonb_build_object('id',result,'createdAt',stamp,'updatedAt',stamp,'starred',false,'userMemo','','analysisRequestId',r.id);
 if r.environment='production' then
 insert into public.kdrama_ips(id,title,"createdAt","updatedAt",content) values(result,analysis->>'title',stamp,stamp,payload);
 else
 insert into public.kdrama_ips_test(id,title,"createdAt","updatedAt",content) values(result,analysis->>'title',stamp,stamp,payload);
 end if;
 update public.ip_analysis_requests set status='completed',result_id=result,completed_at=now(),updated_at=now(),lease_token=null,lease_until=null,error_message='' where id=r.id;
 return result;
end $$;
create function public.ip_fail_analysis_request(request_id uuid,token uuid,message text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.ip_analysis_requests set status=case when attempts>=3 then 'failed' else 'queued' end,error_message=left(message,1000),lease_token=null,lease_until=null,updated_at=now() where id=request_id and status='processing' and lease_token=token;
 return found;
end $$;
revoke all on function public.ip_claim_analysis_request(),public.ip_finish_analysis_request(uuid,uuid,jsonb),public.ip_fail_analysis_request(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ip_claim_analysis_request(),public.ip_finish_analysis_request(uuid,uuid,jsonb),public.ip_fail_analysis_request(uuid,uuid,text) to service_role;
comment on table public.ip_analysis_requests is 'Owner-only IP analysis queue. Hourly ChatGPT automation consumes production requests. Test requests never enter the production queue.';
