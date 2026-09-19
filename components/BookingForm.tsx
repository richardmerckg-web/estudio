"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const FORM_ENDPOINT = "https://formspree.io/f/mnpnnkbd";

export default function BookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isSuccessOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSuccessOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSuccessOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    setIsSubmitting(true);
    setFormError("");

    try {
      const response = await fetch(FORM_ENDPOINT, {
        method: "POST",
        body: new FormData(form),
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("We couldn’t send your request. Please try again.");
      }

      form.reset();
      setIsSuccessOpen(true);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "We couldn’t send your request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form className="booking-form" id="booking-form" method="POST" onSubmit={handleSubmit}>
        <div className="booking-form-grid">
          <div className="form-field">
            <label htmlFor="guest-name">Full name</label>
            <input id="guest-name" name="name" type="text" autoComplete="name" required />
          </div>
          <div className="form-field">
            <label htmlFor="guest-email">Email address</label>
            <input id="guest-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="form-field">
            <label htmlFor="preferred-dates">Preferred dates</label>
            <input
              id="preferred-dates"
              name="dates"
              type="text"
              placeholder="e.g. 12–14 July 2026"
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
        <button className="button button--dark" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending request…" : "Send booking request"}
        </button>
        <p className={`form-note${formError ? " form-note--error" : ""}`} role={formError ? "alert" : undefined}>
          {formError || "We will reply with availability and next steps."}
        </p>
      </form>

      {isSuccessOpen ? (
        <div
          className="booking-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsSuccessOpen(false);
            }
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
              onClick={() => setIsSuccessOpen(false)}
            >
              <span aria-hidden="true">X</span>
            </button>
            <p className="eyebrow">Request received</p>
            <h2 id="booking-success-title">
              Thank you. <em>We’ll be in touch.</em>
            </h2>
            <p id="booking-success-copy">
              Your booking request has been sent. We will reply with availability and next steps.
            </p>
            <button className="button button--dark" type="button" onClick={() => setIsSuccessOpen(false)}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
