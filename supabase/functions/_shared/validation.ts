import {
  calculateTotal,
  generateDates,
  localTodayInManila,
  parseDateOnly,
} from "./supabase.ts";

export type ValidatedBooking = {
  guestName: string;
  guestEmail: string;
  contactNumber: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  message: string;
};

export function validateBooking(input: Record<string, unknown>) {
  const guestName = typeof input.guestName === "string" ? input.guestName.trim() : "";
  const guestEmail = typeof input.guestEmail === "string" ? input.guestEmail.trim().toLowerCase() : "";
  const contactNumber = typeof input.contactNumber === "string" ? input.contactNumber.trim() : "";
  const guestCount = Number(input.guestCount);
  const checkIn = typeof input.checkIn === "string" ? input.checkIn : "";
  const checkOut = typeof input.checkOut === "string" ? input.checkOut : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const errors: string[] = [];

  if (guestName.length < 2 || guestName.length > 120) errors.push("Enter a valid full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail) || guestEmail.length > 254) {
    errors.push("Enter a valid email address.");
  }
  if (contactNumber.length < 7 || contactNumber.length > 30 || !/[0-9]/.test(contactNumber)) {
    errors.push("Enter a valid contact number.");
  }
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 4) {
    errors.push("Guest count must be between 1 and 4.");
  }
  if (!parseDateOnly(checkIn) || !parseDateOnly(checkOut) || checkOut <= checkIn) {
    errors.push("Choose a valid check-in and check-out range.");
  }
  if (checkIn < localTodayInManila()) errors.push("Check-in cannot be in the past.");
  if (generateDates(checkIn, checkOut).length > 90) errors.push("Stays can be no longer than 90 nights.");
  if (message.length > 2000) errors.push("Message is too long.");

  if (errors.length > 0) {
    return { errors };
  }

  return {
    value: {
      guestName,
      guestEmail,
      contactNumber,
      guestCount,
      checkIn,
      checkOut,
      message,
      totalAmount: calculateTotal(checkIn, checkOut),
    } satisfies ValidatedBooking & { totalAmount: number },
  };
}
