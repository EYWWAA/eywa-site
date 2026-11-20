-- Espace EYWA : données de préparation séparées des devis et paiements historiques.
CREATE TABLE IF NOT EXISTS eywa_crm_auth (
 id TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS eywa_crm_sessions (
 token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS eywa_crm_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS eywa_crm_settings (id INTEGER PRIMARY KEY CHECK(id=1), data_json TEXT NOT NULL);
INSERT OR IGNORE INTO eywa_crm_settings VALUES(1,'{"loadingMinutes":30,"setupMinutes":60,"cleanupMinutes":45,"travelMinutes":30,"reviewEnabled":true,"reviewUrl":"https://search.google.com/local/writereview?placeid=ChIJzVp-mvUAbgUR1IO2D4738BY","reviewDelayDays":1}');
CREATE TABLE IF NOT EXISTS eywa_crm_events (
 id TEXT PRIMARY KEY, quote_id TEXT, booking_id TEXT UNIQUE, data_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','completed','cancelled')),
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 review_eligible INTEGER NOT NULL DEFAULT 0, review_state TEXT NOT NULL DEFAULT 'off',
 CHECK(ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS eywa_crm_tasks (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES eywa_crm_events(id), title TEXT NOT NULL,
 due_date TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)),
 completed_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS eywa_crm_resources (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('staff','equipment')),
 name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 notes TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
INSERT OR IGNORE INTO eywa_crm_resources VALUES('louis','staff','Louis',1,'',1);
INSERT OR IGNORE INTO eywa_crm_resources VALUES('bar-eywa','equipment','Bar EYWA',1,'',1);
INSERT OR IGNORE INTO eywa_crm_resources VALUES('machine-cafe','equipment','Machine à café',1,'',1);
CREATE TABLE IF NOT EXISTS eywa_crm_assignments (
 event_id TEXT NOT NULL REFERENCES eywa_crm_events(id), resource_id TEXT NOT NULL REFERENCES eywa_crm_resources(id),
 quantity INTEGER NOT NULL CHECK(quantity>0), starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL,
 PRIMARY KEY(event_id,resource_id)
);
CREATE TABLE IF NOT EXISTS eywa_crm_blocks (
 id TEXT PRIMARY KEY, from_date TEXT NOT NULL, to_date TEXT NOT NULL, label TEXT NOT NULL,
 event_id TEXT REFERENCES eywa_crm_events(id), CHECK(to_date>=from_date)
);
CREATE TABLE IF NOT EXISTS eywa_crm_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, entity TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS eywa_crm_events_time ON eywa_crm_events(status,starts_at);
CREATE INDEX IF NOT EXISTS eywa_crm_tasks_due ON eywa_crm_tasks(done,due_date);
CREATE INDEX IF NOT EXISTS eywa_crm_assignment_time ON eywa_crm_assignments(resource_id,starts_at,ends_at);
CREATE INDEX IF NOT EXISTS eywa_crm_block_time ON eywa_crm_blocks(from_date,to_date);
-- La réservation publique et un blocage manuel se vérifient dans la même transaction SQLite.
CREATE TRIGGER IF NOT EXISTS eywa_crm_block_booking BEFORE INSERT ON eywa_booking_days
WHEN EXISTS(SELECT 1 FROM eywa_crm_blocks WHERE from_date<=NEW.day AND to_date>=NEW.day)
BEGIN SELECT RAISE(ABORT,'CRM_DATE_BLOCKED'); END;
CREATE TRIGGER IF NOT EXISTS eywa_crm_block_overlap BEFORE INSERT ON eywa_crm_blocks
WHEN EXISTS(SELECT 1 FROM eywa_booking_days b WHERE day>=NEW.from_date AND day<=NEW.to_date AND NOT EXISTS(SELECT 1 FROM eywa_crm_events e WHERE e.id=NEW.event_id AND e.booking_id=b.booking_id))
BEGIN SELECT RAISE(ABORT,'BOOKING_DATE_CONFLICT'); END;
CREATE TRIGGER IF NOT EXISTS eywa_crm_blocks_overlap BEFORE INSERT ON eywa_crm_blocks
WHEN EXISTS(SELECT 1 FROM eywa_crm_blocks b WHERE b.id<>NEW.id AND b.from_date<=NEW.to_date AND b.to_date>=NEW.from_date)
BEGIN SELECT RAISE(ABORT,'CRM_DATE_CONFLICT'); END;
