-- Project control department task uniqueness
SET NAMES utf8mb4;

SET @db_name = DATABASE();

SET @uq_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = @db_name
    AND table_name = 'project_work_item_department_tasks'
    AND index_name = 'uq_pwidt_item_dep_phase'
);

SET @sql = IF(
  @uq_exists = 0,
  'ALTER TABLE project_work_item_department_tasks ADD UNIQUE KEY uq_pwidt_item_dep_phase (work_item_id, department_id, phase_key)',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
