-- Keep audit-log lookups by admin actor efficient as the history grows.

create index if not exists booking_audit_log_actor_created_idx
  on public.booking_audit_log (actor_id, created_at desc);
