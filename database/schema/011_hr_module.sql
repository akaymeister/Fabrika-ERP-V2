-- IK modulu Faz 1A: departments, positions, employees, employee_attendance, module.hr yetkisi
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NULL,
  name VARCHAR(200) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (code),
  KEY idx_departments_name (name),
  KEY idx_departments_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS positions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_id INT UNSIGNED NOT NULL,
  code VARCHAR(32) NULL,
  name VARCHAR(200) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_positions_code (code),
  KEY idx_positions_department (department_id),
  KEY idx_positions_active (is_active),
  CONSTRAINT fk_positions_department FOREIGN KEY (department_id) REFERENCES departments (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_no VARCHAR(20) NULL,
  full_name VARCHAR(200) NOT NULL,
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  nationality VARCHAR(20) NULL,
  birth_date DATE NULL,
  gender ENUM('male', 'female', 'other') NULL,
  marital_status ENUM('single', 'married', 'divorced', 'widowed') NULL,
  photo_path VARCHAR(255) NULL,
  salary_currency ENUM('UZS', 'USD') NOT NULL DEFAULT 'UZS',
  salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  official_salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  unofficial_salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  country VARCHAR(50) NULL,
  region_or_city VARCHAR(100) NULL,
  address_line TEXT NULL,
  phone VARCHAR(64) NULL,
  phone_secondary VARCHAR(64) NULL,
  identity_no VARCHAR(64) NULL,
  passport_no VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  hire_date DATE NOT NULL,
  employment_status ENUM('active', 'passive', 'terminated') NOT NULL DEFAULT 'active',
  department_id INT UNSIGNED NULL,
  position_id INT UNSIGNED NULL,
  user_id INT UNSIGNED NULL,
  note VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_no (employee_no),
  UNIQUE KEY uq_employees_user (user_id),
  KEY idx_employees_status (employment_status),
  KEY idx_employees_department (department_id),
  KEY idx_employees_position (position_id),
  KEY idx_employees_nationality (nationality),
  KEY idx_employees_country (country),
  KEY idx_employees_region (region_or_city),
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_position FOREIGN KEY (position_id) REFERENCES positions (id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id INT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  project_id INT UNSIGNED NULL,
  work_type ENUM('normal', 'assembly', 'production', 'shipment', 'office', 'other') NOT NULL DEFAULT 'normal',
  check_in_time TIME NULL,
  check_out_time TIME NULL,
  work_status ENUM('worked', 'absent', 'leave', 'sick_leave', 'half_day', 'overtime') NOT NULL DEFAULT 'worked',
  total_hours DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  overtime_hours DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  note VARCHAR(1000) NULL,
  created_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_attendance_one_day (employee_id, work_date),
  KEY idx_employee_attendance_date (work_date),
  KEY idx_employee_attendance_project (project_id),
  KEY idx_employee_attendance_work_type (work_type),
  KEY idx_employee_attendance_status (work_status),
  CONSTRAINT fk_employee_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_employee_attendance_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL,
  CONSTRAINT fk_employee_attendance_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_employee_attendance_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_month_locks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  month_key CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  is_locked TINYINT(1) NOT NULL DEFAULT 1,
  locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_by INT UNSIGNED NULL,
  unlocked_at DATETIME NULL,
  unlocked_by INT UNSIGNED NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_month_lock (month_key),
  CONSTRAINT fk_att_lock_locked_by FOREIGN KEY (locked_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_att_lock_unlocked_by FOREIGN KEY (unlocked_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO permissions (perm_key, name, description) VALUES
  ('module.hr', 'IK modulu', 'Personel, organizasyon ve devam takip')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.perm_key = 'module.hr' AND r.slug IN ('admin', 'yonetici');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.perm_key = 'module.hr' AND r.slug = 'super_admin';
