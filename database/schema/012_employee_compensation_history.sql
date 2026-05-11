-- IK: personel maaş versiyonları (Faz 1 şema referansı; uygulama patch-032 ile uygulanır)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS employee_compensation_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id INT UNSIGNED NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  salary_currency VARCHAR(8) NOT NULL DEFAULT 'UZS',
  salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  official_salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  unofficial_salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  official_salary_currency VARCHAR(8) NULL,
  official_salary_fx_rate DECIMAL(18, 6) NULL,
  reason VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emp_comp_hist_emp_effective (employee_id, effective_from),
  KEY idx_emp_comp_hist_employee (employee_id),
  KEY idx_emp_comp_hist_emp_from (employee_id, effective_from),
  CONSTRAINT fk_emp_comp_hist_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_emp_comp_hist_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
