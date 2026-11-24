-- Fiche entreprise du prospect (demande de Louis du 24/11/2026) : qui est l'entreprise, ses événements passés,
-- les traiteurs ou prestataires déjà utilisés, et le prochain événement probable. Liens sources dans le texte.
ALTER TABLE eywa_crm_prospects ADD COLUMN company_about TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN company_events TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN company_caterers TEXT NOT NULL DEFAULT '';
ALTER TABLE eywa_crm_prospects ADD COLUMN company_next TEXT NOT NULL DEFAULT '';
