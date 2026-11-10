-- ChatGPT connector uploads only. No public upload endpoint or AI API required.
alter table public.ip_development_jobs add column origin text not null default 'api' check (origin in ('api','chatgpt'));
-- Browser is a read-only archive. Retire the old request insertion path.
revoke insert(request_key,environment,parent_id,source_id,title,mode,source_text,request_text) on public.ip_development_jobs from authenticated;
revoke execute on function public.ip_dev_retry(uuid) from authenticated;

create function public.ip_dev_import_begin(owner_id uuid, import_key uuid, metadata jsonb, review_record jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare existing public.ip_development_jobs; new_id uuid;
begin
 if not exists(select 1 from ip_dashboard_private.owners where user_id=owner_id) then raise exception 'Dashboard owner required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(import_key::text,0));
 select * into existing from public.ip_development_jobs where user_id=owner_id and request_key=import_key;
 if found then
  if existing.origin<>'chatgpt' then raise exception 'Import key conflict'; end if;
  if existing.status in ('completed','needs_revision') then return existing.id; end if;
  update public.ip_development_jobs set status='processing', stage='ChatGPT 결과 등록 중', lease_until=now()+interval '2 hours', error_message='', review=review_record where id=existing.id;
  return existing.id;
 end if;
 insert into public.ip_development_jobs(user_id,request_key,environment,parent_id,source_id,title,mode,source_text,request_text,status,stage,origin,lease_token,lease_until,review)
 values(owner_id,import_key,coalesce(metadata->>'environment','production'),nullif(metadata->>'parent_id','')::uuid,nullif(metadata->>'source_id',''),metadata->>'title',coalesce(metadata->>'mode','ip'),coalesce(metadata->>'source_text','ChatGPT에서 개발한 기획안'),coalesce(metadata->>'request_text','ChatGPT 기획개발 결과 등록'),'processing','ChatGPT 결과 등록 중','chatgpt',gen_random_uuid(),now()+interval '2 hours',review_record)
 returning id into new_id;
 return new_id;
end $$;

create function public.ip_dev_import_asset(owner_id uuid,import_key uuid,filename text,mime text,part integer,encoded text) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.ip_development_jobs;
begin
 select * into r from public.ip_development_jobs where user_id=owner_id and request_key=import_key and origin='chatgpt';
 if not found then raise exception 'Import not found'; end if;
 if r.status in ('completed','needs_revision') then return; end if;
 perform public.ip_dev_asset_put(r.id,r.lease_token,filename,mime,part,encoded);
end $$;

create function public.ip_dev_import_finish(owner_id uuid,import_key uuid,payload jsonb,verdict text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare r public.ip_development_jobs;
begin
 select * into r from public.ip_development_jobs where user_id=owner_id and request_key=import_key and origin='chatgpt' for update;
 if not found then raise exception 'Import not found'; end if;
 if r.status in ('completed','needs_revision') then return r.id; end if;
 if jsonb_typeof(payload->'assets') is distinct from 'array' then raise exception 'Assets required'; end if;
 if not exists(select 1 from jsonb_array_elements(payload->'assets') a where a->>'name'='characters.png' and a->>'mime'='image/png') or not exists(select 1 from jsonb_array_elements(payload->'assets') a where a->>'name'='spaces.png' and a->>'mime'='image/png') then raise exception 'Character and space boards required'; end if;
 perform public.ip_dev_finish(r.id,r.lease_token,payload,verdict);
 update public.ip_development_jobs set stage='ChatGPT 기획안 등록 완료' where id=r.id;
 return r.id;
end $$;
revoke all on function public.ip_dev_import_begin(uuid,uuid,jsonb,jsonb),public.ip_dev_import_asset(uuid,uuid,text,text,integer,text),public.ip_dev_import_finish(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.ip_dev_import_begin(uuid,uuid,jsonb,jsonb),public.ip_dev_import_asset(uuid,uuid,text,text,integer,text),public.ip_dev_import_finish(uuid,uuid,jsonb,text) to service_role;
