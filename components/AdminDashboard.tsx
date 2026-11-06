"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, LayoutDashboard, LogOut, Plus, RefreshCw, ShieldCheck, SlidersHorizontal } from "lucide-react";
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

const statusOptions = ["all", "pending", "confirmed", "checked_in", "checked_out", "rejected", "cancelled", "expired"];

type AdminView = "overview" | "bookings" | "calendar" | "blocked";

const adminNavItems: Array<{ id: AdminView; label: string; description: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", description: "At-a-glance status", icon: LayoutDashboard },
  { id: "bookings", label: "Bookings", description: "Requests and stays", icon: ClipboardList },
  { id: "calendar", label: "Calendar", description: "Availability overview", icon: CalendarDays },
  { id: "blocked", label: "Blocked dates", description: "Owner and maintenance holds", icon: SlidersHorizontal },
];

const adminViewMeta: Record<AdminView, { title: string; description: string }> = {
  overview: { title: "Booking overview", description: "A quick view of current requests, stays, and availability." },
  bookings: { title: "Bookings", description: "Review requests, update stay details, and manage the guest lifecycle." },
  calendar: { title: "Availability calendar", description: "See which nights are available, booked, or blocked." },
  blocked: { title: "Blocked dates", description: "Reserve dates for owner stays, maintenance, or other unavailable periods." },
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
      setDashboard(await fetchAdminData({ month, status }));
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load the dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [month, sessionEmail, status]);

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

  const openBooking = (booking: AdminBooking) => {
    setSelectedBooking(booking);
    setActionError("");
    setEditDates({
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      guestCount: booking.guest_count,
    });
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
  const pendingBookings = dashboard?.bookings.filter((booking) => booking.status === "pending") || [];
  const upcomingBookings = dashboard?.bookings
    .filter((booking) => ["confirmed", "checked_in"].includes(booking.status))
    .slice(0, 5) || [];

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
            {adminNavItems.map(({ id, label, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`admin-nav-button ${activeView === id ? "admin-nav-button--active" : ""}`.trim()}
                aria-current={activeView === id ? "page" : undefined}
                onClick={() => setActiveView(id)}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span><strong>{label}</strong><small>{description}</small></span>
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
                <RefreshCw size={16} aria-hidden="true" /> Refresh
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
                  <CardHeader><div className="admin-card-heading-row"><div><CardTitle>Availability at a glance</CardTitle><p className="admin-muted">Private booking details stay in the Bookings view.</p></div><Button variant="ghost" onClick={() => setActiveView("calendar")}>Open calendar</Button></div></CardHeader>
                  <CardContent><BookingCalendar checkIn="" checkOut="" onRangeChange={() => undefined} readOnly refreshKey={calendarRefreshKey} /></CardContent>
                </Card>
                <Card className="admin-attention-card">
                  <CardHeader><CardTitle>Needs attention</CardTitle><p className="admin-muted">Requests waiting for an admin decision.</p></CardHeader>
                  <CardContent>
                    {pendingBookings.length ? <div className="admin-attention-list">{pendingBookings.slice(0, 4).map((booking) => <button key={booking.id} type="button" onClick={() => openBooking(booking)}><span><strong>{booking.guest_name}</strong><small>{formatDateRange(booking.check_in, booking.check_out)}</small></span><Badge variant="pending">Pending</Badge></button>)}</div> : <p className="admin-empty">No pending requests right now.</p>}
                    <Button className="admin-full-width-button" variant="secondary" onClick={() => { setStatus("pending"); setActiveView("bookings"); }}>View pending bookings</Button>
                  </CardContent>
                </Card>
              </div>
              <Card className="admin-table-card">
                <CardHeader><div className="admin-card-heading-row"><div><CardTitle>Upcoming stays</CardTitle><p className="admin-muted">Confirmed stays in the selected month.</p></div><Button variant="ghost" onClick={() => setActiveView("bookings")}>View all bookings</Button></div></CardHeader>
                <CardContent>
                  {upcomingBookings.length ? <div className="admin-upcoming-list">{upcomingBookings.map((booking) => <button key={booking.id} type="button" onClick={() => openBooking(booking)}><span><strong>{booking.guest_name}</strong><small>{formatDateRange(booking.check_in, booking.check_out)} · {booking.booking_reference}</small></span><Badge variant={booking.status}>{getBookingStatusLabel(booking.status)}</Badge></button>)}</div> : <p className="admin-empty">No upcoming confirmed stays in this month.</p>}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {activeView === "bookings" ? (
            <section className="admin-view-section" aria-labelledby="bookings-heading">
              <div className="admin-section-heading"><div><h2 id="bookings-heading">Requests and stays</h2><p className="admin-muted">Select a booking to review contact details or update its status.</p></div><div className="admin-filters"><label>Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All statuses" : getBookingStatusLabel(option as BookingStatus)}</option>)}</select></label></div></div>
              <Card className="admin-table-card admin-table-card--flush">
                <CardContent>
                  {isLoading ? <p className="admin-loading">Loading bookings…</p> : null}
                  {!isLoading && dashboard?.bookings.length === 0 ? <p className="admin-empty">No booking requests match these filters.</p> : null}
                  {dashboard?.bookings.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Dates</th><th>Guest</th><th>Guests</th><th>Total</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{dashboard.bookings.map((booking) => <tr key={booking.id}><td><button className="admin-reference" type="button" onClick={() => openBooking(booking)}>{booking.booking_reference}</button></td><td>{formatDateRange(booking.check_in, booking.check_out)}</td><td>{booking.guest_name}</td><td>{booking.guest_count}</td><td>{money(Number(booking.total_amount))}</td><td><Badge variant={booking.status}>{getBookingStatusLabel(booking.status)}</Badge></td><td><Button variant="ghost" onClick={() => openBooking(booking)}>View</Button></td></tr>)}</tbody></table></div> : null}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {activeView === "calendar" ? (
            <section className="admin-view-section" aria-labelledby="calendar-heading">
              <h2 className="sr-only" id="calendar-heading">Availability calendar</h2>
              <Card className="admin-calendar-card admin-calendar-card--full"><CardContent><BookingCalendar checkIn="" checkOut="" onRangeChange={() => undefined} readOnly refreshKey={calendarRefreshKey} /></CardContent></Card>
            </section>
          ) : null}

          {activeView === "blocked" ? (
            <section className="admin-view-section admin-blocked-view" aria-labelledby="blocked-heading">
              <Card className="admin-block-card">
                <CardHeader><CardTitle id="blocked-heading">Block a date</CardTitle><p className="admin-muted">Use this for owner stays, maintenance, or other dates that should not be available to visitors.</p></CardHeader>
                <CardContent><div className="admin-block-form"><label>Date<input type="date" value={blockedDate} min={todayDateString()} onChange={(event) => setBlockedDate(event.target.value)} /></label><label>Reason<input type="text" value={blockedReason} maxLength={240} onChange={(event) => setBlockedReason(event.target.value)} placeholder="Optional note" /></label>{blockError ? <p className="admin-error" role="alert">{blockError}</p> : null}<div className="admin-inline-actions"><Button onClick={() => void blockDate(true)}>Block date</Button><Button variant="secondary" onClick={() => void blockDate(false)}>Unblock</Button></div></div></CardContent>
              </Card>
              <div className="admin-info-panel"><CalendarDays size={18} aria-hidden="true" /><div><strong>How blocked dates work</strong><p>Blocked nights are unavailable to visitors and cannot be used by new manual bookings.</p></div></div>
            </section>
          ) : null}
        </div>
      </div>

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
                <label>Check-in<input type="date" value={editDates.checkIn} onChange={(event) => setEditDates((current) => ({ ...current, checkIn: event.target.value }))} /></label>
                <label>Check-out<input type="date" value={editDates.checkOut} onChange={(event) => setEditDates((current) => ({ ...current, checkOut: event.target.value }))} /></label>
                <label>Guests<select value={editDates.guestCount} onChange={(event) => setEditDates((current) => ({ ...current, guestCount: Number(event.target.value) }))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
              </div>
              {actionError ? <p className="admin-error" role="alert">{actionError}</p> : null}
              <div className="admin-dialog-actions">
                <Button variant="secondary" disabled={actionLoading || !["pending", "confirmed"].includes(selectedBooking.status)} onClick={() => void runAction({ action: "edit", bookingId: selectedBooking.id, ...editDates })}>Save edit</Button>
                {selectedBooking.status === "pending" ? <Button disabled={actionLoading} onClick={() => void runAction({ action: "confirm", bookingId: selectedBooking.id })}>Confirm</Button> : null}
                {selectedBooking.status === "pending" ? <Button variant="danger" disabled={actionLoading} onClick={() => void runAction({ action: "reject", bookingId: selectedBooking.id })}>Reject</Button> : null}
                {selectedBooking.status === "confirmed" ? <Button disabled={actionLoading} onClick={() => void runAction({ action: "check_in", bookingId: selectedBooking.id })}>Check in</Button> : null}
                {selectedBooking.status === "checked_in" ? <Button disabled={actionLoading} onClick={() => void runAction({ action: "check_out", bookingId: selectedBooking.id })}>Check out</Button> : null}
                {selectedBooking.status === "confirmed" ? <Button variant="danger" disabled={actionLoading} onClick={() => void runAction({ action: "cancel", bookingId: selectedBooking.id })}>Cancel</Button> : null}
                {selectedBooking.status === "checked_in" ? <Button variant="danger" disabled={actionLoading} onClick={() => void runAction({ action: "cancel", bookingId: selectedBooking.id })}>Cancel</Button> : null}
                <DialogClose asChild><Button variant="ghost">Close</Button></DialogClose>
              </div>
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
              <label>Check-out<input required type="date" min={todayDateString()} value={createForm.checkOut} onChange={(event) => setCreateForm((current) => ({ ...current, checkOut: event.target.value }))} /></label>
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
