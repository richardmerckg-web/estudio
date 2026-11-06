import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOKING_STATUS_TRANSITIONS,
  calendarStatus,
  calculateTotal,
  generateNightDates,
  isPendingExpired,
  rangeIsAvailable,
  rateForNight,
} from "../lib/booking";

test("generates check-in-inclusive and check-out-exclusive nights", () => {
  assert.deepEqual(generateNightDates("2026-06-10", "2026-06-13"), [
    "2026-06-10",
    "2026-06-11",
    "2026-06-12",
  ]);
});

test("uses weekday and weekend rates", () => {
  assert.equal(rateForNight("2026-06-10"), 2000);
  assert.equal(rateForNight("2026-06-13"), 2500);
  assert.equal(calculateTotal("2026-06-12", "2026-06-15"), 7000);
});

test("detects an overlapping booked night", () => {
  const availability = {
    "2026-06-10": "available" as const,
    "2026-06-11": "booked" as const,
    "2026-06-12": "available" as const,
  };
  assert.equal(rangeIsAvailable("2026-06-10", "2026-06-12", availability), false);
  assert.equal(rangeIsAvailable("2026-06-12", "2026-06-13", availability), true);
});

test("public calendars treat pending requests as available", () => {
  assert.equal(calendarStatus("pending", true), "available");
  assert.equal(calendarStatus("pending", false), "pending");
  assert.equal(calendarStatus("booked", true), "booked");
  assert.equal(calendarStatus("pending", false), "pending");
});

test("expires a pending request at 24 hours", () => {
  const createdAt = new Date("2026-06-10T12:00:00.000Z");
  const expiry = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isPendingExpired(expiry, new Date("2026-06-11T11:59:59.000Z")), false);
  assert.equal(isPendingExpired(expiry, new Date("2026-06-11T12:00:00.000Z")), true);
});

test("allows only the intended booking status transitions", () => {
  assert.deepEqual(BOOKING_STATUS_TRANSITIONS.pending, ["confirmed", "rejected", "cancelled"]);
  assert.deepEqual(BOOKING_STATUS_TRANSITIONS.confirmed, ["checked_in", "checked_out", "cancelled"]);
  assert.deepEqual(BOOKING_STATUS_TRANSITIONS.checked_in, ["checked_out", "cancelled"]);
  assert.deepEqual(BOOKING_STATUS_TRANSITIONS.checked_out, []);
  assert.deepEqual(BOOKING_STATUS_TRANSITIONS.expired, []);
});

test("migration enforces RLS and admin-only database access assumptions", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase", "migrations", "20261106064408_booking_system.sql"),
    "utf8",
  );
  for (const table of ["admin_users", "bookings", "booking_nights", "blocked_dates"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  }
  assert.match(migration, /revoke all on table public\.admin_users, public\.bookings, public\.booking_nights, public\.blocked_dates from anon;/);
  assert.match(migration, /revoke all on function public\.create_pending_booking/);
  assert.match(migration, /Admins can read bookings/);

  const lifecycleMigration = readFileSync(
    join(process.cwd(), "supabase", "migrations", "20261106082235_booking_lifecycle_admin_audit.sql"),
    "utf8",
  );
  assert.match(lifecycleMigration, /checked_in/);
  assert.match(lifecycleMigration, /checked_out/);
  assert.match(lifecycleMigration, /create table if not exists public\.booking_audit_log/);
  assert.match(lifecycleMigration, /create or replace function public\.admin_create_booking/);
});
