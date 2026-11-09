CREATE TABLE IF NOT EXISTS eywa_quote_state (
 quote_id TEXT PRIMARY KEY REFERENCES eywa_quotes(id),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','paid','closed')),
 event_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 paid_session TEXT, paid_at INTEGER, stopped_at INTEGER
);
CREATE TABLE IF NOT EXISTS eywa_quote_pdfs (quote_id TEXT PRIMARY KEY, pdf_base64 TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS eywa_reminders (
 quote_id TEXT NOT NULL REFERENCES eywa_quotes(id), day INTEGER NOT NULL,
 due_at INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
 PRIMARY KEY(quote_id,day)
);
ALTER TABLE eywa_email_outbox ADD COLUMN quote_id TEXT;
ALTER TABLE eywa_email_outbox ADD COLUMN kind TEXT;
CREATE TABLE IF NOT EXISTS eywa_invoices (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL,
 session_id TEXT UNIQUE NOT NULL, quote_id TEXT, data_json TEXT NOT NULL,
 created_at INTEGER NOT NULL, pdf_base64 TEXT
);
CREATE TABLE IF NOT EXISTS eywa_notion_jobs (
 quote_id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 1,
 done_version INTEGER NOT NULL DEFAULT 0, page_id TEXT, contact_id TEXT,
 next_attempt INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 checked_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS eywa_sync_events (
 event_id TEXT PRIMARY KEY, quote_id TEXT NOT NULL, notion_block_id TEXT,
 data_json TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS eywa_mail_cursors (
 email TEXT PRIMARY KEY, scanned_at INTEGER NOT NULL DEFAULT 0,
 page_token TEXT, range_end INTEGER
);
CREATE TABLE IF NOT EXISTS eywa_job_locks (name TEXT PRIMARY KEY, until_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS eywa_reminders_due ON eywa_reminders(state,due_at);
CREATE INDEX IF NOT EXISTS eywa_quote_open ON eywa_quote_state(status,event_at);
