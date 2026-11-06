"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import BookingCalendar from "@/components/BookingCalendar";
import { createBooking, type CreateBookingResponse } from "@/lib/booking-api";
import { calculateTotal, formatDateRange, type DateRange } from "@/lib/booking";

const FORM_ENDPOINT = "https://formspree.io/f/mnpnnkbd";

type SuccessState =
  | { mode: "pending"; booking: CreateBookingResponse; formspreeFailed: boolean }
  | { mode: "fallback"; formspreeFailed: false };

function isUnavailableError(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  return status === undefined || status >= 500;
}

export default function BookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [formError, setFormError] = useState("");
  const [availabilityState, setAvailabilityState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [dateRange, setDateRange] = useState<DateRange>({ checkIn: "", checkOut: "" });
  const [fallbackDates, setFallbackDates] = useState("");
  const [estimatedTotal, setEstimatedTotal] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!success) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSuccess(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [success]);

  const handleAvailabilityState = useCallback((state: "loading" | "ready" | "unavailable") => {
    setAvailabilityState(state);
  }, []);

  const handleRangeChange = useCallback((checkIn: string, checkOut: string) => {
    setDateRange({ checkIn, checkOut });
    setEstimatedTotal(checkIn && checkOut ? calculateTotal(checkIn, checkOut) : 0);
    setFormError("");
  }, []);

  const submitToFormspree = async (form: HTMLFormElement) => {
    const response = await fetch(FORM_ENDPOINT, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("The Gmail notification could not be sent.");
    }
  };

  const resetFormState = (form: HTMLFormElement) => {
    form.reset();
    setDateRange({ checkIn: "", checkOut: "" });
    setFallbackDates("");
    setEstimatedTotal(0);
    setAvailabilityState("loading");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const guestCount = Number(formData.get("guests"));

    if (availabilityState === "loading") {
      setFormError("Availability must be verified before sending a booking request.");
      return;
    }

    if (availabilityState === "ready" && (!dateRange.checkIn || !dateRange.checkOut)) {
      setFormError("Choose a check-in and check-out date first.");
      return;
    }

    if (availabilityState === "unavailable" && !fallbackDates.trim()) {
      setFormError("Enter your preferred dates so we can follow up by email.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    let booking: CreateBookingResponse | null = null;
    let bookingError: unknown = null;

    if (availabilityState === "ready") {
      try {
        booking = await createBooking({
          guestName: String(formData.get("name") || ""),
          guestEmail: String(formData.get("email") || ""),
          contactNumber: String(formData.get("contact_number") || ""),
          guestCount,
          checkIn: dateRange.checkIn,
          checkOut: dateRange.checkOut,
          message: String(formData.get("message") || ""),
          honeypot: String(formData.get("website") || ""),
        });
      } catch (error) {
        bookingError = error;
      }
    }

    if (!booking && bookingError && !isUnavailableError(bookingError)) {
      setFormError(
        bookingError instanceof Error
          ? bookingError.message
          : "Those dates are no longer available. Please choose another stay.",
      );
      setIsSubmitting(false);
      return;
    }

    let formspreeFailed = false;
    try {
      await submitToFormspree(form);
    } catch {
      formspreeFailed = true;
    }

    if (!booking && formspreeFailed) {
      setFormError("We couldn’t save or send your request. Please try again.");
      setIsSubmitting(false);
      return;
    }

    resetFormState(form);
    setSuccess(
      booking
        ? { mode: "pending", booking, formspreeFailed }
        : { mode: "fallback", formspreeFailed: false },
    );
    setIsSubmitting(false);
  };

  return (
    <>
      <form className="booking-form" id="booking-form" method="POST" onSubmit={handleSubmit}>
        <div className="booking-form-grid">
          <div className="form-field">
            <label htmlFor="guest-name">Full name</label>
            <input id="guest-name" name="name" type="text" autoComplete="name" minLength={2} required />
          </div>
          <div className="form-field">
            <label htmlFor="guest-email">Email address</label>
            <input id="guest-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="form-field">
            <label htmlFor="contact-number">Contact number</label>
            <input
              id="contact-number"
              name="contact_number"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="e.g. 09xx xxx xxxx"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="guest-count">Number of guests</label>
            <select id="guest-count" name="guests" defaultValue="4" required>
              <option value="1">1 guest</option>
              <option value="2">2 guests</option>
              <option value="3">3 guests</option>
              <option value="4">4 guests</option>
            </select>
          </div>
          <div className="form-field form-field--full booking-calendar-field">
            <span className="form-field-label">Preferred dates</span>
            <BookingCalendar
              checkIn={dateRange.checkIn}
              checkOut={dateRange.checkOut}
              onRangeChange={handleRangeChange}
              onAvailabilityState={handleAvailabilityState}
            />
            {availabilityState === "unavailable" ? (
              <div className="booking-fallback-dates">
                <label htmlFor="fallback-dates">Preferred dates for email follow-up</label>
                <input
                  id="fallback-dates"
                  name="fallback_dates"
                  type="text"
                  value={fallbackDates}
                  onChange={(event) => setFallbackDates(event.target.value)}
                  placeholder="e.g. 12–14 July 2026"
                  required
                />
                <p>Live availability is temporarily unavailable. We will verify these dates by email.</p>
              </div>
            ) : null}
            <input
              type="hidden"
              name="dates"
              value={dateRange.checkIn && dateRange.checkOut ? formatDateRange(dateRange.checkIn, dateRange.checkOut) : fallbackDates}
            />
            <input type="hidden" name="check_in" value={dateRange.checkIn} />
            <input type="hidden" name="check_out" value={dateRange.checkOut} />
            <input type="hidden" name="estimated_total" value={estimatedTotal || ""} />
            <input type="text" name="website" className="booking-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          </div>
          <div className="form-field form-field--full">
            <label htmlFor="booking-message">Message</label>
            <textarea
              id="booking-message"
              name="message"
              rows={4}
              placeholder="Tell us anything we should know about your stay."
            />
          </div>
        </div>
        {estimatedTotal > 0 ? (
          <div className="booking-total" aria-live="polite">
            <span>Estimated total</span>
            <strong>₱{estimatedTotal.toLocaleString("en-PH")}</strong>
          </div>
        ) : null}
        <button className="button button--dark" type="submit" disabled={isSubmitting || availabilityState === "loading"}>
          {isSubmitting ? "Sending request…" : "Send booking request"}
        </button>
        <p className={`form-note${formError ? " form-note--error" : ""}`} role={formError ? "alert" : undefined}>
          {formError || (availabilityState === "unavailable" ? "Live availability is unavailable; Formspree email fallback remains active." : "Dates are held for 24 hours while your request is pending.")}
        </p>
      </form>

      {success ? (
        <div
          className="booking-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSuccess(null);
          }}
        >
          <div
            className="booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-success-title"
            aria-describedby="booking-success-copy"
          >
            <button
              className="booking-modal-close"
              type="button"
              ref={closeButtonRef}
              aria-label="Close booking confirmation"
              onClick={() => setSuccess(null)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <p className="eyebrow">Request received</p>
            <h2 id="booking-success-title">
              Thank you. <em>Your dates are held.</em>
            </h2>
            <p id="booking-success-copy">
              {success.mode === "pending"
                ? `Your request is pending for ${formatDateRange(success.booking.checkIn, success.booking.checkOut)}.`
                : "Your request was sent to our Gmail inbox through Formspree."}
            </p>
            {success.mode === "pending" ? (
              <div className="booking-confirmation-details">
                <span>Booking reference</span>
                <strong>{success.booking.bookingReference}</strong>
                <span>Estimated total</span>
                <strong>₱{success.booking.totalAmount.toLocaleString("en-PH")}</strong>
              </div>
            ) : null}
            <p className="booking-confirmation-note">
              {success.mode === "pending" && success.booking.emailDeliveryStatus !== "sent"
                ? "Your request was saved. Visitor email confirmation will be available after Resend is configured."
                : success.mode === "pending" && success.formspreeFailed
                  ? "Your request was saved, but the Gmail notification could not be sent."
                  : "We will reply with availability and next steps."}
            </p>
            <button className="button button--dark" type="button" onClick={() => setSuccess(null)}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
