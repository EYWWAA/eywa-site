-- Rendez-vous visio envoyés aux prospects et demandes de changement de créneau.
CREATE TABLE IF NOT EXISTS eywa_crm_meetings (
 id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL, start_at INTEGER NOT NULL, minutes INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'scheduled', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS eywa_crm_meeting_requests (
 id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL, proposed_at INTEGER NOT NULL, message TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, decided_at INTEGER
);
CREATE INDEX IF NOT EXISTS eywa_crm_meeting_requests_by_meeting ON eywa_crm_meeting_requests(meeting_id,status);
