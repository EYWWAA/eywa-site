-- Répertoire des fournisseurs et suivi des commandes, sans achat automatique.
CREATE TABLE IF NOT EXISTS eywa_crm_suppliers (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
 url TEXT NOT NULL DEFAULT '', min_quantity INTEGER, max_quantity INTEGER,
 lead_days INTEGER, preferred INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 10,
 active INTEGER NOT NULL DEFAULT 1, notes TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '',
 CHECK(category IN ('cups-printed','cups-plain','stickers','bar-wrap','foam')),
 CHECK(min_quantity IS NULL OR min_quantity>=1),
 CHECK(max_quantity IS NULL OR max_quantity>=min_quantity),
 CHECK(lead_days IS NULL OR lead_days BETWEEN 0 AND 180)
);
CREATE TABLE IF NOT EXISTS eywa_crm_orders (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES eywa_crm_events(id), category TEXT NOT NULL,
 quantity INTEGER, quantity_confirmed INTEGER NOT NULL DEFAULT 0,
 supplier_id TEXT REFERENCES eywa_crm_suppliers(id),
 status TEXT NOT NULL DEFAULT 'planning', artwork_status TEXT NOT NULL DEFAULT 'needed',
 client_request TEXT NOT NULL DEFAULT '', format TEXT NOT NULL DEFAULT '',
 artwork_url TEXT NOT NULL DEFAULT '', order_reference TEXT NOT NULL DEFAULT '',
 order_url TEXT NOT NULL DEFAULT '', due_date TEXT, notes TEXT NOT NULL DEFAULT '',
 updated_at INTEGER NOT NULL, UNIQUE(event_id,category),
 CHECK(quantity IS NULL OR quantity BETWEEN 1 AND 1000000),
 CHECK(status IN ('planning','ready','ordered','received')),
 CHECK(artwork_status IN ('not-needed','needed','received','review','approved'))
);
CREATE INDEX IF NOT EXISTS eywa_crm_orders_due ON eywa_crm_orders(status,due_date);
-- Liens et noms retrouvés dans la page Notion « Eywa fournisseur » du 15/11/2026.
-- Aucune de ces pistes n’est activée comme fournisseur préféré automatiquement.
INSERT OR IGNORE INTO eywa_crm_suppliers(id,name,category,url,notes,source_url) VALUES
('papeo-cups','Papéo','cups-printed','https://www.papeo.fr/gobelet-carton','Piste notée dans Notion. Minimum, prix et délai à vérifier.','https://app.notion.com/p/40150db31fe080049beecbe56d5b0683'),
('pixeprint-cups','PixePrint','cups-printed','https://www.pixeprint.com/gobelet-personnalise-a-cappuccino-simple-paroi-22cl.html','Page produit : gobelet cappuccino simple paroi 22 cl. Minimum affiché : 250 unités. Le site annonce J+10 avec personnalisation, à reconfirmer avant commande ; aucun délai n’est imposé automatiquement.','https://www.pixeprint.com/gobelet-personnalise-a-cappuccino-simple-paroi-22cl.html'),
('monouso-cups','Monouso','cups-printed','','Piste notée dans Notion. Produit et lien de commande à préciser.','https://app.notion.com/p/40150db31fe080049beecbe56d5b0683'),
('vistaprint-cups','Vistaprint','cups-printed','','Piste « Visaprint » notée dans Notion. Produit et lien à confirmer.','https://app.notion.com/p/40150db31fe080049beecbe56d5b0683'),
('coverpack-cups','Coverpack','cups-printed','','Note Notion : 1 000 unités. Conditions actuelles et produit à vérifier.','https://app.notion.com/p/40150db31fe080049beecbe56d5b0683'),
('unicup-cups','Unicup','cups-printed','','Piste notée « rapide » dans Notion. Délai et lien à confirmer.','https://app.notion.com/p/40150db31fe080049beecbe56d5b0683'),
('wirliebendruck-cups','WirliebenDruck','cups-printed','','Piste notée dans Notion. Produit, lien et conditions à vérifier.','https://app.notion.com/p/40150db31fe080049beecbe56d5b0683'),
('exaprint-cups','Exaprint','cups-printed','','Piste notée dans Notion. Produit, lien et conditions à vérifier.','https://app.notion.com/p/40150db31fe080049beecbe56d5b0683'),
('limpack-cups','Limpack','cups-printed','','Note Notion : minimum 1 000 unités, à reconfirmer avant commande.','https://app.notion.com/p/40150db31fe080049beecbe56d5b0683'),
('boutique-jetable-cups','La Boutique du Jetable','cups-plain','https://www.laboutiquedujetable.fr/products/gobelet-carton-lamine-pla-double-paroi-kraft-230-ml-diam-8-cm-8-x-5-5-x-9-cm-6-unites','Lien noté dans Notion : gobelet kraft double paroi 230 ml. Conditionnement et disponibilité à vérifier.','https://app.notion.com/p/40150db31fe080049beecbe56d5b0683');
UPDATE eywa_crm_suppliers SET min_quantity=250 WHERE id='pixeprint-cups' AND min_quantity IS NULL;
