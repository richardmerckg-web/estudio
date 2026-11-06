"use client";

import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  calendarStatus,
  dateIsInRange,
  formatDate,
  getStatusLabel,
  monthBounds,
  monthKey,
  rangeIsAvailable,
  shiftMonth,
  todayDateString,
  type AvailabilityStatus,
} from "@/lib/booking";
import { fetchAvailability } from "@/lib/booking-api";

type BookingCalendarProps = {
  checkIn: string;
  checkOut: string;
  onRangeChange: (checkIn: string, checkOut: string) => void;
  onAvailabilityReady?: (ready: boolean) => void;
  onAvailabilityState?: (state: "loading" | "ready" | "unavailable") => void;
  readOnly?: boolean;
  title?: string;
};

type CalendarCell = {
  date: string;
  isCurrentMonth: boolean;
};

function buildCalendar(month: string) {
  const { start } = monthBounds(month);
  const firstDay = new Date(`${start}T12:00:00Z`).getUTCDay();
  const cells: CalendarCell[] = [];
  let date = addDays(start, -firstDay);

  for (let index = 0; index < 42; index += 1) {
    cells.push({ date, isCurrentMonth: monthKey(date) === month });
    date = addDays(date, 1);
  }

  return cells;
}

export default function BookingCalendar({
  checkIn,
  checkOut,
  onRangeChange,
  onAvailabilityReady,
  onAvailabilityState,
  readOnly = false,
  title = "Choose your dates",
}: BookingCalendarProps) {
  const today = todayDateString();
  const [month, setMonth] = useState(monthKey(today));
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({});
  const [loadedMonth, setLoadedMonth] = useState("");
  const [failedMonth, setFailedMonth] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const isLoading = loadedMonth !== month && failedMonth !== month;
  const loadError = failedMonth === month ? "Availability could not be verified right now. Please try again shortly." : "";

  useEffect(() => {
    let isMounted = true;
    const { start, end } = monthBounds(month);
    onAvailabilityState?.("loading");

    fetchAvailability(start, end)
      .then((days) => {
        if (!isMounted) return;
        setAvailability((current) => ({
          ...current,
          ...Object.fromEntries(days.map((day) => [day.date, day.status])),
        }));
        setLoadedMonth(month);
        setFailedMonth("");
        onAvailabilityState?.("ready");
        onAvailabilityReady?.(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setFailedMonth(month);
        onAvailabilityState?.("unavailable");
        onAvailabilityReady?.(false);
      });

    return () => {
      isMounted = false;
    };
  }, [month, onAvailabilityReady, onAvailabilityState]);

  const calendarCells = useMemo(() => buildCalendar(month), [month]);
  const isPublicCalendar = !readOnly;
  const selectableAvailability = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(availability).map(([date, status]) => [
          date,
          calendarStatus(status, isPublicCalendar),
        ]),
      ) as Record<string, AvailabilityStatus>,
    [availability, isPublicCalendar],
  );
  const monthLabel = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));

  const handleDayClick = (date: string) => {
    if (readOnly || date < today || selectableAvailability[date] !== "available") {
      return;
    }

    setSelectionError("");

    if (!checkIn || checkOut || date <= checkIn) {
      onRangeChange(date, "");
      return;
    }

    if (!rangeIsAvailable(checkIn, date, selectableAvailability)) {
      setSelectionError("Every night in the selected stay must be available.");
      return;
    }

    onRangeChange(checkIn, date);
  };

  return (
    <div className="booking-calendar" aria-label={title}>
      <div className="calendar-toolbar">
        <div>
          <p className="calendar-title">{title}</p>
          <p className="calendar-selection" aria-live="polite">
            {checkIn && checkOut
              ? `${formatDate(checkIn, { month: "short" })} – ${formatDate(checkOut, {
                  month: "short",
                })}`
              : checkIn
                ? `${formatDate(checkIn, { month: "short" })} selected · choose check-out`
                : "Check-in included · check-out excluded"}
          </p>
        </div>
        <div className="calendar-navigation" aria-label="Calendar navigation">
          <button
            className="calendar-nav-button"
            type="button"
            aria-label="Previous month"
            disabled={month <= monthKey(today)}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <strong>{monthLabel}</strong>
          <button
            className="calendar-nav-button"
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {[
          "Sun",
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
        ].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="calendar-grid" role="grid" aria-label={monthLabel}>
        {calendarCells.map(({ date, isCurrentMonth }) => {
          const rawStatus = availability[date];
          const status = rawStatus ? calendarStatus(rawStatus, isPublicCalendar) : undefined;
          const isPast = date < today;
          const isSelectedStart = date === checkIn;
          const isSelectedEnd = date === checkOut;
          const isSelectedNight = dateIsInRange(date, { checkIn, checkOut });
          const isDisabled =
            readOnly || isPast || status !== "available" || !isCurrentMonth;
          const classNames = [
            "calendar-day",
            !isCurrentMonth ? "calendar-day--outside" : "",
            isPast ? "calendar-day--past" : "",
            status ? `calendar-day--${status}` : "calendar-day--unverified",
            isSelectedStart ? "calendar-day--selected-start" : "",
            isSelectedEnd ? "calendar-day--selected-end" : "",
            isSelectedNight ? "calendar-day--selected-night" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              className={classNames}
              key={date}
              type="button"
              role="gridcell"
              disabled={isDisabled}
              aria-label={`${formatDate(date)}${status ? `, ${getStatusLabel(status)}` : ", availability unverified"}`}
              aria-selected={isSelectedStart || isSelectedEnd || isSelectedNight}
              onClick={() => handleDayClick(date)}
            >
              <span>{Number(date.slice(-2))}</span>
              {isCurrentMonth && status ? <small>{status}</small> : null}
            </button>
          );
        })}
      </div>

      <div className="calendar-legend" aria-label="Availability legend">
        {(isPublicCalendar
          ? (["available", "booked", "blocked"] as AvailabilityStatus[])
          : (["available", "pending", "booked", "blocked"] as AvailabilityStatus[])
        ).map(
          (status) => (
            <span key={status}>
              <i className={`calendar-legend-dot calendar-legend-dot--${status}`} />
              {getStatusLabel(status)}
            </span>
          ),
        )}
      </div>

      {isLoading ? (
        <p className="calendar-status" role="status">
          <LoaderCircle className="calendar-spinner" aria-hidden="true" size={15} /> Checking availability…
        </p>
      ) : null}
      {loadError ? <p className="calendar-status calendar-status--error" role="alert">{loadError}</p> : null}
      {selectionError ? <p className="calendar-status calendar-status--error" role="alert">{selectionError}</p> : null}
    </div>
  );
}
