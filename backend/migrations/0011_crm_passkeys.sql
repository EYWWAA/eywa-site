-- Clés d'accès (Touch ID, Face ID, empreinte) pour l'espace EYWA. Le code par e-mail reste disponible en secours.
CREATE TABLE IF NOT EXISTS eywa_crm_passkeys (
 id TEXT PRIMARY KEY, public_key TEXT NOT NULL, sign_count INTEGER NOT NULL DEFAULT 0,
 label TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, last_used_at INTEGER
);
CREATE TABLE IF NOT EXISTS eywa_crm_webauthn (
 challenge TEXT PRIMARY KEY, kind TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0
);
