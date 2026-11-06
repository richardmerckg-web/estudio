import { handleOptions, json, escapeHtml } from "../_shared/http.ts";
import { createAdminClient, requireAdmin } from "../_shared/supabase.ts";

const statuses = ["pending", "confirmed", "checked_in", "checked_out", "rejected", "cancelled", "expired"] as const;
const notificationEvents = new Set(["confirmed", "rejected", "cancelled", "check_in", "check_out"]);

function isMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function textValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function notificationCopy(event: string) {
  return {
    confirmed: { subject: "Booking confirmed", title: "Your Estudio Fresco booking is confirmed.", message: "We look forward to welcoming you." },
    rejected: { subject: "Booking request update", title: "Your Estudio Fresco request could not be confirmed.", message: "Please reply if you would like to discuss different dates." },
    cancelled: { subject: "Booking cancelled", title: "Your Estudio Fresco booking was cancelled.", message: "Please contact us if you need help with another date." },
    check_in: { subject: "Check-in reminder", title: "Your Estudio Fresco stay has started.", message: "We hope you enjoy your stay." },
    check_out: { subject: "Checkout recorded", title: "Your Estudio Fresco checkout was recorded.", message: "Thank you for staying with us." },
  }[event as "confirmed" | "rejected" | "cancelled" | "check_in" | "check_out"];
}

async function sendBookingEmail(booking: Record<string, unknown>, event: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  const copy = notificationCopy(event);
  const email = typeof booking.guest_email === "string" ? booking.guest_email : "";
  if (!apiKey || !from || !copy || !email) return "not_configured";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `Estudio Fresco: ${copy.subject}`,
      html: `<h1>${escapeHtml(copy.title)}</h1><p>${escapeHtml(copy.message)}</p><p><strong>Reference:</strong> ${escapeHtml(String(booking.booking_reference))}</p><p><strong>Dates:</strong> ${escapeHtml(String(booking.check_in))} to ${escapeHtml(String(booking.check_out))}</p>`,
      text: `${copy.title} ${copy.message} Reference: ${booking.booking_reference}. Dates: ${booking.check_in} to ${booking.check_out}.`,
    }),
  });

  return response.ok ? "sent" : "failed";
}

async function getBooking(admin: ReturnType<typeof createAdminClient>, bookingId: string) {
  const { data, error } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (error) throw error;
  return data;
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

  const bookingIds = (allBookings || []).map((booking) => booking.id);
  const { data: auditEntries, error: auditError } = bookingIds.length
    ? await admin
        .from("booking_audit_log")
        .select("id, booking_id, action, from_status, to_status, details, created_at")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (auditError) throw auditError;

  const auditByBooking = new Map<string, unknown[]>();
  for (const entry of auditEntries || []) {
    const entries = auditByBooking.get(entry.booking_id) || [];
    entries.push(entry);
    auditByBooking.set(entry.booking_id, entries);
  }

  const bookings = (allBookings || [])
    .filter((booking) => {
      const matchesMonth = !month || !isMonth(month) || booking.check_in.startsWith(month);
      const matchesStatus = status === "all" || booking.status === status;
      return matchesMonth && matchesStatus;
    })
    .map((booking) => ({ ...booking, audit_log: auditByBooking.get(booking.id) || [] }));
  const totals = Object.fromEntries(statuses.map((value) => [value, 0])) as Record<(typeof statuses)[number], number>;
  for (const booking of allBookings || []) totals[booking.status as (typeof statuses)[number]] += 1;
  const activeIds = new Set(
    (allBookings || [])
      .filter((booking) => ["confirmed", "checked_in", "checked_out"].includes(booking.status))
      .map((booking) => booking.id),
  );

  return {
    bookings,
    summary: {
      totals,
      confirmedNights: (nights || []).filter((night) => activeIds.has(night.booking_id)).length,
      estimatedConfirmedRevenue: (allBookings || [])
        .filter((booking) => ["confirmed", "checked_in", "checked_out"].includes(booking.status))
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
    let notificationEvent = "";
    let notificationBookingId = "";

    if (action === "create") {
      result = await admin.rpc("admin_create_booking", {
        p_actor_id: auth.user.id,
        p_guest_name: textValue(input.guestName, 120),
        p_guest_email: textValue(input.guestEmail, 254),
        p_contact_number: textValue(input.contactNumber, 30),
        p_guest_count: Number(input.guestCount),
        p_check_in: textValue(input.checkIn, 10),
        p_check_out: textValue(input.checkOut, 10),
        p_message: textValue(input.message, 2000) || null,
      });
      notificationEvent = "confirmed";
      notificationBookingId = result.data?.booking_id || "";
    } else if (action === "block" || action === "unblock") {
      if (typeof input.date !== "string") return json({ error: "A date is required." }, 400);
      result = await admin.rpc("admin_set_blocked_date", {
        p_actor_id: auth.user.id,
        p_date: input.date,
        p_reason: textValue(input.reason, 240) || null,
        p_should_block: action === "block",
      });
    } else if (["confirm", "reject", "cancel", "edit", "check_in", "check_out"].includes(action)) {
      if (typeof input.bookingId !== "string") return json({ error: "A booking is required." }, 400);
      result = await admin.rpc("admin_transition_booking", {
        p_actor_id: auth.user.id,
        p_booking_id: input.bookingId,
        p_action: action,
        p_new_check_in: typeof input.checkIn === "string" ? input.checkIn : null,
        p_new_check_out: typeof input.checkOut === "string" ? input.checkOut : null,
        p_new_guest_count: Number.isInteger(input.guestCount) ? input.guestCount : null,
        p_actual_check_out: typeof input.actualCheckOut === "string" ? input.actualCheckOut : null,
      });
      if (notificationEvents.has(action)) {
        notificationEvent = action;
        notificationBookingId = input.bookingId;
      }
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

    let emailDeliveryStatus: string | undefined;
    if (notificationEvent && notificationBookingId) {
      const booking = await getBooking(admin, notificationBookingId);
      if (booking) {
        emailDeliveryStatus = await sendBookingEmail(booking, notificationEvent).catch(() => "failed");
        await admin.from("bookings").update({ email_delivery_status: emailDeliveryStatus }).eq("id", notificationBookingId);
      }
    }

    return json({
      ok: true,
      ...(result.data?.booking_reference ? { bookingReference: result.data.booking_reference } : {}),
      ...(emailDeliveryStatus ? { emailDeliveryStatus } : {}),
    });
  } catch (error) {
    console.error("admin_booking_request_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Admin service is unavailable." }, 503);
  }
});
