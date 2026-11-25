-- Budget estimé du prospect (demande de Louis du 25/11/2026) : A gros budget, B correct, C faible, vide = non noté.
ALTER TABLE eywa_crm_prospects ADD COLUMN budget TEXT NOT NULL DEFAULT '';
