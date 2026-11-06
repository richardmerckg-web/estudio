import { handleOptions, json } from "../_shared/http.ts";
import { createAdminClient, addDays, parseDateOnly } from "../_shared/supabase.ts";

function rangeDates(start: string, end: string) {
  const dates: string[] = [];
  for (let date = start; date < end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);

  const url = new URL(request.url);
  const start = url.searchParams.get("start") || "";
  const end = url.searchParams.get("end") || "";
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  const dates = startDate && endDate ? rangeDates(start, end) : [];

  if (!startDate || !endDate || end <= start || dates.length > 62) {
    return json({ error: "A valid availability range of up to 62 days is required." }, 400);
  }

  try {
    const admin = createAdminClient();
    const { error: expiryError } = await admin.rpc("expire_pending_bookings");
    if (expiryError) throw expiryError;

    const [{ data: nights, error: nightsError }, { data: blockedDates, error: blockedError }] =
      await Promise.all([
        admin
          .from("booking_nights")
          .select("night, booking_id")
          .gte("night", start)
          .lt("night", end),
        admin.from("blocked_dates").select("date").gte("date", start).lt("date", end),
      ]);

    if (nightsError) throw nightsError;
    if (blockedError) throw blockedError;

    const bookingIds = [...new Set((nights || []).map((night) => night.booking_id))];
    const { data: bookings, error: bookingsError } = bookingIds.length
      ? await admin.from("bookings").select("id, status").in("id", bookingIds)
      : { data: [], error: null };
    if (bookingsError) throw bookingsError;

    const statusByBooking = new Map((bookings || []).map((booking) => [booking.id, booking.status]));
    const blocked = new Set((blockedDates || []).map((row) => row.date));
    const occupied = new Map(
      (nights || []).map((night) => [
        night.night,
        statusByBooking.get(night.booking_id) === "confirmed" ? "booked" : "pending",
      ]),
    );

    return json({
      days: dates.map((date) => ({
        date,
        status: blocked.has(date) ? "blocked" : occupied.get(date) || "available",
      })),
    });
  } catch (error) {
    console.error("availability_lookup_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Availability could not be verified." }, 503);
  }
});
