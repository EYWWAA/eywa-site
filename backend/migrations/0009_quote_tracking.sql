-- Suivi interne : les documents financiers d’origine restent inchangés.
CREATE TABLE IF NOT EXISTS eywa_crm_quote_tracking (
 quote_id TEXT PRIMARY KEY REFERENCES eywa_quotes(id),
 stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','waiting','lost')),
 notes TEXT NOT NULL DEFAULT '', next_action_date TEXT, version INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS eywa_crm_mail_drafts (
 id TEXT PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES eywa_quotes(id),
 subject TEXT NOT NULL, body_text TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued')),
 version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS eywa_crm_one_open_draft ON eywa_crm_mail_drafts(quote_id) WHERE status='draft';
