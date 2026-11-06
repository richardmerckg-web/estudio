"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, RefreshCw, ShieldCheck } from "lucide-react";
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

const statusOptions = ["all", "pending", "confirmed", "rejected", "cancelled", "expired"];

function money(value: number) {
  return `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export default function AdminDashboard() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(supabase ? "" : "Supabase is not configured for this build.");
  const [month, setMonth] = useState(monthKey(todayDateString()));
  const [status, setStatus] = useState("all");
  const [dashboard, setDashboard] = useState<AdminResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [blockedDate, setBlockedDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [blockError, setBlockError] = useState("");
  const [editDates, setEditDates] = useState({ checkIn: "", checkOut: "", guestCount: 1 });

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
        .filter((booking) => booking.status === "confirmed")
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
      await loadDashboard();
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action could not be completed.");
      return false;
    } finally {
      setActionLoading(false);
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

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <p className="admin-kicker"><ShieldCheck size={16} aria-hidden="true" /> Protected dashboard</p>
            <h1>Booking overview</h1>
            <p className="admin-muted">Signed in as {sessionEmail}</p>
          </div>
          <div className="admin-header-actions">
            <Button variant="secondary" onClick={() => void loadDashboard()} disabled={isLoading}>
              <RefreshCw size={16} aria-hidden="true" /> Refresh
            </Button>
            <Button variant="ghost" onClick={() => void signOut()}>
              <LogOut size={16} aria-hidden="true" /> Sign out
            </Button>
          </div>
        </header>

        <div className="admin-filters">
          <label>
            Month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All statuses" : getBookingStatusLabel(option as BookingStatus)}</option>)}
            </select>
          </label>
        </div>

        {dashboardError ? <p className="admin-error" role="alert">{dashboardError}</p> : null}

        <div className="admin-summary-grid">
          <Card><CardContent><span className="admin-stat-label">Requests this month</span><strong>{dashboard?.bookings.length ?? 0}</strong><small>Filtered by check-in month</small></CardContent></Card>
          <Card><CardContent><span className="admin-stat-label">Confirmed revenue</span><strong>{money(filteredConfirmedRevenue)}</strong><small>Selected month</small></CardContent></Card>
          <Card><CardContent><span className="admin-stat-label">Confirmed nights</span><strong>{summary?.confirmedNights ?? 0}</strong><small>All active confirmed nights</small></CardContent></Card>
          <Card><CardContent><span className="admin-stat-label">Pending</span><strong>{summary?.totals.pending ?? 0}</strong><small>Requests awaiting decision</small></CardContent></Card>
        </div>

        <div className="admin-status-strip" aria-label="Booking status totals">
          {(["confirmed", "pending", "rejected", "cancelled", "expired"] as BookingStatus[]).map((item) => (
            <span key={item}><Badge variant={item}>{getBookingStatusLabel(item)}</Badge> {summary?.totals[item] ?? 0}</span>
          ))}
        </div>

        <div className="admin-content-grid">
          <Card className="admin-calendar-card">
            <CardHeader><CardTitle>Availability calendar</CardTitle><p className="admin-muted">Private booking details are only shown in the table.</p></CardHeader>
            <CardContent><BookingCalendar checkIn="" checkOut="" onRangeChange={() => undefined} readOnly /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Block a date</CardTitle><p className="admin-muted">Use this for owner stays, maintenance, or other unavailable dates.</p></CardHeader>
            <CardContent>
              <div className="admin-block-form">
                <label>Date<input type="date" value={blockedDate} min={todayDateString()} onChange={(event) => setBlockedDate(event.target.value)} /></label>
                <label>Reason <input type="text" value={blockedReason} maxLength={240} onChange={(event) => setBlockedReason(event.target.value)} placeholder="Optional note" /></label>
                {blockError ? <p className="admin-error" role="alert">{blockError}</p> : null}
                <div className="admin-inline-actions"><Button onClick={() => void blockDate(true)}>Block date</Button><Button variant="secondary" onClick={() => void blockDate(false)}>Unblock</Button></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="admin-table-card">
          <CardHeader><CardTitle>Booking requests</CardTitle><p className="admin-muted">Select a request to review contact details and update its status.</p></CardHeader>
          <CardContent>
            {isLoading ? <p className="admin-loading">Loading bookings…</p> : null}
            {!isLoading && dashboard?.bookings.length === 0 ? <p className="admin-empty">No booking requests match these filters.</p> : null}
            {dashboard?.bookings.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Reference</th><th>Dates</th><th>Guest</th><th>Guests</th><th>Total</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {dashboard.bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td><button className="admin-reference" type="button" onClick={() => openBooking(booking)}>{booking.booking_reference}</button></td>
                        <td>{formatDateRange(booking.check_in, booking.check_out)}</td>
                        <td>{booking.guest_name}</td>
                        <td>{booking.guest_count}</td>
                        <td>{money(Number(booking.total_amount))}</td>
                        <td><Badge variant={booking.status}>{getBookingStatusLabel(booking.status)}</Badge></td>
                        <td><Button variant="ghost" onClick={() => openBooking(booking)}>View</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
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
              <div className="admin-edit-fields">
                <label>Check-in<input type="date" value={editDates.checkIn} onChange={(event) => setEditDates((current) => ({ ...current, checkIn: event.target.value }))} /></label>
                <label>Check-out<input type="date" value={editDates.checkOut} onChange={(event) => setEditDates((current) => ({ ...current, checkOut: event.target.value }))} /></label>
                <label>Guests<select value={editDates.guestCount} onChange={(event) => setEditDates((current) => ({ ...current, guestCount: Number(event.target.value) }))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
              </div>
              {actionError ? <p className="admin-error" role="alert">{actionError}</p> : null}
              <div className="admin-dialog-actions">
                <Button variant="secondary" disabled={actionLoading} onClick={() => void runAction({ action: "edit", bookingId: selectedBooking.id, ...editDates })}>Save edit</Button>
                {selectedBooking.status === "pending" ? <Button disabled={actionLoading} onClick={() => void runAction({ action: "confirm", bookingId: selectedBooking.id })}>Confirm</Button> : null}
                {selectedBooking.status === "pending" ? <Button variant="danger" disabled={actionLoading} onClick={() => void runAction({ action: "reject", bookingId: selectedBooking.id })}>Reject</Button> : null}
                {selectedBooking.status === "confirmed" ? <Button variant="danger" disabled={actionLoading} onClick={() => void runAction({ action: "cancel", bookingId: selectedBooking.id })}>Cancel</Button> : null}
                <DialogClose asChild><Button variant="ghost">Close</Button></DialogClose>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
