-- Extend the booking lifecycle and record every admin booking action.

alter table public.bookings
  drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'checked_in', 'checked_out', 'rejected', 'cancelled', 'expired'));

alter table public.bookings
  add column if not exists confirmed_at timestamptz,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_out_at timestamptz;

update public.bookings
set confirmed_at = coalesce(confirmed_at, updated_at)
where status in ('confirmed', 'checked_in', 'checked_out');

create table if not exists public.booking_audit_log (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in (
    'manual_create', 'confirm', 'reject', 'cancel', 'edit', 'check_in', 'check_out'
  )),
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_audit_log_booking_created_idx
  on public.booking_audit_log (booking_id, created_at desc);

create index if not exists blocked_dates_created_by_idx
  on public.blocked_dates (created_by);

alter table public.booking_audit_log enable row level security;
revoke all on table public.booking_audit_log from anon, authenticated;
grant select on table public.booking_audit_log to authenticated;
grant all on table public.booking_audit_log to service_role;

drop policy if exists "Admins can read booking audit log" on public.booking_audit_log;
create policy "Admins can read booking audit log"
on public.booking_audit_log for select
to authenticated
using (exists (
  select 1 from public.admin_users
  where public.admin_users.user_id = (select auth.uid())
));

create or replace function public.admin_create_booking(
  p_actor_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_contact_number text,
  p_guest_count integer,
  p_check_in date,
  p_check_out date,
  p_message text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  booking_id uuid;
  v_booking_reference text;
  v_total_amount numeric(12, 2);
  expected_nights integer;
  inserted_nights integer;
  normalized_name text := btrim(coalesce(p_guest_name, ''));
  normalized_email text := lower(btrim(coalesce(p_guest_email, '')));
  normalized_phone text := btrim(coalesce(p_contact_number, ''));
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id) then
    return jsonb_build_object('ok', false, 'error', 'admin_required');
  end if;

  if char_length(normalized_name) not between 2 and 120
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_email) > 254
    or char_length(normalized_phone) not between 7 and 30
    or normalized_phone !~ '[0-9]'
    or p_guest_count not between 1 and 4
    or p_check_in is null
    or p_check_out is null
    or p_check_out <= p_check_in
    or p_check_in < current_date then
    return jsonb_build_object('ok', false, 'error', 'invalid_booking');
  end if;

  if exists (
    select 1 from public.blocked_dates
    where date >= p_check_in and date < p_check_out
  ) then
    return jsonb_build_object('ok', false, 'error', 'blocked_date');
  end if;

  expected_nights := p_check_out - p_check_in;
  v_total_amount := (
    select coalesce(sum(case when extract(isodow from stay_date) in (6, 7) then 2500 else 2000 end), 0)
    from generate_series(p_check_in, p_check_out - 1, interval '1 day') as dates(stay_date)
  );

  loop
    v_booking_reference := 'EF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (
      select 1 from public.bookings b where b.booking_reference = v_booking_reference
    );
  end loop;

  insert into public.bookings (
    booking_reference, guest_name, guest_email, contact_number, guest_count,
    check_in, check_out, message, total_amount, status, confirmed_at
  ) values (
    v_booking_reference, normalized_name, normalized_email, normalized_phone, p_guest_count,
    p_check_in, p_check_out, nullif(btrim(p_message), ''), v_total_amount, 'confirmed', now()
  ) returning id into booking_id;

  insert into public.booking_nights (booking_id, night, rate_amount)
  select booking_id,
    stay_date::date,
    case when extract(isodow from stay_date) in (6, 7) then 2500 else 2000 end
  from generate_series(p_check_in, p_check_out - 1, interval '1 day') as dates(stay_date)
  on conflict (night) do nothing;
  get diagnostics inserted_nights = row_count;

  if inserted_nights <> expected_nights then
    delete from public.bookings where id = booking_id;
    return jsonb_build_object('ok', false, 'error', 'date_conflict');
  end if;

  insert into public.booking_audit_log (booking_id, actor_id, action, from_status, to_status, details)
  values (
    booking_id, p_actor_id, 'manual_create', null, 'confirmed',
    jsonb_build_object('check_in', p_check_in, 'check_out', p_check_out, 'guest_count', p_guest_count)
  );

  return jsonb_build_object(
    'ok', true,
    'booking_id', booking_id,
    'booking_reference', v_booking_reference,
    'total_amount', v_total_amount
  );
end;
$$;

create or replace function public.admin_transition_booking(
  p_actor_id uuid,
  p_booking_id uuid,
  p_action text,
  p_new_check_in date default null,
  p_new_check_out date default null,
  p_new_guest_count integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  booking public.bookings%rowtype;
  overlapping public.bookings%rowtype;
  v_check_in date;
  v_check_out date;
  v_guest_count integer;
  expected_nights integer;
  inserted_nights integer;
  v_total_amount numeric(12, 2);
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id) then
    return jsonb_build_object('ok', false, 'error', 'admin_required');
  end if;

  select * into booking from public.bookings where id = p_booking_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'booking_not_found');
  end if;

  if p_action = 'confirm' then
    if booking.status <> 'pending' then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;
    if booking.pending_expires_at <= now() then
      perform public.expire_pending_bookings();
      return jsonb_build_object('ok', false, 'error', 'booking_expired');
    end if;
    if exists (select 1 from public.blocked_dates where date >= booking.check_in and date < booking.check_out) then
      return jsonb_build_object('ok', false, 'error', 'blocked_date');
    end if;

    expected_nights := booking.check_out - booking.check_in;
    insert into public.booking_nights (booking_id, night, rate_amount)
    select booking.id,
      stay_date::date,
      case when extract(isodow from stay_date) in (6, 7) then 2500 else 2000 end
    from generate_series(booking.check_in, booking.check_out - 1, interval '1 day') as dates(stay_date)
    on conflict (night) do nothing;
    get diagnostics inserted_nights = row_count;
    if inserted_nights <> expected_nights then
      delete from public.booking_nights where booking_id = booking.id;
      return jsonb_build_object('ok', false, 'error', 'date_conflict');
    end if;

    update public.bookings
    set status = 'confirmed', pending_expires_at = null, confirmed_at = coalesce(confirmed_at, now())
    where id = booking.id;
    insert into public.booking_audit_log (booking_id, actor_id, action, from_status, to_status)
    values (booking.id, p_actor_id, 'confirm', 'pending', 'confirmed');

    for overlapping in
      select * from public.bookings
      where status = 'pending'
        and id <> booking.id
        and check_in < booking.check_out
        and check_out > booking.check_in
      for update
    loop
      update public.bookings
      set status = 'rejected', pending_expires_at = null
      where id = overlapping.id;
      insert into public.booking_audit_log (booking_id, actor_id, action, from_status, to_status, details)
      values (
        overlapping.id, p_actor_id, 'reject', 'pending', 'rejected',
        jsonb_build_object('reason', 'overlapping_booking_confirmed', 'confirmed_booking_id', booking.id)
      );
    end loop;

    return jsonb_build_object('ok', true);
  elsif p_action = 'check_in' then
    if booking.status <> 'confirmed' then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;
    update public.bookings
    set status = 'checked_in', checked_in_at = now()
    where id = booking.id;
    insert into public.booking_audit_log (booking_id, actor_id, action, from_status, to_status)
    values (booking.id, p_actor_id, 'check_in', 'confirmed', 'checked_in');
    return jsonb_build_object('ok', true);
  elsif p_action = 'check_out' then
    if booking.status not in ('confirmed', 'checked_in') then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;
    update public.bookings
    set status = 'checked_out', checked_out_at = now()
    where id = booking.id;
    insert into public.booking_audit_log (booking_id, actor_id, action, from_status, to_status)
    values (booking.id, p_actor_id, 'check_out', booking.status, 'checked_out');
    return jsonb_build_object('ok', true);
  elsif p_action = 'reject' then
    if booking.status <> 'pending' then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;
    update public.bookings
    set status = 'rejected', pending_expires_at = null
    where id = booking.id;
    insert into public.booking_audit_log (booking_id, actor_id, action, from_status, to_status)
    values (booking.id, p_actor_id, 'reject', 'pending', 'rejected');
    return jsonb_build_object('ok', true);
  elsif p_action = 'cancel' then
    if booking.status not in ('pending', 'confirmed', 'checked_in') then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;
    delete from public.booking_nights where booking_id = booking.id;
    update public.bookings
    set status = 'cancelled', pending_expires_at = null
    where id = booking.id;
    insert into public.booking_audit_log (booking_id, actor_id, action, from_status, to_status)
    values (booking.id, p_actor_id, 'cancel', booking.status, 'cancelled');
    return jsonb_build_object('ok', true);
  elsif p_action = 'edit' then
    if booking.status not in ('pending', 'confirmed') then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;

    v_check_in := coalesce(p_new_check_in, booking.check_in);
    v_check_out := coalesce(p_new_check_out, booking.check_out);
    v_guest_count := coalesce(p_new_guest_count, booking.guest_count);
    if v_check_out <= v_check_in or v_guest_count not between 1 and 4 or v_check_in < current_date then
      return jsonb_build_object('ok', false, 'error', 'invalid_booking_update');
    end if;
    if exists (select 1 from public.blocked_dates where date >= v_check_in and date < v_check_out) then
      return jsonb_build_object('ok', false, 'error', 'blocked_date');
    end if;

    v_total_amount := (
      select coalesce(sum(case when extract(isodow from stay_date) in (6, 7) then 2500 else 2000 end), 0)
      from generate_series(v_check_in, v_check_out - 1, interval '1 day') as dates(stay_date)
    );

    if booking.status = 'confirmed' then
      expected_nights := v_check_out - v_check_in;
      delete from public.booking_nights where booking_id = booking.id;
      insert into public.booking_nights (booking_id, night, rate_amount)
      select booking.id,
        stay_date::date,
        case when extract(isodow from stay_date) in (6, 7) then 2500 else 2000 end
      from generate_series(v_check_in, v_check_out - 1, interval '1 day') as dates(stay_date)
      on conflict (night) do nothing;
      get diagnostics inserted_nights = row_count;
      if inserted_nights <> expected_nights then
        raise exception using errcode = '23P01', message = 'booking_conflict';
      end if;
    end if;

    update public.bookings
    set check_in = v_check_in, check_out = v_check_out, guest_count = v_guest_count, total_amount = v_total_amount
    where id = booking.id;
    insert into public.booking_audit_log (booking_id, actor_id, action, from_status, to_status, details)
    values (
      booking.id, p_actor_id, 'edit', booking.status, booking.status,
      jsonb_build_object(
        'old_check_in', booking.check_in,
        'old_check_out', booking.check_out,
        'old_guest_count', booking.guest_count,
        'new_check_in', v_check_in,
        'new_check_out', v_check_out,
        'new_guest_count', v_guest_count
      )
    );
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'unsupported_action');
end;
$$;

revoke all on function public.admin_create_booking(uuid, text, text, text, integer, date, date, text) from public, anon, authenticated;
grant execute on function public.admin_create_booking(uuid, text, text, text, integer, date, date, text) to service_role;
revoke all on function public.admin_transition_booking(uuid, uuid, text, date, date, integer) from public, anon, authenticated;
grant execute on function public.admin_transition_booking(uuid, uuid, text, date, date, integer) to service_role;
