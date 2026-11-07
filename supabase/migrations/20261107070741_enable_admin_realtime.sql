-- Publish admin-visible booking changes to Supabase Realtime.

alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.booking_nights;
alter publication supabase_realtime add table public.blocked_dates;
