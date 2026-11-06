-- Support front-desk checkout, including early checkout that releases unused nights.

drop function if exists public.admin_transition_booking(uuid, uuid, text, date, date, integer);

create or replace function public.admin_transition_booking(
  p_actor_id uuid,
  p_booking_id uuid,
  p_action text,
  p_new_check_in date default null,
  p_new_check_out date default null,
  p_new_guest_count integer default null,
  p_actual_check_out date default null
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
  v_actual_check_out date;
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

    v_actual_check_out := coalesce(p_actual_check_out, booking.check_out);
    if v_actual_check_out <= booking.check_in or v_actual_check_out > booking.check_out then
      return jsonb_build_object('ok', false, 'error', 'invalid_checkout_date');
    end if;

    if v_actual_check_out < booking.check_out then
      delete from public.booking_nights
      where booking_id = booking.id and night >= v_actual_check_out;

      v_total_amount := (
        select coalesce(sum(case when extract(isodow from stay_date) in (6, 7) then 2500 else 2000 end), 0)
        from generate_series(booking.check_in, v_actual_check_out - 1, interval '1 day') as dates(stay_date)
      );
    else
      v_total_amount := booking.total_amount;
    end if;

    update public.bookings
    set status = 'checked_out', check_out = v_actual_check_out, total_amount = v_total_amount, checked_out_at = now()
    where id = booking.id;
    insert into public.booking_audit_log (booking_id, actor_id, action, from_status, to_status, details)
    values (
      booking.id, p_actor_id, 'check_out', booking.status, 'checked_out',
      jsonb_build_object(
        'original_check_out', booking.check_out,
        'actual_check_out', v_actual_check_out,
        'early_checkout', v_actual_check_out < booking.check_out
      )
    );
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

revoke all on function public.admin_transition_booking(uuid, uuid, text, date, date, integer, date) from public, anon, authenticated;
grant execute on function public.admin_transition_booking(uuid, uuid, text, date, date, integer, date) to service_role;
