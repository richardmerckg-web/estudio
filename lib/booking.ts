export const WEEKDAY_RATE = 2000;
export const WEEKEND_RATE = 2500;
export const MAX_GUESTS = 4;
export const PENDING_HOLD_HOURS = 24;

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "rejected"
  | "cancelled"
  | "expired";

export type AvailabilityStatus = "available" | "pending" | "booked" | "blocked";

export type AvailabilityDay = {
  date: string;
  status: AvailabilityStatus;
};

export type DateRange = {
  checkIn: string;
  checkOut: string;
};

function dateAtNoon(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toDateString(date: Date) {
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

export function isDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = dateAtNoon(value);
  return !Number.isNaN(parsed.getTime()) && toDateString(parsed) === value;
}

export function todayDateString(now = new Date()) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

export function addDays(dateString: string, amount: number) {
  const date = dateAtNoon(dateString);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDateString(date);
}

export function generateNightDates(checkIn: string, checkOut: string) {
  if (!isDateString(checkIn) || !isDateString(checkOut) || checkOut <= checkIn) {
    return [];
  }

  const nights: string[] = [];
  for (let date = checkIn; date < checkOut; date = addDays(date, 1)) {
    nights.push(date);
  }
  return nights;
}

export function rateForNight(dateString: string) {
  const dayOfWeek = dateAtNoon(dateString).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6 ? WEEKEND_RATE : WEEKDAY_RATE;
}

export function calculateTotal(checkIn: string, checkOut: string) {
  return generateNightDates(checkIn, checkOut).reduce(
    (total, date) => total + rateForNight(date),
    0,
  );
}

export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions) {
  if (!isDateString(dateString)) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(dateAtNoon(dateString));
}

export function formatDateRange(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) {
    return "Choose your dates";
  }

  return `${formatDate(checkIn, { month: "short" })} – ${formatDate(checkOut, {
    month: "short",
  })}`;
}

export function monthKey(dateString: string) {
  return dateString.slice(0, 7);
}

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const end = toDateString(new Date(Date.UTC(year, monthNumber, 1, 12)));
  return { start, end };
}

export function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return toDateString(new Date(Date.UTC(year, monthNumber - 1 + amount, 1, 12))).slice(0, 7);
}

export function dateIsInRange(date: string, range: DateRange) {
  return Boolean(range.checkIn && range.checkOut && date >= range.checkIn && date < range.checkOut);
}

export function rangeIsAvailable(
  checkIn: string,
  checkOut: string,
  availability: Record<string, AvailabilityStatus>,
) {
  const nights = generateNightDates(checkIn, checkOut);
  return nights.length > 0 && nights.every((date) => availability[date] === "available");
}

export function getStatusLabel(status: AvailabilityStatus) {
  return {
    available: "Available",
    pending: "Pending",
    booked: "Booked",
    blocked: "Blocked",
  }[status];
}

export function calendarStatus(status: AvailabilityStatus, isPublicCalendar = false) {
  return isPublicCalendar && status === "pending" ? "available" : status;
}

export function getBookingStatusLabel(status: BookingStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function isPendingExpired(expiresAt: string, now = new Date()) {
  const expiry = new Date(expiresAt);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() <= now.getTime();
}

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["checked_in", "checked_out", "cancelled"],
  checked_in: ["checked_out", "cancelled"],
  checked_out: [],
  rejected: [],
  cancelled: [],
  expired: [],
};
