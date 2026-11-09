CREATE TABLE IF NOT EXISTS eywa_quotes (
 id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, data_json TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS eywa_email_outbox (
 id TEXT PRIMARY KEY, recipient TEXT NOT NULL, payload_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent')),
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0, provider_id TEXT, last_error TEXT,
 created_at INTEGER NOT NULL, sent_at INTEGER
);
CREATE INDEX IF NOT EXISTS eywa_email_pending ON eywa_email_outbox(status,next_attempt);
CREATE TABLE IF NOT EXISTS eywa_email_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL);
