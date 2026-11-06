import type { Session } from "@supabase/supabase-js";
import type { AvailabilityDay, BookingStatus } from "@/lib/booking";
import { getSupabaseConfig, supabase } from "@/lib/supabase";

export type CreateBookingPayload = {
  guestName: string;
  guestEmail: string;
  contactNumber: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  message: string;
  honeypot?: string;
};

export type CreateBookingResponse = {
  bookingReference: string;
  status: "pending";
  checkIn: string;
  checkOut: string;
  guestCount: number;
  totalAmount: number;
  pendingExpiresAt: string;
  emailDeliveryStatus: string;
};

export type AdminBooking = {
  id: string;
  booking_reference: string;
  guest_name: string;
  guest_email: string;
  contact_number: string;
  guest_count: number;
  check_in: string;
  check_out: string;
  message: string | null;
  total_amount: number;
  status: BookingStatus;
  pending_expires_at: string | null;
  email_delivery_status: string;
  confirmed_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  updated_at: string;
  audit_log: BookingAuditEntry[];
};

export type BookingAuditEntry = {
  id: number;
  action: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type AdminSummary = {
  totals: Record<BookingStatus, number>;
  confirmedNights: number;
  estimatedConfirmedRevenue: number;
};

export type AdminResponse = {
  bookings: AdminBooking[];
  summary: AdminSummary;
};

export type AdminAction =
  | { action: "confirm" | "reject" | "cancel" | "check_in" | "check_out"; bookingId: string }
  | {
      action: "edit";
      bookingId: string;
      checkIn: string;
      checkOut: string;
      guestCount: number;
    }
  | {
      action: "create";
      guestName: string;
      guestEmail: string;
      contactNumber: string;
      guestCount: number;
      checkIn: string;
      checkOut: string;
      message: string;
    }
  | { action: "block"; date: string; reason?: string }
  | { action: "unblock"; date: string };

function getFunctionUrl(functionName: string, query = "") {
  const { url } = getSupabaseConfig();
  return `${url}/functions/v1/${functionName}${query}`;
}

function publicHeaders() {
  const { publishableKey } = getSupabaseConfig();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: publishableKey,
  };
}

async function readResponse<T>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    const error = new Error(body.message || body.error || "Request failed.") as Error & {
      status?: number;
      code?: string;
    };
    error.status = response.status;
    error.code = body.error;
    throw error;
  }

  return body;
}

export async function fetchAvailability(start: string, end: string) {
  const response = await fetch(
    getFunctionUrl("availability", `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
    {
      headers: publicHeaders(),
      cache: "no-store",
    },
  );
  const body = await readResponse<{ days: AvailabilityDay[] }>(response);
  return body.days;
}

export async function createBooking(payload: CreateBookingPayload) {
  const response = await fetch(getFunctionUrl("create-booking"), {
    method: "POST",
    headers: publicHeaders(),
    body: JSON.stringify(payload),
  });
  return readResponse<CreateBookingResponse>(response);
}

async function getAdminSession() {
  if (!supabase) {
    throw new Error("Supabase is not configured for this build.");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("Please sign in as an admin.");
  }

  return data.session;
}

export async function fetchAdminData(filters?: { month?: string; status?: string }) {
  const session = await getAdminSession();
  const { publishableKey } = getSupabaseConfig();
  const query = new URLSearchParams();
  if (filters?.month) query.set("month", filters.month);
  if (filters?.status && filters.status !== "all") query.set("status", filters.status);

  const response = await fetch(getFunctionUrl("admin-bookings", `?${query.toString()}`), {
    headers: {
      ...publicHeaders(),
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
    },
    cache: "no-store",
  });

  return readResponse<AdminResponse>(response);
}

export async function performAdminAction(action: AdminAction) {
  const session: Session = await getAdminSession();
  const { publishableKey } = getSupabaseConfig();
  const response = await fetch(getFunctionUrl("admin-bookings"), {
    method: "POST",
    headers: {
      ...publicHeaders(),
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
    },
    body: JSON.stringify(action),
  });

  return readResponse<{ ok: true }>(response);
}
