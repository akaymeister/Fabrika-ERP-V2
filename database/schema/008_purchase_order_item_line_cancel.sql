-- Sipariş kalemi iptali (satınalma işleme); talep tarafına otomatik dönüş yok.
-- Idempotent: tekrar çalıştırıldığında mevcut kolon/indeks/FK için hata vermez.
SET NAMES utf8mb4;

SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'line_status') > 0,
    'SELECT 1',
    'ALTER TABLE purchase_order_items ADD COLUMN line_status VARCHAR(20) NOT NULL DEFAULT ''active'' COMMENT ''active|cancelled'' AFTER qty_received'
  )
);
PREPARE _poi_lc_1 FROM @sql;
EXECUTE _poi_lc_1;
DEALLOCATE PREPARE _poi_lc_1;

SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'cancel_reason') > 0,
    'SELECT 1',
    'ALTER TABLE purchase_order_items ADD COLUMN cancel_reason VARCHAR(2000) NULL AFTER line_note'
  )
);
PREPARE _poi_lc_2 FROM @sql;
EXECUTE _poi_lc_2;
DEALLOCATE PREPARE _poi_lc_2;

SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'cancelled_at') > 0,
    'SELECT 1',
    'ALTER TABLE purchase_order_items ADD COLUMN cancelled_at DATETIME NULL AFTER cancel_reason'
  )
);
PREPARE _poi_lc_3 FROM @sql;
EXECUTE _poi_lc_3;
DEALLOCATE PREPARE _poi_lc_3;

SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'cancelled_by') > 0,
    'SELECT 1',
    'ALTER TABLE purchase_order_items ADD COLUMN cancelled_by INT UNSIGNED NULL AFTER cancelled_at'
  )
);
PREPARE _poi_lc_4 FROM @sql;
EXECUTE _poi_lc_4;
DEALLOCATE PREPARE _poi_lc_4;

SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND INDEX_NAME = 'idx_poi_line_status') > 0,
    'SELECT 1',
    'ALTER TABLE purchase_order_items ADD KEY idx_poi_line_status (line_status)'
  )
);
PREPARE _poi_lc_5 FROM @sql;
EXECUTE _poi_lc_5;
DEALLOCATE PREPARE _poi_lc_5;

SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items'
       AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_poi_cancelled_by') > 0,
    'SELECT 1',
    'ALTER TABLE purchase_order_items ADD CONSTRAINT fk_poi_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE SET NULL'
  )
);
PREPARE _poi_lc_6 FROM @sql;
EXECUTE _poi_lc_6;
DEALLOCATE PREPARE _poi_lc_6;
