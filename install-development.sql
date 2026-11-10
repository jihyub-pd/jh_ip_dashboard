-- Private, versioned development queue. Applied via Supabase migrations.
create table public.ip_development_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id),
 request_key uuid not null,
 environment text not null default 'production' check(environment in ('production','test')),
 parent_id uuid references public.ip_development_jobs(id),
 root_id uuid not null,
 version integer not null default 1,
 source_id text,
 source_snapshot jsonb not null default '{}'::jsonb,
 title text not null check(char_length(btrim(title)) between 1 and 200),
 mode text not null check(mode in ('ip','idea')),
 source_text text not null default '' check(char_length(source_text)<=150000),
 request_text text not null default '' check(char_length(request_text)<=10000),
 status text not null default 'queued' check(status in ('queued','processing','completed','needs_revision','failed')),
 stage text not null default '접수 대기',
 attempts integer not null default 0,
 lease_token uuid,
 lease_until timestamptz,
 draft jsonb,
 review jsonb,
 result jsonb,
 error_message text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(user_id,request_key), unique(root_id,version)
);
create index ip_dev_owner_time on public.ip_development_jobs(user_id,environment,created_at desc);
create index ip_dev_pending on public.ip_development_jobs(environment,status,created_at);
create index ip_dev_parent on public.ip_development_jobs(parent_id);

create function public.ip_dev_prepare() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.ip_development_jobs; payload jsonb;
begin
 if new.parent_id is not null then
  select * into p from public.ip_development_jobs where id=new.parent_id;
  if not found or p.user_id<>new.user_id or p.environment<>new.environment or p.status not in ('completed','needs_revision') then raise exception '수정할 기획안의 권한과 완료 상태를 확인하세요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p.root_id::text,0));
  new.root_id:=p.root_id;
  select coalesce(max(version),0)+1 into new.version from public.ip_development_jobs where root_id=p.root_id;
  new.source_id:=p.source_id; new.source_snapshot:=p.source_snapshot; new.title:=p.title; new.mode:=p.mode;
  if btrim(new.source_text)='' then new.source_text:=p.source_text; end if;
  if btrim(new.request_text)='' then raise exception '수정 의견을 입력하세요.'; end if;
 else
  new.root_id:=new.id; new.version:=1;
  if new.mode='ip' then
   if new.environment='production' then select content into payload from public.kdrama_ips where id=new.source_id;
   else select content into payload from public.kdrama_ips_test where id=new.source_id; end if;
   if payload is null then raise exception '원작 IP를 찾지 못했습니다.'; end if;
   new.source_snapshot:=payload; new.title:=payload->>'title';
  elsif btrim(new.source_text)='' then raise exception '로그라인 또는 캐릭터 아이디어를 입력하세요.';
  end if;
 end if;
 return new;
end $$;
create trigger ip_dev_prepare before insert on public.ip_development_jobs for each row execute function public.ip_dev_prepare();
revoke all on function public.ip_dev_prepare() from public,anon,authenticated;
alter table public.ip_development_jobs enable row level security;
revoke all on public.ip_development_jobs from anon,authenticated;
grant select on public.ip_development_jobs to authenticated;
grant insert(request_key,environment,parent_id,source_id,title,mode,source_text,request_text) on public.ip_development_jobs to authenticated;
grant all on public.ip_development_jobs to service_role;
create policy ip_dev_read on public.ip_development_jobs for select to authenticated using ((select public.ip_dashboard_can_write()) and user_id=(select auth.uid()));
create policy ip_dev_insert on public.ip_development_jobs for insert to authenticated with check ((select public.ip_dashboard_can_write()) and user_id=(select auth.uid()) and status='queued' and attempts=0 and result is null);

create table public.ip_development_assets (
 job_id uuid not null references public.ip_development_jobs(id),
 name text not null check(name ~ '^[a-zA-Z0-9_-]+\.(pdf|png|jpg)$'),
 mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),
 chunk_index integer not null check(chunk_index between 0 and 999),
 data_base64 text not null check(length(data_base64) between 1 and 48000 and data_base64 ~ '^[A-Za-z0-9+/=]+$'),
 primary key(job_id,name,chunk_index)
);
alter table public.ip_development_assets enable row level security;
revoke all on public.ip_development_assets from anon,authenticated;
grant select on public.ip_development_assets to authenticated;
grant all on public.ip_development_assets to service_role;
create policy ip_dev_asset_read on public.ip_development_assets for select to authenticated using (exists(select 1 from public.ip_development_jobs j where j.id=job_id and j.user_id=(select auth.uid()) and j.status in ('completed','needs_revision')) and (select public.ip_dashboard_can_write()));

create function public.ip_dev_claim(target_environment text default 'production') returns setof public.ip_development_jobs language plpgsql security invoker set search_path='' as $$
begin
 if target_environment not in ('production','test') then raise exception '환경 오류'; end if;
 update public.ip_development_jobs set status='failed',stage='처리 중단',error_message='반복 중단으로 처리를 멈췄습니다. 다시 시도할 수 있습니다.',lease_token=null,lease_until=null,updated_at=now() where environment=target_environment and status='processing' and lease_until<now() and attempts>=3;
 return query with candidate as (
  select id from public.ip_development_jobs where environment=target_environment and (status='queued' or (status='processing' and lease_until<now())) and attempts<3 order by created_at for update skip locked limit 1
 ) update public.ip_development_jobs j set status='processing',stage='자료 확인',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 hours',updated_at=now() from candidate c where j.id=c.id returning j.*;
end $$;

create function public.ip_dev_checkpoint(job uuid, token uuid, current_stage text, draft_payload jsonb default null, review_payload jsonb default null) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.ip_development_jobs set stage=left(current_stage,100),draft=coalesce(draft_payload,draft),review=coalesce(review_payload,review),lease_until=now()+interval '2 hours',updated_at=now() where id=job and status='processing' and lease_token=token and lease_until>now();
 if not found then raise exception '작업 권한 만료'; end if;
end $$;

create function public.ip_dev_asset_put(job uuid, token uuid, filename text, mime text, part integer, encoded text) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.ip_development_jobs where id=job and status='processing' and lease_token=token and lease_until>now() for update;
 if not found then raise exception '작업 권한 만료'; end if;
 insert into public.ip_development_assets(job_id,name,mime_type,chunk_index,data_base64) values(job,filename,mime,part,encoded) on conflict(job_id,name,chunk_index) do update set mime_type=excluded.mime_type,data_base64=excluded.data_base64;
end $$;

create function public.ip_dev_finish(job uuid, token uuid, payload jsonb, verdict text) returns void language plpgsql security invoker set search_path='' as $$
declare r public.ip_development_jobs; k text; a jsonb; bytes bytea; parts integer; start_part integer; last_part integer; encoded text; mime_count integer;
begin
 select * into r from public.ip_development_jobs where id=job for update;
 if not found or r.status<>'processing' or r.lease_token is distinct from token or r.lease_until<=now() then raise exception '작업 권한 만료'; end if;
 if verdict not in ('completed','needs_revision') then raise exception '완료 상태 오류'; end if;
 foreach k in array array['logline','key_points','characters','synopsis','changes','verification','scope'] loop
  if coalesce(btrim(payload->>k),'')='' then raise exception '결과 필수 항목 누락: %',k; end if;
 end loop;
 if coalesce(r.review->>'independent','false')<>'true' or coalesce(r.review->>'reviewer_run_id','')='' or coalesce(r.review->>'author_run_id','')='' or r.review->>'reviewer_run_id'=r.review->>'author_run_id' or coalesce(r.review->>'findings','')='' or coalesce(r.review->>'recheck','')='' then raise exception '독립 레드팀 및 재검토 기록이 필요합니다.'; end if;
 if jsonb_typeof(payload->'assets') is distinct from 'array' or jsonb_array_length(payload->'assets')<3 then raise exception 'PDF와 인물·공간 프리비주얼이 필요합니다.'; end if;
 if (select count(*) from jsonb_array_elements(payload->'assets') v where v->>'mime'='application/pdf')<>1 then raise exception 'PDF 파일이 필요합니다.'; end if;
 for a in select * from jsonb_array_elements(payload->'assets') loop
  select count(*),min(chunk_index),max(chunk_index),string_agg(data_base64,'' order by chunk_index),count(distinct mime_type) into parts,start_part,last_part,encoded,mime_count from public.ip_development_assets where job_id=job and name=a->>'name' and mime_type=a->>'mime';
  if parts<>(a->>'chunks')::integer or start_part<>0 or last_part<>parts-1 or mime_count<>1 then raise exception '파일 조각 누락'; end if;
  bytes:=decode(encoded,'base64');
  if octet_length(bytes)<>(a->>'bytes')::integer or octet_length(bytes)>20000000 then raise exception '파일 크기 불일치'; end if;
  if a->>'mime'='application/pdf' and substring(bytes from 1 for 4)<>decode('25504446','hex') then raise exception 'PDF 형식 오류'; end if;
  if a->>'mime'='image/png' and substring(bytes from 1 for 8)<>decode('89504e470d0a1a0a','hex') then raise exception 'PNG 형식 오류'; end if;
  if a->>'mime'='image/jpeg' and substring(bytes from 1 for 3)<>decode('ffd8ff','hex') then raise exception 'JPEG 형식 오류'; end if;
 end loop;
 update public.ip_development_jobs set result=payload,status=verdict,stage='검토 완료',completed_at=now(),updated_at=now(),lease_token=null,lease_until=null,error_message='' where id=job;
end $$;

create function public.ip_dev_fail(job uuid,token uuid,reason text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.ip_development_jobs set status='failed',stage='처리 중단',error_message=left(reason,1000),lease_token=null,lease_until=null,updated_at=now() where id=job and status='processing' and lease_token=token and lease_until>now();
 return found;
end $$;

-- Owner retries by inserting a new request with a fresh idempotency key through this RPC.
create function public.ip_dev_retry(job uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.ip_development_jobs; new_id uuid;
begin
 select * into r from public.ip_development_jobs where id=job;
 if not found or r.user_id is distinct from auth.uid() or not public.ip_dashboard_can_write() or r.status<>'failed' then raise exception '재시도 권한이나 상태를 확인하세요.'; end if;
 insert into public.ip_development_jobs(request_key,environment,parent_id,source_id,title,mode,source_text,request_text) values(gen_random_uuid(),r.environment,r.parent_id,r.source_id,r.title,r.mode,r.source_text,r.request_text) returning id into new_id;
 return new_id;
end $$;
revoke all on function public.ip_dev_retry(uuid) from public,anon;
grant execute on function public.ip_dev_retry(uuid) to authenticated;
revoke all on function public.ip_dev_claim(text),public.ip_dev_checkpoint(uuid,uuid,text,jsonb,jsonb),public.ip_dev_asset_put(uuid,uuid,text,text,integer,text),public.ip_dev_finish(uuid,uuid,jsonb,text),public.ip_dev_fail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ip_dev_claim(text),public.ip_dev_checkpoint(uuid,uuid,text,jsonb,jsonb),public.ip_dev_asset_put(uuid,uuid,text,text,integer,text),public.ip_dev_finish(uuid,uuid,jsonb,text),public.ip_dev_fail(uuid,uuid,text) to service_role;
