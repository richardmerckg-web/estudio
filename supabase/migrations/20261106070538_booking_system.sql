create extension if not exists pgcrypto;

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.blocked_dates (
  date date primary key,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  guest_name text not null check (char_length(btrim(guest_name)) between 2 and 120),
  guest_email text not null check (char_length(btrim(guest_email)) between 3 and 254),
  contact_number text not null check (char_length(btrim(contact_number)) between 7 and 30),
  guest_count integer not null check (guest_count between 1 and 4),
  check_in date not null,
  check_out date not null,
  message text,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled', 'expired')),
  pending_expires_at timestamptz,
  email_delivery_status text not null default 'not_sent' check (email_delivery_status in ('not_sent', 'not_configured', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check ((status = 'pending' and pending_expires_at is not null) or status <> 'pending')
);

create table public.booking_nights (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  night date not null,
  rate_amount numeric(12, 2) not null check (rate_amount in (2000, 2500)),
  primary key (booking_id, night),
  unique (night)
);

create index bookings_status_check_in_idx on public.bookings (status, check_in);
create index bookings_created_at_idx on public.bookings (created_at desc);
create index booking_nights_night_idx on public.booking_nights (night);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_nights enable row level security;
alter table public.blocked_dates enable row level security;

revoke all on table public.admin_users, public.bookings, public.booking_nights, public.blocked_dates from anon;
revoke all on table public.admin_users, public.bookings, public.booking_nights, public.blocked_dates from authenticated;
grant select on table public.admin_users, public.bookings, public.booking_nights, public.blocked_dates to authenticated;
grant all on table public.admin_users, public.bookings, public.booking_nights, public.blocked_dates to service_role;

create policy "Admins can read their admin record"
on public.admin_users for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Admins can read bookings"
on public.bookings for select
to authenticated
using (exists (
  select 1 from public.admin_users
  where public.admin_users.user_id = (select auth.uid())
));

create policy "Admins can read booking nights"
on public.booking_nights for select
to authenticated
using (exists (
  select 1 from public.admin_users
  where public.admin_users.user_id = (select auth.uid())
));

create policy "Admins can read blocked dates"
on public.blocked_dates for select
to authenticated
using (exists (
  select 1 from public.admin_users
  where public.admin_users.user_id = (select auth.uid())
));

create or replace function public.expire_pending_bookings()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  expired_ids uuid[];
begin
  with expired as (
    update public.bookings
    set status = 'expired', updated_at = now()
    where status = 'pending'
      and pending_expires_at <= now()
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[])
  into expired_ids
  from expired;

  if coalesce(array_length(expired_ids, 1), 0) > 0 then
    delete from public.booking_nights
    where booking_id = any(expired_ids);
  end if;

  return coalesce(array_length(expired_ids, 1), 0);
end;
$$;

create or replace function public.create_pending_booking(
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
  pending_expires_at timestamptz := now() + interval '24 hours';
  expected_nights integer;
  inserted_nights integer;
  v_total_amount numeric(12, 2);
begin
  perform public.expire_pending_bookings();

  if p_check_out <= p_check_in then
    return jsonb_build_object('ok', false, 'error', 'invalid_dates');
  end if;

  if p_guest_count < 1 or p_guest_count > 4 then
    return jsonb_build_object('ok', false, 'error', 'invalid_guest_count');
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
    booking_reference,
    guest_name,
    guest_email,
    contact_number,
    guest_count,
    check_in,
    check_out,
    message,
    total_amount,
    status,
    pending_expires_at
  ) values (
    v_booking_reference,
    btrim(p_guest_name),
    lower(btrim(p_guest_email)),
    btrim(p_contact_number),
    p_guest_count,
    p_check_in,
    p_check_out,
    nullif(btrim(p_message), ''),
    v_total_amount,
    'pending',
    pending_expires_at
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

  return jsonb_build_object(
    'ok', true,
    'booking_id', booking_id,
    'booking_reference', v_booking_reference,
    'total_amount', v_total_amount,
    'pending_expires_at', pending_expires_at
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
    if (select count(*) from public.booking_nights where booking_id = booking.id) <> booking.check_out - booking.check_in then
      return jsonb_build_object('ok', false, 'error', 'date_conflict');
    end if;
    update public.bookings
    set status = 'confirmed', pending_expires_at = null
    where id = booking.id;
    return jsonb_build_object('ok', true);
  elsif p_action in ('reject', 'cancel') then
    if booking.status not in ('pending', 'confirmed') then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;
    delete from public.booking_nights where booking_id = booking.id;
    update public.bookings
    set status = p_action
    where id = booking.id;
    return jsonb_build_object('ok', true);
  elsif p_action = 'edit' then
    if booking.status not in ('pending', 'confirmed') then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;

    v_check_in := coalesce(p_new_check_in, booking.check_in);
    v_check_out := coalesce(p_new_check_out, booking.check_out);
    v_guest_count := coalesce(p_new_guest_count, booking.guest_count);
    if v_check_out <= v_check_in or v_guest_count not between 1 and 4 then
      return jsonb_build_object('ok', false, 'error', 'invalid_booking_update');
    end if;
    if exists (select 1 from public.blocked_dates where date >= v_check_in and date < v_check_out) then
      return jsonb_build_object('ok', false, 'error', 'blocked_date');
    end if;

    expected_nights := v_check_out - v_check_in;
    v_total_amount := (
      select coalesce(sum(case when extract(isodow from stay_date) in (6, 7) then 2500 else 2000 end), 0)
      from generate_series(v_check_in, v_check_out - 1, interval '1 day') as dates(stay_date)
    );
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

    update public.bookings
    set check_in = v_check_in,
        check_out = v_check_out,
        guest_count = v_guest_count,
        total_amount = v_total_amount
    where id = booking.id;
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'unsupported_action');
end;
$$;

create or replace function public.admin_set_blocked_date(
  p_actor_id uuid,
  p_date date,
  p_reason text default null,
  p_should_block boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id) then
    return jsonb_build_object('ok', false, 'error', 'admin_required');
  end if;

  if p_should_block then
    if exists (select 1 from public.booking_nights where night = p_date) then
      return jsonb_build_object('ok', false, 'error', 'date_conflict');
    end if;
    insert into public.blocked_dates (date, reason, created_by)
    values (p_date, nullif(btrim(p_reason), ''), p_actor_id)
    on conflict (date) do update
      set reason = excluded.reason, created_by = excluded.created_by;
  else
    delete from public.blocked_dates where date = p_date;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.expire_pending_bookings() from public, anon, authenticated;
revoke all on function public.create_pending_booking(text, text, text, integer, date, date, text) from public, anon, authenticated;
revoke all on function public.admin_transition_booking(uuid, uuid, text, date, date, integer) from public, anon, authenticated;
revoke all on function public.admin_set_blocked_date(uuid, date, text, boolean) from public, anon, authenticated;
grant execute on function public.expire_pending_bookings() to service_role;
grant execute on function public.create_pending_booking(text, text, text, integer, date, date, text) to service_role;
grant execute on function public.admin_transition_booking(uuid, uuid, text, date, date, integer) to service_role;
grant execute on function public.admin_set_blocked_date(uuid, date, text, boolean) to service_role;
