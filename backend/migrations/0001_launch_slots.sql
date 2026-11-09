CREATE TABLE IF NOT EXISTS eywa_launch_slots (
 slot INTEGER PRIMARY KEY CHECK (slot IN (1,2)),
 state TEXT NOT NULL CHECK (state IN ('available','held','paid')),
 claim_id TEXT UNIQUE,
 session_id TEXT UNIQUE,
 normal_cents INTEGER,
 payable_cents INTEGER,
 held_at TEXT,
 paid_at TEXT,
 CHECK (state='available' OR (claim_id IS NOT NULL AND normal_cents>0 AND payable_cents>0)),
 CHECK (state<>'paid' OR (session_id IS NOT NULL AND paid_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS eywa_migration (id INTEGER PRIMARY KEY CHECK(id=1), imported_at TEXT NOT NULL, source TEXT NOT NULL);
-- No available slot is inserted here. Import and reconcile the existing state
-- before enabling the offer: a new database must never reset the promotion.
