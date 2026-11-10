-- Preserve the original files when an existing document is reformatted.
-- Prices, payment records, invoice numbers and saved JSON are not changed.
CREATE TABLE IF NOT EXISTS eywa_document_layout_archive (
 kind TEXT NOT NULL CHECK(kind IN ('quote','invoice')),
 document_id TEXT NOT NULL,
 layout_version TEXT NOT NULL,
 pdf_base64 TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(kind,document_id,layout_version)
);
