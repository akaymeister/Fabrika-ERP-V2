-- Project control: column input metadata
SET NAMES utf8mb4;

SET @db_name = DATABASE();

SET @has_input_type = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'project_boq_columns'
    AND column_name = 'input_type'
);

SET @sql_input_type = IF(
  @has_input_type = 0,
  "ALTER TABLE project_boq_columns ADD COLUMN input_type ENUM('dropdown','toggle','date','text','number','currency','readonly') NOT NULL DEFAULT 'text' AFTER column_hint",
  'SELECT 1'
);

PREPARE stmt_input_type FROM @sql_input_type;
EXECUTE stmt_input_type;
DEALLOCATE PREPARE stmt_input_type;

SET @has_options_json = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'project_boq_columns'
    AND column_name = 'options_json'
);

SET @sql_options_json = IF(
  @has_options_json = 0,
  'ALTER TABLE project_boq_columns ADD COLUMN options_json JSON NULL AFTER input_type',
  'SELECT 1'
);

PREPARE stmt_options_json FROM @sql_options_json;
EXECUTE stmt_options_json;
DEALLOCATE PREPARE stmt_options_json;
