-- purchase_order_items.fx_rate — satır döviz kuru (patch-014 ile uyumlu tip).
-- Idempotent: kolon zaten varsa hata vermez.
SET NAMES utf8mb4;

SET @sql := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'fx_rate') > 0,
    'SELECT 1',
    'ALTER TABLE purchase_order_items ADD COLUMN fx_rate DECIMAL(18,6) NULL COMMENT ''Yabancı para kuru; UZS/SYSTEM için uygulama 1 yazar'' AFTER currency'
  )
);
PREPARE _poi_fx_1 FROM @sql;
EXECUTE _poi_fx_1;
DEALLOCATE PREPARE _poi_fx_1;
