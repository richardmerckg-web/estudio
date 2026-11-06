# Estudio Fresco booking setup

The public site remains a static Next.js export. Booking availability, booking creation, expiry, email delivery, and admin actions run in Supabase Edge Functions.

## Local environment

Keep the existing `.env.local` variable names:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...
```

The publishable Supabase key is safe for browser use. Never add a Supabase secret/service-role key or `RESEND_API_KEY` to a `NEXT_PUBLIC_` variable or browser code.

## Apply the database migration

The migration is intentionally created but not applied by this implementation:

```text
supabase/migrations/20261106064408_booking_system.sql
```

Review it, link the local CLI to the `estudio` project, then apply it through the normal Supabase migration workflow. The migration creates the four booking tables, RLS policies, conflict-safe booking functions, and indexes.

## Deploy Edge Functions

Deploy these functions after the migration is applied:

- `availability`
- `create-booking`
- `expire-pending-bookings`
- `admin-bookings`

Set these Edge Function secrets before deployment:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `PUBLIC_SITE_ORIGIN` (recommended; use the deployed website origin)

Supabase automatically provides the project URL and function API keys. The functions support both the current publishable/secret key environment variables and legacy compatibility variables.

Schedule `expire-pending-bookings` to run regularly with an `x-cron-secret` header. Pending holds are also expired opportunistically during availability and new-booking requests.

## Create the first admin

Create the administrator in Supabase Auth, then insert that user’s UUID into `public.admin_users` using the SQL editor or a protected server-side workflow. Do not use editable user metadata for authorization.

The dashboard is available at `/admin`. It has no public signup flow.

## Resend and Formspree

Formspree remains the primary Gmail notification path for the visitor form. The browser submits the same request to Formspree after the Supabase booking request succeeds. If Supabase is unavailable, the form safely falls back to Formspree. Resend is sent by the `create-booking` Edge Function and its delivery status is stored with the booking.

## Free-plan availability

Supabase Free projects may pause after inactivity. That can make the booking service temporarily unavailable until the project resumes. The website fails closed when availability cannot be verified and never labels unverified dates as available. Free-plan use does not guarantee continuous uptime.
