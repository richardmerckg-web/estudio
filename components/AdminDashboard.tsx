"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarDays, ClipboardList, LayoutDashboard, LoaderCircle, LogOut, Plus, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
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
  formatDateRange,
  getBookingStatusLabel,
  monthKey,
  todayDateString,
  type BookingStatus,
} from "@/lib/booking";
import {
  fetchAdminData,
  performAdminAction,
  type AdminBooking,
  type AdminResponse,
} from "@/lib/booking-api";
import { supabase } from "@/lib/supabase";

const requestStatusOptions = ["request_all", "pending", "rejected", "cancelled", "expired"];

type AdminView = "overview" | "requests" | "front_desk" | "calendar" | "blocked";

const adminNavItems: Array<{ id: AdminView; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "requests", label: "Requests", icon: ClipboardList },
  { id: "front_desk", label: "Front desk", icon: BedDouble },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "blocked", label: "Blocked dates", icon: SlidersHorizontal },
];

const adminViewMeta: Record<AdminView, { title: string; description: string }> = {
  overview: { title: "Booking overview", description: "Current requests, stays, and availability." },
  requests: { title: "Requests", description: "Pending and closed request outcomes." },
  front_desk: { title: "Front desk", description: "Check guests in and out." },
  calendar: { title: "Calendar", description: "Review availability." },
  blocked: { title: "Blocked dates", description: "Hold dates for owner or maintenance use." },
};

function money(value: number) {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export default function AdminDashboard() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(supabase ? "" : "Supabase is not configured for this build.");
  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [month, setMonth] = useState(monthKey(todayDateString()));
  const [status, setStatus] = useState("all");
  const [frontDeskDate, setFrontDeskDate] = useState(todayDateString());
  const [frontDeskTab, setFrontDeskTab] = useState<"arrivals" | "in_house">("arrivals");
  const [dashboard, setDashboard] = useState<AdminResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [blockedDate, setBlockedDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
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

  const loadDashboard = useCallback(async () => {
    if (!sessionEmail) return;
    setIsLoading(true);
    setDashboardError("");
    try {
      const apiStatus = status === "request_all" ? "all" : status;
      setDashboard(await fetchAdminData({ month: activeView === "front_desk" ? "" : month, status: apiStatus }));
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load the dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [activeView, month, sessionEmail, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

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

  const refreshDashboard = async () => {
    setCalendarRefreshKey((value) => value + 1);
    await loadDashboard();
  };

  const navigateTo = (view: AdminView, nextStatus?: string) => {
    setActiveView(view);
    setStatus(nextStatus || (view === "requests" ? "pending" : "all"));
    if (view === "front_desk") {
      setFrontDeskTab("arrivals");
      setFrontDeskDate(todayDateString());
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

  const completeCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkoutBooking) return;
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      await performAdminAction({ action: "check_out", bookingId: checkoutBooking.id, actualCheckOut: checkoutDate });
      setCheckoutBooking(null);
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
    setBlockError("");
    const succeeded = await runAction(
      shouldBlock
        ? { action: "block", date: blockedDate, reason: blockedReason }
        : { action: "unblock", date: blockedDate },
    );
    if (succeeded) {
      setBlockedDate("");
      setBlockedReason("");
      setBlockError("");
    } else {
      setBlockError("Date action failed.");
    }
  };

  if (authLoading) {
    return <main className="admin-page"><p className="admin-loading">Loading admin access…</p></main>;
  }

  if (!sessionEmail) {
    return (
      <main className="admin-page admin-page--login">
        <Card className="admin-login-card">
          <CardHeader>
            <div className="admin-kicker"><ShieldCheck size={16} aria-hidden="true" /> Admin access</div>
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
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
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
  const today = todayDateString();
  const pendingBookings = dashboard?.bookings.filter((booking) => booking.status === "pending") || [];
  const requestBookings = dashboard?.bookings.filter((booking) => ["pending", "rejected", "cancelled", "expired"].includes(booking.status)) || [];
  const upcomingBookings = dashboard?.bookings
    .filter((booking) => ["confirmed", "checked_in"].includes(booking.status))
    .slice(0, 5) || [];
  const frontDeskBookings = dashboard?.bookings
    .filter((booking) => ["confirmed", "checked_in"].includes(booking.status))
    .sort((first, second) => first.check_in.localeCompare(second.check_in)) || [];
  const frontDeskArrivals = frontDeskBookings.filter((booking) => booking.status === "confirmed" && booking.check_in <= frontDeskDate && frontDeskDate < booking.check_out);
  const frontDeskInHouse = frontDeskBookings.filter((booking) => booking.status === "checked_in" && booking.check_in <= frontDeskDate);
  const frontDeskDepartures = frontDeskInHouse.filter((booking) => booking.check_out <= frontDeskDate);
  const upcomingArrivals = frontDeskBookings.filter((booking) => booking.status === "confirmed" && booking.check_in > frontDeskDate).slice(0, 7);
  const frontDeskList = frontDeskTab === "arrivals" ? frontDeskArrivals : frontDeskInHouse;
  const canOperateFrontDesk = frontDeskDate === today;
  const operationMessage = checkoutLoading
    ? "Recording checkout…"
    : createLoading
      ? "Creating booking…"
      : actionLoading
        ? "Saving booking changes…"
        : "";

  return (
    <main className="admin-page">
      <div className="admin-workspace">
        <aside className="admin-sidebar" aria-label="Admin navigation">
          <div className="admin-sidebar-brand">
            <div className="admin-brand-mark" aria-hidden="true">EF</div>
            <div>
              <strong>Estudio Fresco</strong>
              <span>Booking admin</span>
            </div>
          </div>
          <nav className="admin-sidebar-nav">
            <span className="admin-sidebar-label">Workspace</span>
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

        <div className="admin-main">
          <header className="admin-header">
            <div>
              <p className="admin-kicker"><ShieldCheck size={16} aria-hidden="true" /> Admin workspace</p>
              <h1>{viewMeta.title}</h1>
              <p className="admin-muted">{viewMeta.description}</p>
            </div>
            <div className="admin-header-actions">
              <Button variant="secondary" onClick={() => void refreshDashboard()} disabled={isLoading}>
                <RefreshCw size={16} aria-hidden="true" /> {isLoading ? "Refreshing…" : "Refresh"}
              </Button>
              <Button onClick={() => { setCreateError(""); setCreateDialogOpen(true); }}>
                <Plus size={16} aria-hidden="true" /> New booking
              </Button>
            </div>
          </header>

          {dashboardError ? <p className="admin-error" role="alert">{dashboardError}</p> : null}

          {activeView === "overview" ? (
            <section className="admin-view-section" aria-labelledby="overview-heading">
              <h2 className="sr-only" id="overview-heading">Booking overview summary</h2>
              <div className="admin-summary-grid">
                <Card><CardContent><span className="admin-stat-label">Requests this month</span><strong>{dashboard?.bookings.length ?? 0}</strong><small>Filtered by check-in month</small></CardContent></Card>
                <Card><CardContent><span className="admin-stat-label">Confirmed revenue</span><strong>{money(filteredConfirmedRevenue)}</strong><small>Selected month</small></CardContent></Card>
                <Card><CardContent><span className="admin-stat-label">Confirmed nights</span><strong>{summary?.confirmedNights ?? 0}</strong><small>Active and completed stays</small></CardContent></Card>
                <Card><CardContent><span className="admin-stat-label">Pending</span><strong>{summary?.totals.pending ?? 0}</strong><small>Requests awaiting decision</small></CardContent></Card>
              </div>
              <div className="admin-status-strip" aria-label="Booking status totals">
                {(["confirmed", "checked_in", "checked_out", "pending", "rejected", "cancelled", "expired"] as BookingStatus[]).map((item) => (
                  <span key={item}><Badge variant={item}>{getBookingStatusLabel(item)}</Badge> {summary?.totals[item] ?? 0}</span>
                ))}
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
                <CardHeader><div className="admin-card-heading-row"><div><CardTitle>Upcoming stays</CardTitle><p className="admin-muted">Confirmed stays in the selected month.</p></div><Button variant="ghost" onClick={() => navigateTo("front_desk")}>Open front desk</Button></div></CardHeader>
                <CardContent>
                  {upcomingBookings.length ? <div className="admin-upcoming-list">{upcomingBookings.map((booking) => <button key={booking.id} type="button" onClick={() => openBooking(booking)}><span><strong>{booking.guest_name}</strong><small>{formatDateRange(booking.check_in, booking.check_out)} · {booking.booking_reference}</small></span><Badge variant={booking.status}>{getBookingStatusLabel(booking.status)}</Badge></button>)}</div> : <p className="admin-empty">No upcoming confirmed stays in this month.</p>}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {activeView === "requests" ? (
            <section className="admin-view-section" aria-labelledby="bookings-heading">
              <div className="admin-section-heading"><div><h2 id="bookings-heading">Booking requests</h2><p className="admin-muted">Review pending requests and closed request outcomes. Confirmed stays are managed at the front desk.</p></div><div className="admin-filters"><label>Check-in month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label>Request status<select value={status} onChange={(event) => setStatus(event.target.value)}>{requestStatusOptions.map((option) => <option key={option} value={option}>{option === "request_all" ? "All request outcomes" : getBookingStatusLabel(option as BookingStatus)}</option>)}</select></label></div></div>
              <section className="admin-data-panel admin-data-panel--flush" aria-label="Booking request list">
                <div>
                  {isLoading ? <p className="admin-loading">Loading bookings…</p> : null}
                  {!isLoading && requestBookings.length === 0 ? <p className="admin-empty">No booking requests match these filters.</p> : null}
                  {requestBookings.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Dates</th><th>Guest</th><th>Guests</th><th>Total</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{requestBookings.map((booking) => <tr key={booking.id}><td><button className="admin-reference" type="button" onClick={() => openBooking(booking)}>{booking.booking_reference}</button></td><td>{formatDateRange(booking.check_in, booking.check_out)}</td><td>{booking.guest_name}</td><td>{booking.guest_count}</td><td>{money(Number(booking.total_amount))}</td><td><Badge variant={booking.status}>{getBookingStatusLabel(booking.status)}</Badge></td><td><Button variant="ghost" onClick={() => openBooking(booking)}>View</Button></td></tr>)}</tbody></table></div> : null}
                </div>
              </section>
            </section>
          ) : null}

          {activeView === "front_desk" ? (
            <section className="admin-view-section" aria-labelledby="front-desk-heading">
              <h2 className="sr-only" id="front-desk-heading">Front desk operations</h2>
              <div className="admin-front-desk-summary" aria-label="Front desk counts">
                <span><strong>{frontDeskArrivals.length}</strong> arrivals</span>
                <span><strong>{frontDeskInHouse.length}</strong> in-house</span>
                <span><strong>{frontDeskDepartures.length}</strong> departures due</span>
              </div>
              <div className="admin-front-desk-toolbar">
                <label className="admin-date-control">Operating date<input type="date" value={frontDeskDate} onChange={(event) => setFrontDeskDate(event.target.value)} /></label>
                <div className="admin-stay-tabs" role="tablist" aria-label="Front desk work queue">
                  <button type="button" role="tab" aria-selected={frontDeskTab === "arrivals"} className={`admin-stay-tab ${frontDeskTab === "arrivals" ? "admin-stay-tab--active" : ""}`.trim()} onClick={() => setFrontDeskTab("arrivals")}>Arrivals <span>{frontDeskArrivals.length}</span></button>
                  <button type="button" role="tab" aria-selected={frontDeskTab === "in_house"} className={`admin-stay-tab ${frontDeskTab === "in_house" ? "admin-stay-tab--active" : ""}`.trim()} onClick={() => setFrontDeskTab("in_house")}>In-house & departures <span>{frontDeskInHouse.length}</span></button>
                </div>
              </div>
              <div className="admin-front-desk-layout">
                <section className="admin-data-panel admin-front-desk-primary-card" aria-labelledby="front-desk-queue-heading">
                  <div className="admin-data-panel-heading"><div><h2 id="front-desk-queue-heading">{frontDeskTab === "arrivals" ? "Arrivals" : "In-house guests"}</h2><p className="admin-muted">{frontDeskTab === "arrivals" ? "Check in guests arriving on the operating date." : "Check out current guests and release unused nights when they leave early."}</p></div><Badge variant={frontDeskTab === "arrivals" ? "confirmed" : "checked_in"}>{frontDeskDate === today ? "Today" : frontDeskDate}</Badge></div>
                  <div>
                    {frontDeskList.length ? <div className="admin-guest-list">{frontDeskList.map((booking) => <article className="admin-guest-card" key={booking.id}><div className="admin-guest-card-main"><div className="admin-guest-card-heading"><strong>{booking.guest_name}</strong><Badge variant={booking.status}>{getBookingStatusLabel(booking.status)}</Badge></div><div className="admin-guest-card-meta"><span>{booking.booking_reference}</span><span>{formatDateRange(booking.check_in, booking.check_out)}</span><span>{booking.guest_count} guest{booking.guest_count === 1 ? "" : "s"}</span></div><div className="admin-guest-card-contact"><a href={`mailto:${booking.guest_email}`}>{booking.guest_email}</a><a href={`tel:${booking.contact_number}`}>{booking.contact_number}</a></div></div><div className="admin-guest-card-actions"><Button variant="ghost" onClick={() => openBooking(booking)}>View details</Button>{frontDeskTab === "arrivals" && canOperateFrontDesk ? <Button variant="secondary" onClick={() => void runAction({ action: "check_in", bookingId: booking.id })}>Check in</Button> : null}{frontDeskTab === "in_house" && canOperateFrontDesk ? <Button onClick={() => openCheckout(booking)}>Check out</Button> : null}{!canOperateFrontDesk ? <small>Actions available on today’s date</small> : null}</div></article>)}</div> : <p className="admin-empty">{frontDeskTab === "arrivals" ? `No confirmed arrivals on ${frontDeskDate}.` : `No checked-in guests staying on ${frontDeskDate}.`}</p>}
                  </div>
                </section>
                <aside className="admin-data-panel admin-front-desk-upcoming-card" aria-labelledby="upcoming-arrivals-heading">
                  <div className="admin-data-panel-heading"><div><h2 id="upcoming-arrivals-heading">Upcoming arrivals</h2><p className="admin-muted">After the operating date.</p></div></div>
                  <div>{upcomingArrivals.length ? <div className="admin-upcoming-list admin-upcoming-list--compact">{upcomingArrivals.map((booking) => <button key={booking.id} type="button" onClick={() => openBooking(booking)}><span><strong>{booking.guest_name}</strong><small>{booking.check_in} · {booking.booking_reference}</small></span><span className="admin-upcoming-list-date">View details</span></button>)}</div> : <p className="admin-empty">No upcoming arrivals found.</p>}</div>
                </aside>
              </div>
              <div className="admin-front-desk-note"><BedDouble size={18} aria-hidden="true" /><div><strong>Checkout rule</strong><p>Normal checkout keeps the original stay history. An earlier actual checkout date releases the unused nights and makes them available again.</p></div></div>
            </section>
          ) : null}

          {activeView === "calendar" ? (
            <section className="admin-view-section" aria-label="Availability calendar content">
              <div className="admin-calendar-section"><BookingCalendar checkIn="" checkOut="" onRangeChange={() => undefined} readOnly refreshKey={calendarRefreshKey} /></div>
            </section>
          ) : null}

          {activeView === "blocked" ? (
            <section className="admin-view-section admin-blocked-view" aria-labelledby="blocked-heading">
              <section className="admin-data-panel admin-block-panel">
                <div className="admin-data-panel-heading"><div><h2 id="blocked-heading">Block a date</h2><p className="admin-muted">Hold dates for owner stays, maintenance, or other unavailable periods.</p></div></div>
                <div className="admin-block-form"><label>Date<input type="date" value={blockedDate} min={todayDateString()} onChange={(event) => setBlockedDate(event.target.value)} /></label><label>Reason<input type="text" value={blockedReason} maxLength={240} onChange={(event) => setBlockedReason(event.target.value)} placeholder="Optional note" /></label>{blockError ? <p className="admin-error" role="alert">{blockError}</p> : null}<div className="admin-inline-actions"><Button onClick={() => void blockDate(true)}>Block date</Button><Button variant="secondary" onClick={() => void blockDate(false)}>Unblock</Button></div></div>
              </section>
              <div className="admin-info-panel"><CalendarDays size={18} aria-hidden="true" /><div><strong>How blocked dates work</strong><p>Blocked nights are unavailable to visitors and cannot be used by new manual bookings.</p></div></div>
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
        <DialogContent className="ui-dialog-content">
          {selectedBooking ? (
            <>
              <DialogTitle>{selectedBooking.booking_reference}</DialogTitle>
              <DialogDescription>Booking details and administrative actions.</DialogDescription>
              <div className="booking-detail-grid">
                <div><span>Visitor</span><strong>{selectedBooking.guest_name}</strong></div>
                <div><span>Guests</span><strong>{selectedBooking.guest_count}</strong></div>
                <div><span>Email</span><a href={`mailto:${selectedBooking.guest_email}`}>{selectedBooking.guest_email}</a></div>
                <div><span>Phone</span><a href={`tel:${selectedBooking.contact_number}`}>{selectedBooking.contact_number}</a></div>
                <div><span>Dates</span><strong>{formatDateRange(selectedBooking.check_in, selectedBooking.check_out)}</strong></div>
                <div><span>Total</span><strong>{money(Number(selectedBooking.total_amount))}</strong></div>
              </div>
              {selectedBooking.message ? <p className="booking-detail-message">{selectedBooking.message}</p> : null}
              {selectedBooking.audit_log?.length ? (
                <div className="admin-audit-log">
                  <h3>Activity</h3>
                  <ol>
                    {selectedBooking.audit_log.map((entry) => (
                      <li key={entry.id}>
                        <strong>{entry.action.replaceAll("_", " ")}</strong>
                        <span>{new Date(entry.created_at).toLocaleString("en-PH")}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="admin-edit-fields">
                <label>Check-in<input type="date" min={todayDateString()} value={editDates.checkIn} onChange={(event) => setEditDates((current) => ({ ...current, checkIn: event.target.value }))} /></label>
                <label>Check-out<input type="date" min={editDates.checkIn ? addDays(editDates.checkIn, 1) : addDays(todayDateString(), 1)} value={editDates.checkOut} onChange={(event) => setEditDates((current) => ({ ...current, checkOut: event.target.value }))} /></label>
                <label>Guests<select value={editDates.guestCount} onChange={(event) => setEditDates((current) => ({ ...current, guestCount: Number(event.target.value) }))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
              </div>
              {actionError ? <p className="admin-error" role="alert">{actionError}</p> : null}
              <div className="admin-dialog-actions">
                <Button variant="secondary" disabled={actionLoading || !["pending", "confirmed"].includes(selectedBooking.status)} onClick={() => void runAction({ action: "edit", bookingId: selectedBooking.id, ...editDates })}>Save edit</Button>
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
        <DialogContent className="ui-dialog-content">
          {checkoutBooking ? (
            <>
              <DialogTitle>Check out {checkoutBooking.guest_name}</DialogTitle>
              <DialogDescription>Use the scheduled date for a normal checkout, or select an earlier date to release unused nights.</DialogDescription>
              <form className="admin-checkout-form" onSubmit={completeCheckout}>
                <div className="booking-detail-grid">
                  <div><span>Reference</span><strong>{checkoutBooking.booking_reference}</strong></div>
                  <div><span>Scheduled checkout</span><strong>{checkoutBooking.check_out}</strong></div>
                </div>
                <label>Actual checkout date<input required type="date" min={addDays(checkoutBooking.check_in, 1)} max={checkoutBooking.check_out} value={checkoutDate} onChange={(event) => setCheckoutDate(event.target.value)} /></label>
                {checkoutError ? <p className="admin-error" role="alert">{checkoutError}</p> : null}
                <div className="admin-dialog-actions">
                  <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={checkoutLoading}>{checkoutLoading ? "Saving…" : "Confirm checkout"}</Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="ui-dialog-content">
          <DialogTitle>New confirmed booking</DialogTitle>
          <DialogDescription>Create a direct booking for a phone, walk-in, or moved guest. This reserves the selected nights immediately.</DialogDescription>
          <form className="admin-create-form" onSubmit={createBooking}>
            <div className="admin-create-grid">
              <label>Full name<input required minLength={2} value={createForm.guestName} onChange={(event) => setCreateForm((current) => ({ ...current, guestName: event.target.value }))} /></label>
              <label>Email<input required type="email" value={createForm.guestEmail} onChange={(event) => setCreateForm((current) => ({ ...current, guestEmail: event.target.value }))} /></label>
              <label>Contact number<input required type="tel" value={createForm.contactNumber} onChange={(event) => setCreateForm((current) => ({ ...current, contactNumber: event.target.value }))} /></label>
              <label>Guests<select value={createForm.guestCount} onChange={(event) => setCreateForm((current) => ({ ...current, guestCount: Number(event.target.value) }))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
              <label>Check-in<input required type="date" min={todayDateString()} value={createForm.checkIn} onChange={(event) => setCreateForm((current) => ({ ...current, checkIn: event.target.value }))} /></label>
              <label>Check-out<input required type="date" min={createForm.checkIn ? addDays(createForm.checkIn, 1) : addDays(todayDateString(), 1)} value={createForm.checkOut} onChange={(event) => setCreateForm((current) => ({ ...current, checkOut: event.target.value }))} /></label>
            </div>
            <label>Message<textarea rows={3} value={createForm.message} onChange={(event) => setCreateForm((current) => ({ ...current, message: event.target.value }))} /></label>
            {createError ? <p className="admin-error" role="alert">{createError}</p> : null}
            <div className="admin-dialog-actions">
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={createLoading}>{createLoading ? "Creating…" : "Create booking"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
