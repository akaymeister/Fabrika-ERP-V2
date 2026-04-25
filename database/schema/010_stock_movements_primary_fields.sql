/**
 * Faz 1 (stok ana birim modeli hazırlığı):
 * - stock_movements.primary_qty
 * - stock_movements.primary_unit
 * - idx_sm_primary_unit
 *
 * Idempotent: tekrar çalıştırıldığında no-op.
 */

SET @sql := (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stock_movements'
        AND COLUMN_NAME = 'primary_qty'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE stock_movements ADD COLUMN primary_qty DECIMAL(18,4) NULL AFTER qty_pieces'
  )
);
PREPARE _sm_pf_1 FROM @sql;
EXECUTE _sm_pf_1;
DEALLOCATE PREPARE _sm_pf_1;

SET @sql := (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stock_movements'
        AND COLUMN_NAME = 'primary_unit'
    ) > 0,
    'SELECT 1',
    'ALTER TABLE stock_movements ADD COLUMN primary_unit VARCHAR(32) NULL AFTER primary_qty'
  )
);
PREPARE _sm_pf_2 FROM @sql;
EXECUTE _sm_pf_2;
DEALLOCATE PREPARE _sm_pf_2;

SET @sql := (
  SELECT IF(
    (
      SELECT COUNT(*)
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stock_movements'
        AND INDEX_NAME = 'idx_sm_primary_unit'
    ) > 0,
    'SELECT 1',
    'CREATE INDEX idx_sm_primary_unit ON stock_movements (primary_unit)'
  )
);
PREPARE _sm_pf_3 FROM @sql;
EXECUTE _sm_pf_3;
DEALLOCATE PREPARE _sm_pf_3;
