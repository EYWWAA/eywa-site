-- Notes de la fiche contact (plusieurs par contact, épinglables), rattachées à la clé du contact (e-mail ou nom).
CREATE TABLE IF NOT EXISTS eywa_crm_contact_notes (
 id TEXT PRIMARY KEY, contact_key TEXT NOT NULL, body TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS eywa_crm_contact_notes_by_contact ON eywa_crm_contact_notes(contact_key,created_at);
