create extension if not exists pg_cron;

select cron.schedule(
  'estudio-expire-pending-bookings',
  '*/15 * * * *',
  $$select public.expire_pending_bookings();$$
)
where not exists (
  select 1 from cron.job where jobname = 'estudio-expire-pending-bookings'
);
