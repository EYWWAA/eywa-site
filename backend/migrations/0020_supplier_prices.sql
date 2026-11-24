-- Prix par quantité des fournisseurs (texte « 100=158.35;200=163.45 », en euros HT) et retrait d'Exaprint et de Limpack.
ALTER TABLE eywa_crm_suppliers ADD COLUMN prices TEXT NOT NULL DEFAULT '';
UPDATE eywa_crm_suppliers SET prices='50=114.53;100=158.35;150=160.91;200=163.45;250=166.01;300=184.30;500=257.47;1000=304.70' WHERE id='vistaprint-cups';
UPDATE eywa_crm_suppliers SET prices='100=120.22;200=206.50;300=299.75;400=386.50;500=439.25;1000=743;2000=1423.75' WHERE id='unicup-cups';
DELETE FROM eywa_crm_suppliers WHERE id IN ('exaprint-cups','limpack-cups');
