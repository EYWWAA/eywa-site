-- Suppression d'un événement sans le recréer à la synchronisation, et lieu des rendez-vous.
ALTER TABLE eywa_crm_events ADD COLUMN deleted_at INTEGER;
ALTER TABLE eywa_crm_meetings ADD COLUMN place TEXT NOT NULL DEFAULT '';
