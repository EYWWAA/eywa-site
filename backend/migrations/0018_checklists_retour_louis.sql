-- Checklists corrigées par Louis (23/11/2026) :
-- le remerciement est automatique, plus de « prochaine date », plus de stocks la veille (café et lait se prennent 2 jours avant),
-- et le retour à chaud avec le client entre dans le brief du jour J.
DELETE FROM eywa_crm_checklist_items WHERE id IN ('da-04','da-06','da-07');
INSERT OR IGNORE INTO eywa_crm_checklist_items(id,checklist_id,label,offset_days,position) VALUES('da-08','default-admin','Aller chercher le café et le lait',-2,4);
INSERT OR IGNORE INTO eywa_crm_checklist_items(id,checklist_id,stage,label,position) VALUES('db-28','default-brief','cleanup','Retour à chaud avec le client : ce qui lui a plu, ce qu’on peut améliorer',100);
INSERT OR IGNORE INTO eywa_crm_checklist_items(id,checklist_id,stage,label,position) VALUES('db-29','default-brief','cleanup','Avis Google : « si vous avez aimé, ça m’aiderait beaucoup », QR code en main',101);
INSERT OR IGNORE INTO eywa_crm_checklist_items(id,checklist_id,stage,label,position) VALUES('db-30','default-brief','cleanup','Demander l’accord du client pour publier les photos (locaux, logo)',102);
-- Événements à venir : retirer les anciennes tâches non faites, ajouter les nouvelles.
DELETE FROM eywa_crm_tasks WHERE done=0 AND (id LIKE '%:cl:da-04' OR id LIKE '%:cl:da-06' OR id LIKE '%:cl:da-07');
INSERT OR IGNORE INTO eywa_crm_tasks(id,event_id,title,due_date,created_at)
 SELECT e.id||':cl:da-08',e.id,'Aller chercher le café et le lait',MAX(date(json_extract(e.data_json,'$.date'),'-2 days'),date('now')),CAST(strftime('%s','now') AS INTEGER)*1000
 FROM eywa_crm_events e WHERE e.status NOT IN ('cancelled','completed') AND json_extract(e.data_json,'$.date')>=date('now');
INSERT OR IGNORE INTO eywa_crm_brief_items(id,event_id,stage,label,quantity,unit,position,created_at)
 SELECT e.id||':cl:'||i.id,e.id,i.stage,i.label,i.quantity,i.unit,i.position,CAST(strftime('%s','now') AS INTEGER)*1000
 FROM eywa_crm_events e,eywa_crm_checklist_items i WHERE i.id IN ('db-28','db-29','db-30') AND e.status NOT IN ('cancelled','completed') AND json_extract(e.data_json,'$.date')>=date('now')
 AND EXISTS(SELECT 1 FROM eywa_crm_brief_items b WHERE b.event_id=e.id);
UPDATE eywa_crm_tasks SET title='Commander la devanture (habillage) du bar',due_date=MAX(date((SELECT json_extract(data_json,'$.date') FROM eywa_crm_events WHERE id=eywa_crm_tasks.event_id),'-14 days'),date('now')) WHERE id LIKE '%:bar' AND done=0;
UPDATE eywa_crm_settings SET data_json=json_set(data_json,'$.reviewDelayDays',3) WHERE id=1;
