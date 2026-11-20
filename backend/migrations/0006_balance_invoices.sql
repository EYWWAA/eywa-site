-- Factures de solde : paiements reçus via le lien de paiement (20/11/2026).
CREATE TABLE IF NOT EXISTS eywa_balance_payments (
 token TEXT PRIMARY KEY, session_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, paid_at INTEGER NOT NULL
);
