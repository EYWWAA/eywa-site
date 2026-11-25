-- Secteur d'activité du prospect (demande de Louis du 25/11/2026) : sert à classer la liste
-- et à afficher les événements types du secteur dans la fiche.
ALTER TABLE eywa_crm_prospects ADD COLUMN sector TEXT NOT NULL DEFAULT '';
