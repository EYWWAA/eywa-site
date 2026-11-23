-- Fiche d'appel prospect (demande de Louis du 23/11/2026) : prénom et nom séparés, adresse,
-- liens photos (lieu et événements passés), l'événement visé (nom, date, invités) et le texte d'appel.
ALTER TABLE eywa_crm_prospects ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN photos_url TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN event_photos_url TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN event_name TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN event_date TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN event_guests TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN pitch TEXT NOT NULL DEFAULT '';
