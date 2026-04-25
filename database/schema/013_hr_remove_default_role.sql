-- IK rol onerisi kaldirma: positions.default_role_id alanini/fk/index temizle
SET NAMES utf8mb4;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'positions'
    AND CONSTRAINT_NAME = 'fk_positions_default_role'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_drop_fk := IF(
  @fk_exists > 0,
  'ALTER TABLE positions DROP FOREIGN KEY fk_positions_default_role',
  'SELECT 1'
);
PREPARE stmt_drop_fk FROM @sql_drop_fk;
EXECUTE stmt_drop_fk;
DEALLOCATE PREPARE stmt_drop_fk;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'positions'
    AND INDEX_NAME = 'idx_positions_default_role'
);
SET @sql_drop_idx := IF(
  @idx_exists > 0,
  'ALTER TABLE positions DROP INDEX idx_positions_default_role',
  'SELECT 1'
);
PREPARE stmt_drop_idx FROM @sql_drop_idx;
EXECUTE stmt_drop_idx;
DEALLOCATE PREPARE stmt_drop_idx;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'positions'
    AND COLUMN_NAME = 'default_role_id'
);
SET @sql_drop_col := IF(
  @col_exists > 0,
  'ALTER TABLE positions DROP COLUMN default_role_id',
  'SELECT 1'
);
PREPARE stmt_drop_col FROM @sql_drop_col;
EXECUTE stmt_drop_col;
DEALLOCATE PREPARE stmt_drop_col;
