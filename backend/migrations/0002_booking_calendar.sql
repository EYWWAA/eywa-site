CREATE TABLE IF NOT EXISTS eywa_booking_import (id INTEGER PRIMARY KEY CHECK(id=1), imported_at TEXT NOT NULL, source TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS eywa_bookings (
 id TEXT PRIMARY KEY, session_id TEXT UNIQUE,
 state TEXT NOT NULL CHECK(state IN ('held','paid','released')),
 start_date TEXT NOT NULL,end_date TEXT NOT NULL,
 normal_cents INTEGER NOT NULL CHECK(normal_cents>0),payable_cents INTEGER NOT NULL CHECK(payable_cents>0),
 payment_kind TEXT NOT NULL,details_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),paid_at TEXT,
 CHECK(state<>'paid' OR (session_id IS NOT NULL AND paid_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS eywa_booking_days(day TEXT PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES eywa_bookings(id));
CREATE INDEX IF NOT EXISTS eywa_booking_state ON eywa_bookings(state,created_at);
-- Historical paid/open Stripe reservations must be imported before enabling new checkout.
