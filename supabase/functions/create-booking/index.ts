import { handleOptions, json, escapeHtml } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { validateBooking } from "../_shared/validation.ts";

const attempts = new Map<string, { count: number; startedAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function rateLimitKey(request: Request, email: string) {
  return `${request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown"}:${email}`;
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt > WINDOW_MS) {
    attempts.set(key, { count: 1, startedAt: now });
    return false;
  }
  current.count += 1;
  return current.count > MAX_ATTEMPTS;
}

function emailHtml(booking: Record<string, string | number>) {
  return `
    <h1>Estudio Fresco booking request</h1>
    <p>Your request is pending for 24 hours while we confirm availability.</p>
    <p><strong>Reference:</strong> ${escapeHtml(String(booking.reference))}</p>
    <p><strong>Dates:</strong> ${escapeHtml(String(booking.checkIn))} to ${escapeHtml(String(booking.checkOut))}</p>
    <p><strong>Guests:</strong> ${escapeHtml(String(booking.guestCount))}</p>
    <p><strong>Estimated total:</strong> ₱${Number(booking.total).toLocaleString("en-PH")}</p>
    <p>We will reply with confirmation and next steps.</p>
  `;
}

async function sendVisitorEmail(booking: Record<string, string | number>) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) return "not_configured";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [booking.email],
      subject: `Estudio Fresco request ${booking.reference}`,
      html: emailHtml(booking),
      text: `Your Estudio Fresco request ${booking.reference} is pending. Dates: ${booking.checkIn} to ${booking.checkOut}. Guests: ${booking.guestCount}. Estimated total: ₱${Number(booking.total).toLocaleString("en-PH")}.`,
    }),
  });

  return response.ok ? "sent" : "failed";
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) return optionsResponse;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (typeof input.honeypot === "string" && input.honeypot.trim()) {
    return json({ error: "Request could not be processed." }, 400);
  }

  const validation = validateBooking(input);
  if ("errors" in validation) return json({ error: validation.errors[0], details: validation.errors }, 400);

  if (isRateLimited(rateLimitKey(request, validation.value.guestEmail))) {
    return json({ error: "Too many requests. Please try again later." }, 429);
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("create_pending_booking", {
      p_guest_name: validation.value.guestName,
      p_guest_email: validation.value.guestEmail,
      p_contact_number: validation.value.contactNumber,
      p_guest_count: validation.value.guestCount,
      p_check_in: validation.value.checkIn,
      p_check_out: validation.value.checkOut,
      p_message: validation.value.message || null,
    });

    if (error) throw error;
    if (!data?.ok) {
      const errorCode = data?.error || "booking_unavailable";
      const message =
        errorCode === "blocked_date" || errorCode === "date_conflict"
          ? "Those dates are no longer available. Please choose another stay."
          : "The booking request could not be created.";
      return json({ error: errorCode, message }, 409);
    }

    const booking = {
      id: data.booking_id as string,
      reference: data.booking_reference as string,
      email: validation.value.guestEmail,
      checkIn: validation.value.checkIn,
      checkOut: validation.value.checkOut,
      guestCount: validation.value.guestCount,
      total: Number(data.total_amount),
    };
    const emailDeliveryStatus = await sendVisitorEmail(booking).catch(() => "failed");
    await admin
      .from("bookings")
      .update({ email_delivery_status: emailDeliveryStatus })
      .eq("id", booking.id);

    return json({
      bookingReference: booking.reference,
      status: "pending",
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guestCount: booking.guestCount,
      totalAmount: booking.total,
      pendingExpiresAt: data.pending_expires_at,
      emailDeliveryStatus,
    });
  } catch (error) {
    console.error("booking_creation_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "booking_unavailable", message: "Booking service is unavailable. Please try again." }, 503);
  }
});
