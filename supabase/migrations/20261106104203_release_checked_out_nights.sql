-- Checked-out stays remain in booking history, but their occupancy locks must
-- not prevent a future booking from using the same night.

delete from public.booking_nights
where booking_id in (
  select id from public.bookings where status = 'checked_out'
);

create or replace function public.release_checked_out_booking_nights()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'checked_out' and old.status <> 'checked_out' then
    delete from public.booking_nights where booking_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists release_checked_out_booking_nights_trigger on public.bookings;
create trigger release_checked_out_booking_nights_trigger
after update of status on public.bookings
for each row
execute function public.release_checked_out_booking_nights();

revoke all on function public.release_checked_out_booking_nights() from public, anon, authenticated;
grant execute on function public.release_checked_out_booking_nights() to service_role;
