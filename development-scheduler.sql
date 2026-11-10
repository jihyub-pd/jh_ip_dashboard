-- Apply only after development-runner deployment and OPENAI_API_KEY setup.
-- Continues queued background responses when the user's browser is closed.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('ip-development-progress','* * * * *',$cron$
 select net.http_post(
  url:='https://ozhdfewlboheqpcvbqgz.supabase.co/functions/v1/development-runner',
  headers:='{"Content-Type":"application/json"}'::jsonb,
  body:=jsonb_build_object('worker_token',(select token from ip_dashboard_private.development_runner_config where id=true)),
  timeout_milliseconds:=55000
 ) where exists(select 1 from public.ip_development_jobs where environment='production' and status in ('queued','processing'));
$cron$);
