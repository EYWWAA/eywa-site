-- Idée d'événement que Louis peut proposer au prospect (demande du 25/11/2026), affichée en tête de l'onglet Entreprise.
ALTER TABLE eywa_crm_prospects ADD COLUMN company_idea TEXT NOT NULL DEFAULT '';
