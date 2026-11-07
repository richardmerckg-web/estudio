"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarDays, ClipboardList, Eye, EyeOff, History, LayoutDashboard, LoaderCircle, LogOut, Menu, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import BookingCalendar from "@/components/BookingCalendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addDays,
  formatDate,
  formatDateRange,
  getStatusLabel,
  getBookingStatusLabel,
  monthKey,
  todayDateString,
  type AvailabilityStatus,
  type BookingStatus,
} from "@/lib/booking";
import {
  fetchAdminData,
  performAdminAction,
  type AdminBooking,
  type AdminResponse,
} from "@/lib/booking-api";
import { supabase } from "@/lib/supabase";

const recordsStatusOptions: Array<BookingStatus | "all"> = [
  "all",
  "confirmed",
  "checked_in",
  "checked_out",
  "rejected",
  "cancelled",
  "expired",
];

type AdminView = "overview" | "requests" | "front_desk" | "history" | "calendar";

const adminNavItems: Array<{ id: AdminView; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "requests", label: "Requests", icon: ClipboardList },
  { id: "front_desk", label: "Check-in & checkout", icon: BedDouble },
  { id: "history", label: "Records", icon: History },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

const adminViewMeta: Record<AdminView, { title: string; description: string }> = {
  overview: { title: "Booking overview", description: "Current requests, stays, and availability." },
  requests: { title: "Requests", description: "Review visitor-submitted bookings." },
  front_desk: { title: "Check-in & checkout", description: "Manage guest check-ins and checkouts." },
  history: { title: "Booking records", description: "Review confirmed, active, and closed stays." },
  calendar: { title: "Calendar", description: "Review availability and manage blocked dates." },
};

function money(value: number) {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function bookingMessagePreview(message: string | null) {
  const trimmed = message?.trim() || "";
  if (trimmed.length <= 72) return trimmed;
  return `${trimmed.slice(0, 69).trimEnd()}…`;
}

function bookingMessageLabel(message: string | null) {
  const preview = bookingMessagePreview(message);
  return preview ? `Message: ${preview}` : "No message";
}

export default function AdminDashboard() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(supabase ? "" : "Supabase is not configured for this build.");
  const [currentMonth, setCurrentMonth] = useState(() => monthKey(todayDateString()));
  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [month, setMonth] = useState(monthKey(todayDateString()));
  const [recordsMonth, setRecordsMonth] = useState(monthKey(todayDateString()));
  const [status, setStatus] = useState("all");
  const [recordSearch, setRecordSearch] = useState("");
  const [frontDeskTab, setFrontDeskTab] = useState<"check_in" | "check_out">("check_in");
  const [dashboard, setDashboard] = useState<AdminResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [blockedDate, setBlockedDate] = useState("");
  const [blockedDateStatus, setBlockedDateStatus] = useState<AvailabilityStatus | "">("");
  const [blockError, setBlockError] = useState("");
  const [editDates, setEditDates] = useState({ checkIn: "", checkOut: "", guestCount: 1 });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState<AdminBooking | null>(null);
  const [checkoutDate, setCheckoutDate] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    guestName: "",
    guestEmail: "",
    contactNumber: "",
    guestCount: 1,
    checkIn: "",
    checkOut: "",
    message: "",
  });

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email || null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSessionEmail(nextSession?.user.email || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const refreshCurrentMonth = () => setCurrentMonth(monthKey(todayDateString()));
    const timer = window.setInterval(refreshCurrentMonth, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    const handleResize = () => {
      if (!window.matchMedia("(max-width: 900px)").matches) setMobileSidebarOpen(false);
    };

    if (window.matchMedia("(max-width: 900px)").matches) document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileSidebarOpen]);

  const loadDashboard = useCallback(async () => {
    if (!sessionEmail) return;
    setIsLoading(true);
    setDashboardError("");
    try {
      const apiStatus = activeView === "requests" ? "pending" : status;
      const filterMonth = activeView === "overview" ? currentMonth : activeView === "front_desk" ? "" : activeView === "history" ? recordsMonth : month;
      setDashboard(await fetchAdminData({ month: filterMonth, status: apiStatus }));
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load the dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [activeView, currentMonth, month, recordsMonth, sessionEmail, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    const client = supabase;
    if (!client || !sessionEmail) return;

    const channel = client
      .channel("admin-booking-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => void loadDashboard(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_nights" },
        () => {
          setCalendarRefreshKey((value) => value + 1);
          void loadDashboard();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blocked_dates" },
        () => setCalendarRefreshKey((value) => value + 1),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [loadDashboard, sessionEmail]);

  const filteredConfirmedRevenue = useMemo(
    () =>
      dashboard?.bookings
        .filter((booking) => ["confirmed", "checked_in", "checked_out"].includes(booking.status))
        .reduce((total, booking) => total + Number(booking.total_amount), 0) || 0,
    [dashboard],
  );

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setDashboard(null);
  };

  const runAction = async (action: Parameters<typeof performAdminAction>[0]) => {
    setActionLoading(true);
    setActionError("");
    try {
      await performAdminAction(action);
      setSelectedBooking(null);
      setCalendarRefreshKey((value) => value + 1);
      await loadDashboard();
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action could not be completed.");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const createBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    try {
      await performAdminAction({ action: "create", ...createForm });
      setCreateDialogOpen(false);
      setCreateForm({ guestName: "", guestEmail: "", contactNumber: "", guestCount: 1, checkIn: "", checkOut: "", message: "" });
      setCalendarRefreshKey((value) => value + 1);
      await loadDashboard();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Booking could not be created.");
    } finally {
      setCreateLoading(false);
    }
  };

  const navigateTo = (view: AdminView, nextStatus?: string) => {
    setActiveView(view);
    setMobileSidebarOpen(false);
    setStatus(nextStatus || (view === "requests" ? "pending" : "all"));
    if (view === "front_desk") {
      setFrontDeskTab("check_in");
    }
  };

  const openBooking = (booking: AdminBooking) => {
    setSelectedBooking(booking);
    setActionError("");
    setEditDates({
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      guestCount: booking.guest_count,
    });
  };

  const openCheckout = (booking: AdminBooking) => {
    setCheckoutBooking(booking);
    setCheckoutDate(booking.check_out);
    setCheckoutError("");
  };

  const selectBlockedDate = (date: string, status: AvailabilityStatus) => {
    setBlockedDate(date);
    setBlockedDateStatus(status);
    setBlockError("");
  };

  const completeCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkoutBooking) return;
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      await performAdminAction({ action: "check_out", bookingId: checkoutBooking.id, actualCheckOut: checkoutDate });
      setCheckoutBooking(null);
      setActiveView("history");
      setStatus("all");
      setCalendarRefreshKey((value) => value + 1);
      await loadDashboard();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Checkout could not be completed.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const blockDate = async (shouldBlock: boolean) => {
    if (!blockedDate) {
      setBlockError("Choose a date first.");
      return;
    }
    if (shouldBlock && blockedDateStatus === "booked") {
      setBlockError("Booked nights cannot be blocked.");
      return;
    }
    setBlockError("");
    const succeeded = await runAction(
      shouldBlock
        ? { action: "block", date: blockedDate }
        : { action: "unblock", date: blockedDate },
    );
    if (succeeded) {
      setBlockedDateStatus(shouldBlock ? "blocked" : "available");
      setBlockError("");
    } else {
      setBlockError("Date action failed.");
    }
  };

  if (authLoading) {
    return (
      <main className="admin-page">
        <div className="admin-operation-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="admin-operation-dialog"><LoaderCircle className="admin-operation-spinner" size={22} aria-hidden="true" /><strong>Loading admin access…</strong><span>Please wait while the admin session is checked.</span></div>
        </div>
      </main>
    );
  }

  if (!sessionEmail) {
    return (
      <main className="admin-page admin-page--login">
        <Card className="admin-login-card">
          <CardHeader>
            <CardTitle>Estudio Fresco bookings</CardTitle>
            <p className="admin-muted">Sign in with the Supabase Auth account listed in the admin allowlist.</p>
          </CardHeader>
          <CardContent>
            <form className="admin-login-form" onSubmit={signIn}>
              <label>
                Email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label>
                Password
                <span className="admin-password-field">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required />
                  <button
                    className="admin-password-toggle"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </span>
              </label>
              {authError ? <p className="admin-error" role="alert">{authError}</p> : null}
              <Button type="submit">Sign in</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const summary = dashboard?.summary;
  const viewMeta = adminViewMeta[activeView];
  const pendingBookings = dashboard?.bookings.filter((booking) => booking.status === "pending") || [];
  const requestBookings = dashboard?.bookings.filter((booking) => booking.status === "pending") || [];
  const upcomingBookings = dashboard?.bookings
    .filter((booking) => ["confirmed", "checked_in"].includes(booking.status))
    .slice(0, 5) || [];
  const frontDeskBookings = dashboard?.bookings
    .filter((booking) => ["confirmed", "checked_in"].includes(booking.status))
    .sort((first, second) => first.check_in.localeCompare(second.check_in)) || [];
  const checkInBookings = frontDeskBookings.filter((booking) => booking.status === "confirmed");
  const checkOutBookings = frontDeskBookings.filter((booking) => booking.status === "checked_in");
  const roomOccupied = checkOutBookings.length > 0;
  const frontDeskList = frontDeskTab === "check_in" ? checkInBookings : checkOutBookings;
  const historyBookings = dashboard?.bookings
    .filter((booking) => booking.status !== "pending")
    .slice()
    .sort((first, second) => second.created_at.localeCompare(first.created_at)) || [];
  const normalizedRecordSearch = recordSearch.trim().toLowerCase();
  const filteredHistoryBookings = normalizedRecordSearch
    ? historyBookings.filter((booking) => [booking.guest_name, booking.booking_reference, booking.guest_email, booking.contact_number, booking.message || ""].some((value) => value.toLowerCase().includes(normalizedRecordSearch)))
    : historyBookings;
  const canEditSelectedBooking = Boolean(selectedBooking && ["pending", "confirmed"].includes(selectedBooking.status));
  const operationMessage = checkoutLoading
    ? "Recording checkout…"
    : createLoading
      ? "Creating booking…"
      : actionLoading
        ? "Saving booking changes…"
        : isLoading
          ? activeView === "front_desk" ? "Loading check-in and checkout…" : "Loading bookings…"
        : "";

  return (
    <main className="admin-page">
      <div className="admin-workspace">
        <aside id="admin-navigation" className={`admin-sidebar${mobileSidebarOpen ? " admin-sidebar--open" : ""}`} aria-label="Admin navigation">
          <div className="admin-sidebar-brand">
            <div>
              <strong>Estudio Fresco</strong>
              <span>Booking admin</span>
            </div>
            <button type="button" className="admin-sidebar-close" aria-label="Close admin navigation" onClick={() => setMobileSidebarOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <nav className="admin-sidebar-nav">
            {adminNavItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`admin-nav-button ${activeView === id ? "admin-nav-button--active" : ""}`.trim()}
                aria-current={activeView === id ? "page" : undefined}
                onClick={() => navigateTo(id)}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span><strong>{label}</strong></span>
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <div className="admin-user-chip">
              <div className="admin-user-avatar" aria-hidden="true">{sessionEmail?.slice(0, 1).toUpperCase()}</div>
              <div><span>Signed in as</span><strong>{sessionEmail}</strong></div>
            </div>
            <Button variant="ghost" className="admin-signout-button" onClick={() => void signOut()}>
              <LogOut size={16} aria-hidden="true" /> Sign out
            </Button>
          </div>
        </aside>
        {mobileSidebarOpen ? <button type="button" className="admin-sidebar-backdrop" aria-label="Close admin navigation" onClick={() => setMobileSidebarOpen(false)} /> : null}

        <div className="admin-main">
          <div className="admin-mobile-toolbar">
            <div>
              <strong>Estudio Fresco</strong>
              <span>Booking admin</span>
            </div>
            <button type="button" className="admin-mobile-menu" aria-label="Open admin navigation" aria-expanded={mobileSidebarOpen} aria-controls="admin-navigation" onClick={() => setMobileSidebarOpen(true)}>
              <Menu size={19} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <header className="admin-header">
            <div>
              <h1>{viewMeta.title}</h1>
              <p className="admin-muted">{viewMeta.description}</p>
            </div>
            <div className="admin-header-actions">
              {activeView === "history" ? (
                <div className="admin-header-count-wrap" aria-label={`Total bookings: ${historyBookings.length} in ${recordsMonth ? formatDate(`${recordsMonth}-01`, { month: "long", year: "numeric" }) : "all months"}`} aria-live="polite">
                  <span className="admin-header-count-label">Total Bookings:</span>
                  <div className="admin-header-count">
                    <strong>{historyBookings.length}</strong>
                  </div>
                </div>
              ) : null}
              {activeView === "requests" ? (
                <div className="admin-filters admin-header-filter"><label>Check-in month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></div>
              ) : null}
              {activeView === "front_desk" ? (
                <Button onClick={() => { setCreateError(""); setCreateDialogOpen(true); }}>
                  <Plus size={16} aria-hidden="true" /> New booking
                </Button>
              ) : null}
            </div>
          </header>

          {dashboardError ? <p className="admin-error" role="alert">{dashboardError}</p> : null}

          {activeView === "overview" ? (
            <section className="admin-view-section" aria-labelledby="overview-heading">
              <h2 className="sr-only" id="overview-heading">Booking overview summary</h2>
              <div className="admin-summary-grid">
                <Card><CardContent><span className="admin-stat-label">Bookings this month</span><strong>{dashboard?.bookings.length ?? 0}</strong><small>All statuses by current check-in month</small></CardContent></Card>
                <Card><CardContent><span className="admin-stat-label">Confirmed revenue</span><strong>{money(filteredConfirmedRevenue)}</strong><small>Current check-in month</small></CardContent></Card>
                <Card><CardContent><span className="admin-stat-label">Confirmed nights</span><strong>{summary?.confirmedNights ?? 0}</strong><small>Active and completed stays</small></CardContent></Card>
                <Card><CardContent><span className="admin-stat-label">Pending</span><strong>{summary?.totals.pending ?? 0}</strong><small>Requests awaiting decision</small></CardContent></Card>
              </div>
              <div className="admin-overview-grid">
                <Card className="admin-calendar-card">
                  <CardHeader><div className="admin-card-heading-row"><div><CardTitle>Availability at a glance</CardTitle><p className="admin-muted">Private booking details stay in the Requests view.</p></div><Button variant="ghost" onClick={() => navigateTo("calendar")}>Open calendar</Button></div></CardHeader>
                  <CardContent><BookingCalendar checkIn="" checkOut="" onRangeChange={() => undefined} readOnly refreshKey={calendarRefreshKey} /></CardContent>
                </Card>
                <Card className="admin-attention-card">
                  <CardHeader><CardTitle>Needs attention</CardTitle><p className="admin-muted">Requests waiting for an admin decision.</p></CardHeader>
                  <CardContent>
                    {pendingBookings.length ? <div className="admin-attention-list">{pendingBookings.slice(0, 4).map((booking) => <button key={booking.id} type="button" onClick={() => openBooking(booking)}><span><strong>{booking.guest_name}</strong><small>{formatDateRange(booking.check_in, booking.check_out)}</small></span><Badge variant="pending">Pending</Badge></button>)}</div> : <p className="admin-empty">No pending requests right now.</p>}
                    <Button className="admin-full-width-button" variant="secondary" onClick={() => navigateTo("requests", "pending")}>View pending requests</Button>
                  </CardContent>
                </Card>
              </div>
              <Card className="admin-table-card">
                <CardHeader><div className="admin-card-heading-row"><div><CardTitle>Upcoming stays</CardTitle><p className="admin-muted">Confirmed stays in the selected month.</p></div><Button variant="ghost" onClick={() => navigateTo("front_desk")}>Open check-in & checkout</Button></div></CardHeader>
                <CardContent>
                  {upcomingBookings.length ? <div className="admin-upcoming-list">{upcomingBookings.map((booking) => <button key={booking.id} type="button" onClick={() => openBooking(booking)}><span><strong>{booking.guest_name}</strong><small>{formatDateRange(booking.check_in, booking.check_out)} · {booking.booking_reference}</small></span><Badge variant={booking.status}>{getBookingStatusLabel(booking.status)}</Badge></button>)}</div> : <p className="admin-empty">No upcoming confirmed stays in this month.</p>}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {activeView === "requests" ? (
            <section className="admin-view-section" aria-label="Booking requests">
              <section className="admin-data-panel admin-data-panel--flush" aria-label="Booking request list">
                <div>
                  {!isLoading && requestBookings.length === 0 ? <p className="admin-empty">No booking requests match these filters.</p> : null}
                  {requestBookings.length ? <div className="admin-booking-card-list" aria-label="Booking request cards">{requestBookings.map((booking) => <article className="admin-booking-card" key={booking.id}><div className="admin-booking-card-identity"><strong>{booking.guest_name}</strong><span>{booking.booking_reference}</span><Badge variant={booking.status}>{getBookingStatusLabel(booking.status)}</Badge></div><div className="admin-booking-card-summary"><span>{formatDateRange(booking.check_in, booking.check_out)}</span><span>{booking.guest_count} guest{booking.guest_count === 1 ? "" : "s"}</span><span className={`admin-booking-card-message${booking.message?.trim() ? "" : " admin-booking-card-message--empty"}`} title={booking.message?.trim() || "No message provided"}>{bookingMessageLabel(booking.message)}</span></div><Button variant="secondary" onClick={() => openBooking(booking)}>View details</Button></article>)}</div> : null}
                </div>
              </section>
            </section>
          ) : null}

          {activeView === "front_desk" ? (
            <section className="admin-view-section" aria-labelledby="front-desk-heading">
              <h2 className="sr-only" id="front-desk-heading">Check-in and checkout operations</h2>
              <div className="admin-stay-tabs admin-front-desk-tabs" role="tablist" aria-label="Check-in and checkout work queue">
                <button type="button" role="tab" aria-selected={frontDeskTab === "check_in"} className={`admin-stay-tab ${frontDeskTab === "check_in" ? "admin-stay-tab--active" : ""}`.trim()} onClick={() => setFrontDeskTab("check_in")}>Check{"\u00a0"}in <span>{checkInBookings.length}</span></button>
                <button type="button" role="tab" aria-selected={frontDeskTab === "check_out"} className={`admin-stay-tab ${frontDeskTab === "check_out" ? "admin-stay-tab--active" : ""}`.trim()} onClick={() => setFrontDeskTab("check_out")}>Check{"\u00a0"}out <span>{checkOutBookings.length}</span></button>
              </div>
              <div className="admin-front-desk-layout">
                <section className="admin-data-panel admin-front-desk-primary-card" aria-labelledby="front-desk-queue-heading">
                  <div className="admin-data-panel-heading"><div><h2 id="front-desk-queue-heading">{frontDeskTab === "check_in" ? "Confirmed guests" : "Guest currently checked in"}</h2><p className="admin-muted">{frontDeskTab === "check_in" ? "All confirmed bookings and admin-added stays available for check-in." : "The room is occupied until this guest is checked out."}</p></div></div>
                  {frontDeskTab === "check_in" && roomOccupied ? <div className="admin-room-occupied" role="status"><strong>Room occupied</strong><span>Check out the current guest before checking in another stay.</span><button type="button" onClick={() => setFrontDeskTab("check_out")}>Open check out</button></div> : null}
                  <div>
                    {frontDeskList.length ? <div className="admin-guest-list">{frontDeskList.map((booking) => <article className="admin-guest-card" key={booking.id}><div className="admin-guest-card-identity"><strong>{booking.guest_name}</strong><span>{booking.booking_reference}</span></div><div className="admin-guest-card-summary"><span>{formatDateRange(booking.check_in, booking.check_out)}</span><span>{booking.guest_count} guest{booking.guest_count === 1 ? "" : "s"}</span><span className={`admin-booking-card-message${booking.message?.trim() ? "" : " admin-booking-card-message--empty"}`} title={booking.message?.trim() || "No message provided"}>{bookingMessageLabel(booking.message)}</span></div><div className="admin-guest-card-actions"><Button variant="ghost" onClick={() => openBooking(booking)}>View details</Button>{frontDeskTab === "check_in" ? <Button variant="secondary" disabled={roomOccupied} onClick={async () => { const succeeded = await runAction({ action: "check_in", bookingId: booking.id }); if (succeeded) setFrontDeskTab("check_out"); }}>{roomOccupied ? "Room occupied" : "Check in"}</Button> : <Button onClick={() => void openCheckout(booking)}>Check out</Button>}</div></article>)}</div> : <p className="admin-empty">{frontDeskTab === "check_in" ? "No confirmed bookings found." : "No guest is currently checked in."}</p>}
                  </div>
                </section>
              </div>
            </section>
          ) : null}

          {activeView === "history" ? (
            <section className="admin-view-section" aria-label="Booking history">
              <div className="admin-record-toolbar">
                <div className="admin-filters admin-record-search"><label>Search records<div className="admin-record-search-control"><input type="search" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Guest, reference, email, or phone" autoComplete="off" />{recordSearch ? <button type="button" className="admin-record-search-clear" aria-label="Clear search" title="Clear search" onClick={() => setRecordSearch("")}><X size={12} strokeWidth={1.6} aria-hidden="true" /></button> : null}</div></label></div>
                <div className="admin-filters admin-record-filter-controls"><label>Check-in month<div className="admin-month-picker"><input type="month" value={recordsMonth} onChange={(event) => setRecordsMonth(event.target.value)} aria-label="Select check-in month" /><button type="button" className="admin-month-picker-toggle" onClick={() => setRecordsMonth(recordsMonth ? "" : monthKey(todayDateString()))}>{recordsMonth ? "All months" : "Current month"}</button></div></label><label>Booking status<select value={status} onChange={(event) => setStatus(event.target.value)}>{recordsStatusOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All statuses" : getBookingStatusLabel(option)}</option>)}</select></label></div>
              </div>
              <section className="admin-data-panel admin-data-panel--flush" aria-label="Booking history cards">
                <div>
                  {filteredHistoryBookings.length ? <div className="admin-booking-card-list">{filteredHistoryBookings.map((booking) => <article className="admin-booking-card" key={booking.id}><div className="admin-booking-card-identity"><strong>{booking.guest_name}</strong><span>{booking.booking_reference}</span><Badge variant={booking.status}>{getBookingStatusLabel(booking.status)}</Badge></div><div className="admin-booking-card-summary"><span>{formatDateRange(booking.check_in, booking.check_out)}</span><span>{booking.guest_count} guest{booking.guest_count === 1 ? "" : "s"}</span></div><Button variant="secondary" onClick={() => openBooking(booking)}>View details</Button></article>)}</div> : <p className="admin-empty">{normalizedRecordSearch ? "No booking records match your search." : "No booking records found."}</p>}
                </div>
              </section>
            </section>
          ) : null}

          {activeView === "calendar" ? (
            <section className="admin-view-section" aria-label="Availability calendar content">
              <div className="admin-content-grid">
                <div className="admin-calendar-section"><BookingCalendar checkIn="" checkOut="" onRangeChange={() => undefined} onDateSelect={selectBlockedDate} selectedDate={blockedDate} selectionLabel={blockedDate ? `${formatDate(blockedDate, { month: "short", day: "numeric" })} selected` : "Select a future date to manage"} title="Manage blocked dates" readOnly refreshKey={calendarRefreshKey} /></div>
                <div className="admin-calendar-side">
                  <section className="admin-data-panel admin-block-panel" aria-labelledby="blocked-heading">
                    <div className="admin-data-panel-heading"><div><h2 id="blocked-heading">Manage blocked dates</h2><p className="admin-muted">Select a future date on the calendar to block or unblock it.</p></div></div>
                    <div className="admin-block-form">
                      <div className="admin-block-selection" role="status" aria-live="polite">
                        <div><span>Selected date</span><strong>{blockedDate ? formatDate(blockedDate, { month: "long", day: "numeric", year: "numeric" }) : "None"}</strong></div>
                        <div><span>Status</span><strong>{blockedDateStatus ? getStatusLabel(blockedDateStatus) : blockedDate ? "Select it on the calendar to verify" : "Not selected"}</strong></div>
                      </div>
                      <label>Date<input type="date" value={blockedDate} min={todayDateString()} onClick={(event) => { event.currentTarget.showPicker?.(); }} onChange={(event) => { setBlockedDate(event.target.value); setBlockedDateStatus(""); setBlockError(""); }} /></label>
                      {blockError ? <p className="admin-error" role="alert">{blockError}</p> : null}
                      <div className="admin-inline-actions"><Button disabled={!blockedDate || blockedDateStatus === "booked"} onClick={() => void blockDate(true)}>Block selected date</Button>{blockedDateStatus === "blocked" ? <Button variant="secondary" onClick={() => void blockDate(false)}>Unblock selected date</Button> : null}</div>
                    </div>
                  </section>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {operationMessage ? (
        <div className="admin-operation-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="admin-operation-dialog"><LoaderCircle className="admin-operation-spinner" size={22} aria-hidden="true" /><strong>{operationMessage}</strong><span>Please wait while the booking record is updated.</span></div>
        </div>
      ) : null}

      <Dialog open={Boolean(selectedBooking)} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="ui-dialog-content admin-modal admin-booking-details-modal">
          {selectedBooking ? (
            <>
              <div className="admin-modal-header">
                <div>
                  <p className="admin-modal-kicker">Booking details</p>
                  <DialogTitle>{selectedBooking.booking_reference}</DialogTitle>
                  <DialogDescription>Guest, stay, and available actions.</DialogDescription>
                </div>
                <Badge variant={selectedBooking.status}>{getBookingStatusLabel(selectedBooking.status)}</Badge>
              </div>
              <section className="admin-modal-section" aria-labelledby="guest-information-heading">
                <div className="admin-modal-section-heading"><h3 id="guest-information-heading">Guest information</h3></div>
                <div className="admin-detail-grid">
                  <div className="admin-detail-item"><span>Guest</span><strong>{selectedBooking.guest_name}</strong></div>
                  <div className="admin-detail-item"><span>Guests</span><strong>{selectedBooking.guest_count}</strong></div>
                  <div className="admin-detail-item"><span>Email</span><a href={`mailto:${selectedBooking.guest_email}`}>{selectedBooking.guest_email}</a></div>
                  <div className="admin-detail-item"><span>Phone</span><a href={`tel:${selectedBooking.contact_number}`}>{selectedBooking.contact_number}</a></div>
                </div>
              </section>
              <section className="admin-modal-section" aria-labelledby="stay-summary-heading">
                <div className="admin-modal-section-heading"><h3 id="stay-summary-heading">Stay summary</h3></div>
                <div className="admin-detail-grid">
                  <div className="admin-detail-item"><span>Dates</span><strong>{formatDateRange(selectedBooking.check_in, selectedBooking.check_out)}</strong></div>
                  <div className="admin-detail-item"><span>Total</span><strong>{money(Number(selectedBooking.total_amount))}</strong></div>
                </div>
              </section>
              <section className="admin-modal-section admin-message-section" aria-labelledby="guest-message-heading"><div className="admin-modal-section-heading"><h3 id="guest-message-heading">Guest message</h3></div>{selectedBooking.message?.trim() ? <p>{selectedBooking.message}</p> : <p className="admin-message-empty">No message provided.</p>}</section>
              {canEditSelectedBooking ? (
                <section className="admin-modal-section admin-edit-section" aria-labelledby="edit-booking-heading">
                  <div className="admin-modal-section-heading"><div><h3 id="edit-booking-heading">Edit booking</h3><p>Adjust the stay details while the booking is pending or confirmed.</p></div></div>
                  <div className="admin-edit-fields">
                    <label>Check-in<input disabled={actionLoading} type="date" min={todayDateString()} value={editDates.checkIn} onChange={(event) => setEditDates((current) => ({ ...current, checkIn: event.target.value }))} /></label>
                    <label>Check-out<input disabled={actionLoading} type="date" min={editDates.checkIn ? addDays(editDates.checkIn, 1) : addDays(todayDateString(), 1)} value={editDates.checkOut} onChange={(event) => setEditDates((current) => ({ ...current, checkOut: event.target.value }))} /></label>
                    <label>Guests<select disabled={actionLoading} value={editDates.guestCount} onChange={(event) => setEditDates((current) => ({ ...current, guestCount: Number(event.target.value) }))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
                  </div>
                </section>
              ) : null}
              {actionError ? <p className="admin-error" role="alert">{actionError}</p> : null}
              <div className="admin-dialog-actions admin-modal-actions">
                {canEditSelectedBooking ? <Button variant="secondary" disabled={actionLoading} onClick={() => void runAction({ action: "edit", bookingId: selectedBooking.id, ...editDates })}>Save edit</Button> : null}
                {selectedBooking.status === "pending" ? <Button disabled={actionLoading} onClick={() => void runAction({ action: "confirm", bookingId: selectedBooking.id })}>Confirm</Button> : null}
                {selectedBooking.status === "pending" ? <Button variant="danger" disabled={actionLoading} onClick={() => void runAction({ action: "reject", bookingId: selectedBooking.id })}>Reject</Button> : null}
                {selectedBooking.status === "confirmed" ? <Button disabled={actionLoading} onClick={() => void runAction({ action: "check_in", bookingId: selectedBooking.id })}>Check in</Button> : null}
                {selectedBooking.status === "checked_in" ? <Button disabled={actionLoading} onClick={() => openCheckout(selectedBooking)}>Check out</Button> : null}
                {selectedBooking.status === "confirmed" ? <Button variant="danger" disabled={actionLoading} onClick={() => void runAction({ action: "cancel", bookingId: selectedBooking.id })}>Cancel</Button> : null}
                {selectedBooking.status === "checked_in" ? <Button variant="danger" disabled={actionLoading} onClick={() => void runAction({ action: "cancel", bookingId: selectedBooking.id })}>Cancel</Button> : null}
                <DialogClose asChild><Button variant="ghost">Close</Button></DialogClose>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(checkoutBooking)} onOpenChange={(open) => !open && setCheckoutBooking(null)}>
        <DialogContent className="ui-dialog-content admin-modal admin-checkout-modal">
          {checkoutBooking ? (
            <>
              <div className="admin-modal-header">
                <div>
                  <p className="admin-modal-kicker">Guest checkout</p>
                  <DialogTitle>Check out {checkoutBooking.guest_name}</DialogTitle>
                  <DialogDescription>Use the scheduled date, or choose an earlier date to release unused nights.</DialogDescription>
                </div>
              </div>
              <form className="admin-checkout-form" onSubmit={completeCheckout}>
                <section className="admin-modal-section" aria-labelledby="checkout-summary-heading">
                  <div className="admin-modal-section-heading"><h3 id="checkout-summary-heading">Stay summary</h3></div>
                  <div className="admin-detail-grid">
                  <div className="admin-detail-item"><span>Reference</span><strong>{checkoutBooking.booking_reference}</strong></div>
                  <div className="admin-detail-item"><span>Scheduled checkout</span><strong>{checkoutBooking.check_out}</strong></div>
                  </div>
                </section>
                <div className="admin-form-field">
                  <label>Actual checkout date<input required type="date" min={addDays(checkoutBooking.check_in, 1)} max={checkoutBooking.check_out} value={checkoutDate} onChange={(event) => setCheckoutDate(event.target.value)} /></label>
                </div>
                {checkoutError ? <p className="admin-error" role="alert">{checkoutError}</p> : null}
                <div className="admin-dialog-actions admin-modal-actions">
                  <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={checkoutLoading}>{checkoutLoading ? "Saving…" : "Confirm checkout"}</Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="ui-dialog-content admin-modal admin-create-modal">
          <div className="admin-modal-header">
            <div>
              <p className="admin-modal-kicker">Manual booking</p>
              <DialogTitle>New confirmed booking</DialogTitle>
              <DialogDescription>Create a confirmed booking for a phone, walk-in, or moved guest.</DialogDescription>
            </div>
          </div>
          <form className="admin-create-form" onSubmit={createBooking}>
            <section className="admin-modal-section" aria-labelledby="manual-guest-heading">
              <div className="admin-modal-section-heading"><h3 id="manual-guest-heading">Guest information</h3></div>
              <div className="admin-create-grid">
                <label>Full name<input required minLength={2} value={createForm.guestName} onChange={(event) => setCreateForm((current) => ({ ...current, guestName: event.target.value }))} /></label>
                <label>Email<input required type="email" value={createForm.guestEmail} onChange={(event) => setCreateForm((current) => ({ ...current, guestEmail: event.target.value }))} /></label>
                <label>Contact number<input required type="tel" value={createForm.contactNumber} onChange={(event) => setCreateForm((current) => ({ ...current, contactNumber: event.target.value }))} /></label>
                <label>Guests<select value={createForm.guestCount} onChange={(event) => setCreateForm((current) => ({ ...current, guestCount: Number(event.target.value) }))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
              </div>
            </section>
            <section className="admin-modal-section" aria-labelledby="manual-stay-heading">
              <div className="admin-modal-section-heading"><h3 id="manual-stay-heading">Stay dates</h3></div>
              <div className="admin-create-grid">
                <label>Check-in<input required type="date" min={todayDateString()} value={createForm.checkIn} onChange={(event) => setCreateForm((current) => ({ ...current, checkIn: event.target.value }))} /></label>
                <label>Check-out<input required type="date" min={createForm.checkIn ? addDays(createForm.checkIn, 1) : addDays(todayDateString(), 1)} value={createForm.checkOut} onChange={(event) => setCreateForm((current) => ({ ...current, checkOut: event.target.value }))} /></label>
              </div>
            </section>
            <div className="admin-form-field"><label>Message<textarea rows={3} value={createForm.message} onChange={(event) => setCreateForm((current) => ({ ...current, message: event.target.value }))} /></label></div>
            {createError ? <p className="admin-error" role="alert">{createError}</p> : null}
            <div className="admin-dialog-actions admin-modal-actions">
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={createLoading}>{createLoading ? "Creating…" : "Create booking"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
