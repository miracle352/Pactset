-- Run Pactset's existing durable in-app reminder worker without exposing a
-- public endpoint or placing a service-role credential in Vercel.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.run_scheduled_reminder_worker()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scheduled jsonb;
  v_delivered jsonb;
begin
  -- The existing public worker functions deliberately accept only a
  -- service-role request. This private, non-executable-by-clients bridge is
  -- owned and invoked by Postgres cron, so it supplies that claim only for
  -- the duration of this transaction.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  select public.refresh_scheduled_reminders() into v_scheduled;
  select public.deliver_due_reminders(100) into v_delivered;

  return jsonb_build_object(
    'scheduled', v_scheduled,
    'delivered', v_delivered,
    'channel', 'in_app'
  );
end;
$$;

revoke all on function private.run_scheduled_reminder_worker() from public, anon, authenticated, service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'pactset-in-app-reminders'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'pactset-in-app-reminders',
    '* * * * *',
    'select private.run_scheduled_reminder_worker();'
  );
end;
$$;

comment on function private.run_scheduled_reminder_worker() is
  'Internal pg_cron entry point for durable Pactset in-app reminders. No client role has execute permission.';
