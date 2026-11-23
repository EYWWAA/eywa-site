-- Date d'expiration des devis (décision de Louis du 23/11/2026) : 14 jours après l'envoi,
-- au plus tard la veille de l'événement à minuit. Les devis ouverts existants en reçoivent une aussi.
ALTER TABLE eywa_quote_state ADD COLUMN expires_at INTEGER;
UPDATE eywa_quote_state SET expires_at=MIN(created_at+14*86400000,event_at-86400000) WHERE status='open' AND expires_at IS NULL;
