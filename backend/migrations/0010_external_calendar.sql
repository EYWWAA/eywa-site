-- Copie en lecture seule de Google Agenda. Aucun paiement ni e-mail client.
CREATE TABLE IF NOT EXISTS eywa_crm_calendar_state (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0,
 mode TEXT NOT NULL DEFAULT 'eywa' CHECK(mode IN ('eywa','busy')),
 last_success INTEGER, last_attempt INTEGER, last_error TEXT
);
INSERT OR IGNORE INTO eywa_crm_calendar_state(id) VALUES(1);
CREATE TABLE IF NOT EXISTS eywa_crm_calendar_events (
 id TEXT PRIMARY KEY, data_json TEXT NOT NULL, starts_at INTEGER NOT NULL,
 ends_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active',
 last_seen TEXT NOT NULL, CHECK(ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS eywa_crm_calendar_days (
 event_id TEXT NOT NULL REFERENCES eywa_crm_calendar_events(id), day TEXT NOT NULL,
 PRIMARY KEY(event_id,day)
);
CREATE INDEX IF NOT EXISTS eywa_crm_calendar_by_day ON eywa_crm_calendar_days(day);
CREATE TRIGGER IF NOT EXISTS eywa_crm_calendar_booking BEFORE INSERT ON eywa_booking_days
WHEN EXISTS(SELECT 1 FROM eywa_crm_calendar_days WHERE day=NEW.day)
BEGIN SELECT RAISE(ABORT,'GOOGLE_CALENDAR_BUSY'); END;
CREATE TRIGGER IF NOT EXISTS eywa_crm_calendar_manual BEFORE INSERT ON eywa_crm_blocks
WHEN EXISTS(SELECT 1 FROM eywa_crm_calendar_days WHERE day>=NEW.from_date AND day<=NEW.to_date)
BEGIN SELECT RAISE(ABORT,'GOOGLE_CALENDAR_BUSY'); END;
