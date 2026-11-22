-- Prospection : les personnes contactées (LinkedIn, e-mail, téléphone, salon) et l'historique des échanges.
CREATE TABLE IF NOT EXISTS eywa_crm_prospects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', linkedin_url TEXT NOT NULL DEFAULT '',
 source TEXT NOT NULL DEFAULT 'linkedin', status TEXT NOT NULL DEFAULT 'contacte', next_action_date TEXT,
 notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 mail_scanned_at INTEGER NOT NULL DEFAULT 0, mail_page_token TEXT, mail_range_end INTEGER
);
CREATE INDEX IF NOT EXISTS eywa_crm_prospects_email ON eywa_crm_prospects(email);
CREATE TABLE IF NOT EXISTS eywa_crm_prospect_events (
 id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL,
 summary TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS eywa_crm_prospect_events_by_prospect ON eywa_crm_prospect_events(prospect_id,at);
