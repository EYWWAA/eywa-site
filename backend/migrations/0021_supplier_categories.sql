-- Fournisseurs : deux nouveaux types (panneaux de devanture déjà couverts par « bar-wrap », consommables nouveau). On reconstruit la table car SQLite ne modifie pas une contrainte CHECK.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE eywa_crm_suppliers_new (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
 url TEXT NOT NULL DEFAULT '', min_quantity INTEGER, max_quantity INTEGER,
 lead_days INTEGER, preferred INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 10,
 active INTEGER NOT NULL DEFAULT 1, notes TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '',
 prices TEXT NOT NULL DEFAULT '',
 CHECK(category IN ('cups-printed','cups-plain','stickers','bar-wrap','foam','consumables')),
 CHECK(min_quantity IS NULL OR min_quantity>=1),
 CHECK(max_quantity IS NULL OR max_quantity>=min_quantity),
 CHECK(lead_days IS NULL OR lead_days BETWEEN 0 AND 180)
);
INSERT INTO eywa_crm_suppliers_new(id,name,category,url,min_quantity,max_quantity,lead_days,preferred,priority,active,notes,source_url,prices)
 SELECT id,name,category,url,min_quantity,max_quantity,lead_days,preferred,priority,active,notes,source_url,prices FROM eywa_crm_suppliers;
DROP TABLE eywa_crm_suppliers;
ALTER TABLE eywa_crm_suppliers_new RENAME TO eywa_crm_suppliers;
INSERT OR IGNORE INTO eywa_crm_suppliers(id,name,category,url,lead_days,notes,prices) VALUES
('wirliebendruck-forex','WirliebenDruck','bar-wrap','https://www.wirliebendruck.de/hartschaumplatten-bedrucken.html?lang=fr',6,'Panneau Forex blanc 3 mm, 117 × 81 cm, impression toute la surface. Relevé du 24/11/2026.
Prix HT, TVA allemande 19 % en plus. Black Week -15 % en cours : 97,68 €. En 4 jours ouvrés : 125,36 €.','1=114.92'),
('metro-consumables','Metro','consumables','https://www.metro.fr',0,'Sirops, chocolat, laits (vache, avoine), snacks. Achats déjà faits chez eux pour les événements.',''),
('cafes-oce-consumables','Cafés Océ','consumables','',NULL,'Torréfacteur prévu pour les événements de janvier. Prix et conditions à renseigner.','');
