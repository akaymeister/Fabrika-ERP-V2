-- Project Control hardening: indexes + constraints (idempotent)
SET NAMES utf8mb4;

SET @db_name = DATABASE();

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @db_name
    AND table_name = 'project_work_items'
    AND index_name = 'idx_pwi_revision_deleted_seq'
);
SET @sql = IF(
  @idx_exists = 0,
  'ALTER TABLE project_work_items ADD INDEX idx_pwi_revision_deleted_seq (boq_revision_id, is_deleted, seq_no, id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @uq_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @db_name
    AND table_name = 'project_work_items'
    AND index_name = 'uq_pwi_revision_uid'
);
SET @sql = IF(
  @uq_exists = 0,
  'ALTER TABLE project_work_items ADD UNIQUE KEY uq_pwi_revision_uid (boq_revision_id, stable_row_uid)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
