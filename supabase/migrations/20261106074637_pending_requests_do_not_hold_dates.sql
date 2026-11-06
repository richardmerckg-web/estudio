-- Pending requests are inquiries, not reservations. Only confirmed bookings
-- occupy booking_nights; this lets the admin choose among overlapping requests.

delete from public.booking_nights
where booking_id in (
  select id from public.bookings where status <> 'confirmed'
);

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

  if exists (
    select 1 from public.booking_nights
    where night >= p_check_in and night < p_check_out
  ) then
    return jsonb_build_object('ok', false, 'error', 'date_conflict');
  end if;

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
    if exists (select 1 from public.booking_nights where night >= booking.check_in and night < booking.check_out) then
      return jsonb_build_object('ok', false, 'error', 'date_conflict');
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
    set status = 'confirmed', pending_expires_at = null
    where id = booking.id;

    update public.bookings
    set status = 'rejected', pending_expires_at = null
    where status = 'pending'
      and id <> booking.id
      and check_in < booking.check_out
      and check_out > booking.check_in;

    return jsonb_build_object('ok', true);
  elsif p_action in ('reject', 'cancel') then
    if booking.status not in ('pending', 'confirmed') then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;
    delete from public.booking_nights where booking_id = booking.id;
    update public.bookings
    set status = p_action, pending_expires_at = null
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
