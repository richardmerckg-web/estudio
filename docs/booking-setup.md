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

The booking migrations are applied to the production `estudio` Supabase project. Keep the migration files in sync with the remote migration history before making further schema changes. The lifecycle migrations add checked-in/checked-out states, direct admin-created confirmed bookings, an admin audit log, and front-desk checkout with early-departure night release.

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

Schedule `expire-pending-bookings` to run regularly with an `x-cron-secret` header. The production project also has an active `pg_cron` job running every 15 minutes. Pending requests expire after 24 hours and are also expired opportunistically during availability and new-booking requests. Pending requests do not occupy dates; only confirmed bookings do.

## Create the first admin

Create the administrator in Supabase Auth, then insert that user’s UUID into `public.admin_users` using the SQL editor or a protected server-side workflow. Do not use editable user metadata for authorization.

The dashboard is available at `/admin`. It has no public signup flow. The admin workspace is organized into Overview, Requests, Front desk, Calendar, and Blocked dates. Admins can review requests, confirm/reject them, create direct confirmed bookings for phone or walk-in guests, edit eligible bookings, block dates, check guests in, and record normal or early checkout. Early checkout updates the reservation's actual checkout date and releases unused future nights; normal checkout preserves the original stay history.

## Resend and Formspree

Formspree remains the primary Gmail notification path for the visitor form. The browser submits the same request to Formspree after the Supabase booking request succeeds. If Supabase is unavailable, the form safely falls back to Formspree. Resend sends the visitor's pending-request email and admin lifecycle notifications when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured; delivery status is stored with the booking.

Enable Supabase Auth's leaked-password protection in the project Auth settings. This is a hosted security setting and is not controlled by the website source.

## Free-plan availability

Supabase Free projects may pause after inactivity. That can make the booking service temporarily unavailable until the project resumes. The website fails closed when availability cannot be verified and never labels unverified dates as available. Free-plan use does not guarantee continuous uptime.
