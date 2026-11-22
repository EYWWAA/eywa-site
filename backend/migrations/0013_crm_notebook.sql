-- Carnet : tâches, idées et mémo du business.
CREATE TABLE IF NOT EXISTS eywa_crm_notes (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '', due_date TEXT,
 recurring INTEGER NOT NULL DEFAULT 0, done_on TEXT, position INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS eywa_crm_notes_kind ON eywa_crm_notes(kind,status);
