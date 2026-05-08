-- HR puantaj: fazla mesai uygunluğu ve dakika bazlı saklama alanları (idempotent)
-- employees.overtime_eligible
-- employee_attendance.raw_overtime_minutes
-- employee_attendance.payable_overtime_minutes
SET NAMES utf8mb4;

SET @db_name = DATABASE();

-- 1) employees.overtime_eligible
SET @has_overtime_eligible = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'employees'
    AND column_name = 'overtime_eligible'
);

SET @sql_overtime_eligible = IF(
  @has_overtime_eligible = 0,
  'ALTER TABLE employees ADD COLUMN overtime_eligible TINYINT(1) NOT NULL DEFAULT 0 AFTER employment_status',
  'SELECT 1'
);

PREPARE stmt_overtime_eligible FROM @sql_overtime_eligible;
EXECUTE stmt_overtime_eligible;
DEALLOCATE PREPARE stmt_overtime_eligible;

-- 2) employee_attendance.raw_overtime_minutes
SET @has_raw_ot = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'employee_attendance'
    AND column_name = 'raw_overtime_minutes'
);

SET @sql_raw_ot = IF(
  @has_raw_ot = 0,
  'ALTER TABLE employee_attendance ADD COLUMN raw_overtime_minutes INT NOT NULL DEFAULT 0 AFTER overtime_hours',
  'SELECT 1'
);

PREPARE stmt_raw_ot FROM @sql_raw_ot;
EXECUTE stmt_raw_ot;
DEALLOCATE PREPARE stmt_raw_ot;

-- 3) employee_attendance.payable_overtime_minutes
SET @has_payable_ot = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = @db_name
    AND table_name = 'employee_attendance'
    AND column_name = 'payable_overtime_minutes'
);

SET @sql_payable_ot = IF(
  @has_payable_ot = 0,
  'ALTER TABLE employee_attendance ADD COLUMN payable_overtime_minutes INT NOT NULL DEFAULT 0 AFTER raw_overtime_minutes',
  'SELECT 1'
);

PREPARE stmt_payable_ot FROM @sql_payable_ot;
EXECUTE stmt_payable_ot;
DEALLOCATE PREPARE stmt_payable_ot;

-- 4) Mevcut kayitlar icin guvenli geri-doldurma
--    Yeni eklenen sutunlar 0 ise overtime_hours degerinden hesapla; mevcut overtime_hours degerleri korunur.
UPDATE employee_attendance
SET raw_overtime_minutes = ROUND(IFNULL(overtime_hours, 0) * 60)
WHERE raw_overtime_minutes = 0
  AND IFNULL(overtime_hours, 0) > 0;

UPDATE employee_attendance
SET payable_overtime_minutes = raw_overtime_minutes
WHERE payable_overtime_minutes = 0
  AND raw_overtime_minutes > 0;
