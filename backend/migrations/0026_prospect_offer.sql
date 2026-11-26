-- Campagne « événement offert » à Charleville (demande de Louis du 26/11/2026) :
-- 10 à 15 entreprises à qui il offre une prestation, suivies dans une vue à part.
ALTER TABLE eywa_crm_prospects ADD COLUMN offer INTEGER NOT NULL DEFAULT 0;
