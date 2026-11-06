import { handleOptions, json } from "../_shared/http.ts";
import { createAdminClient, requireAdmin } from "../_shared/supabase.ts";

const statuses = ["pending", "confirmed", "rejected", "cancelled", "expired"] as const;

function isMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

async function getDashboardData(request: Request, admin: ReturnType<typeof createAdminClient>) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || "";
  const status = url.searchParams.get("status") || "all";
  const { data: allBookings, error: allError } = await admin
    .from("bookings")
    .select("*")
    .order("check_in", { ascending: true })
    .limit(500);
  if (allError) throw allError;

  const { data: nights, error: nightsError } = await admin
    .from("booking_nights")
    .select("night, booking_id")
    .limit(10000);
  if (nightsError) throw nightsError;

  const bookings = (allBookings || []).filter((booking) => {
    const matchesMonth = !month || !isMonth(month) || booking.check_in.startsWith(month);
    const matchesStatus = status === "all" || booking.status === status;
    return matchesMonth && matchesStatus;
  });
  const totals = Object.fromEntries(statuses.map((value) => [value, 0])) as Record<(typeof statuses)[number], number>;
  for (const booking of allBookings || []) totals[booking.status as (typeof statuses)[number]] += 1;
  const confirmedIds = new Set((allBookings || []).filter((booking) => booking.status === "confirmed").map((booking) => booking.id));

  return {
    bookings,
    summary: {
      totals,
      confirmedNights: (nights || []).filter((night) => confirmedIds.has(night.booking_id)).length,
      estimatedConfirmedRevenue: (allBookings || [])
        .filter((booking) => booking.status === "confirmed")
        .reduce((total, booking) => total + Number(booking.total_amount), 0),
    },
  };
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;

  try {
    const admin = createAdminClient();
    const auth = await requireAdmin(request, admin);
    if ("error" in auth) return json({ error: auth.error }, auth.status);

    if (request.method === "GET") return json(await getDashboardData(request, admin));
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    const input = (await request.json()) as Record<string, unknown>;
    const action = typeof input.action === "string" ? input.action : "";
    let result;

    if (action === "block" || action === "unblock") {
      if (typeof input.date !== "string") return json({ error: "A date is required." }, 400);
      result = await admin.rpc("admin_set_blocked_date", {
        p_actor_id: auth.user.id,
        p_date: input.date,
        p_reason: typeof input.reason === "string" ? input.reason.trim().slice(0, 240) : null,
        p_should_block: action === "block",
      });
    } else if (["confirm", "reject", "cancel", "edit"].includes(action)) {
      if (typeof input.bookingId !== "string") return json({ error: "A booking is required." }, 400);
      result = await admin.rpc("admin_transition_booking", {
        p_actor_id: auth.user.id,
        p_booking_id: input.bookingId,
        p_action: action,
        p_new_check_in: typeof input.checkIn === "string" ? input.checkIn : null,
        p_new_check_out: typeof input.checkOut === "string" ? input.checkOut : null,
        p_new_guest_count: Number.isInteger(input.guestCount) ? input.guestCount : null,
      });
    } else {
      return json({ error: "Unsupported admin action." }, 400);
    }

    if (result.error) {
      const message = result.error.message || "Admin action failed.";
      const status = /conflict|blocked|unique/i.test(message) ? 409 : 400;
      return json({ error: "admin_action_failed", message }, status);
    }
    if (result.data && result.data.ok === false) {
      return json({ error: result.data.error || "admin_action_failed", message: result.data.message }, 409);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("admin_booking_request_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Admin service is unavailable." }, 503);
  }
});
