-- Project Control / Project Operations Core (faz-1)
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS project_boq_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id INT UNSIGNED NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  discipline_type VARCHAR(64) NULL,
  status ENUM('active', 'archived', 'draft') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_pbd_project (project_id),
  KEY idx_pbd_status (status),
  KEY idx_pbd_deleted (deleted_at),
  CONSTRAINT fk_pbd_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_pbd_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_boq_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  boq_document_id BIGINT UNSIGNED NOT NULL,
  revision_no INT UNSIGNED NOT NULL DEFAULT 1,
  revision_note VARCHAR(1000) NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_path VARCHAR(500) NOT NULL,
  is_active_revision TINYINT(1) NOT NULL DEFAULT 1,
  uploaded_by INT UNSIGNED NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  row_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('active', 'archived', 'draft') NOT NULL DEFAULT 'active',
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pbr_doc_rev (boq_document_id, revision_no),
  KEY idx_pbr_document (boq_document_id),
  KEY idx_pbr_active (is_active_revision),
  KEY idx_pbr_deleted (deleted_at),
  CONSTRAINT fk_pbr_document FOREIGN KEY (boq_document_id) REFERENCES project_boq_documents (id) ON DELETE CASCADE,
  CONSTRAINT fk_pbr_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_boq_columns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  boq_revision_id BIGINT UNSIGNED NOT NULL,
  column_key VARCHAR(128) NOT NULL,
  column_label VARCHAR(255) NOT NULL,
  column_hint VARCHAR(1000) NULL,
  column_order INT UNSIGNED NOT NULL DEFAULT 0,
  data_type ENUM('text', 'number', 'date', 'select', 'boolean', 'json') NOT NULL DEFAULT 'text',
  is_price_usd TINYINT(1) NOT NULL DEFAULT 0,
  is_price_uzs TINYINT(1) NOT NULL DEFAULT 0,
  is_visible_default TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pbc_revision_colkey (boq_revision_id, column_key),
  KEY idx_pbc_revision (boq_revision_id),
  CONSTRAINT fk_pbc_revision FOREIGN KEY (boq_revision_id) REFERENCES project_boq_revisions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_work_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id INT UNSIGNED NOT NULL,
  boq_document_id BIGINT UNSIGNED NOT NULL,
  boq_revision_id BIGINT UNSIGNED NOT NULL,
  stable_row_uid VARCHAR(64) NOT NULL,
  source_row_no INT UNSIGNED NULL,
  seq_no INT UNSIGNED NULL,
  title VARCHAR(300) NULL,
  location_floor VARCHAR(128) NULL,
  room_no VARCHAR(128) NULL,
  mahal VARCHAR(255) NULL,
  product_name VARCHAR(300) NULL,
  quantity DECIMAL(18,4) NULL,
  unit VARCHAR(64) NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'pending',
  progress DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  priority VARCHAR(32) NOT NULL DEFAULT 'normal',
  assigned_employee_id INT UNSIGNED NULL,
  department_id INT UNSIGNED NULL,
  planned_start_date DATE NULL,
  planned_end_date DATE NULL,
  actual_start_date DATE NULL,
  actual_end_date DATE NULL,
  notes VARCHAR(2000) NULL,
  dynamic_data_json JSON NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pwi_project (project_id),
  KEY idx_pwi_revision (boq_revision_id),
  KEY idx_pwi_document (boq_document_id),
  KEY idx_pwi_assignee (assigned_employee_id),
  KEY idx_pwi_department (department_id),
  KEY idx_pwi_status (status),
  KEY idx_pwi_deleted (is_deleted),
  KEY idx_pwi_uid (stable_row_uid),
  CONSTRAINT fk_pwi_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_pwi_document FOREIGN KEY (boq_document_id) REFERENCES project_boq_documents (id) ON DELETE CASCADE,
  CONSTRAINT fk_pwi_revision FOREIGN KEY (boq_revision_id) REFERENCES project_boq_revisions (id) ON DELETE CASCADE,
  CONSTRAINT fk_pwi_assignee FOREIGN KEY (assigned_employee_id) REFERENCES employees (id) ON DELETE SET NULL,
  CONSTRAINT fk_pwi_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL,
  CONSTRAINT fk_pwi_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_pwi_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_work_item_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_item_id BIGINT UNSIGNED NOT NULL,
  employee_id INT UNSIGNED NOT NULL,
  assigned_by INT UNSIGNED NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_pwia_workitem (work_item_id),
  KEY idx_pwia_employee (employee_id),
  KEY idx_pwia_active (is_active),
  CONSTRAINT fk_pwia_workitem FOREIGN KEY (work_item_id) REFERENCES project_work_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_pwia_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
  CONSTRAINT fk_pwia_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_work_item_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_item_id BIGINT UNSIGNED NOT NULL,
  changed_by INT UNSIGNED NULL,
  change_type VARCHAR(32) NOT NULL,
  field_name VARCHAR(128) NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pwih_workitem (work_item_id),
  KEY idx_pwih_changed_at (changed_at),
  CONSTRAINT fk_pwih_workitem FOREIGN KEY (work_item_id) REFERENCES project_work_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_pwih_changed_by FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_work_item_department_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_item_id BIGINT UNSIGNED NOT NULL,
  department_id INT UNSIGNED NOT NULL,
  phase_key VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'pending',
  progress DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  owner_employee_id INT UNSIGNED NULL,
  planned_start_date DATE NULL,
  planned_end_date DATE NULL,
  actual_start_date DATE NULL,
  actual_end_date DATE NULL,
  notes VARCHAR(2000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pwidt_workitem (work_item_id),
  KEY idx_pwidt_department (department_id),
  KEY idx_pwidt_owner (owner_employee_id),
  CONSTRAINT fk_pwidt_workitem FOREIGN KEY (work_item_id) REFERENCES project_work_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_pwidt_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE CASCADE,
  CONSTRAINT fk_pwidt_owner FOREIGN KEY (owner_employee_id) REFERENCES employees (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO permissions (perm_key, name, description) VALUES
  ('projects.control.view', 'Proje kontrol goruntule', 'Project Control ekranini goruntuleme'),
  ('projects.control.boq.upload', 'BOQ yukleme', 'Proje kontrol BOQ dosyasi yukleme'),
  ('projects.control.boq.delete', 'BOQ silme', 'Proje kontrol BOQ silme'),
  ('projects.control.boq.edit', 'BOQ duzenleme', 'Proje kontrol BOQ/work item duzenleme'),
  ('projects.control.assign_person', 'Kisi atama', 'Work item satirina personel atama'),
  ('projects.control.price.usd.view', 'USD fiyat kolon goruntuleme', 'USD fiyat kolonlarini goruntuleme'),
  ('projects.control.price.uzs.view', 'UZS fiyat kolon goruntuleme', 'UZS fiyat kolonlarini goruntuleme'),
  ('projects.control.price.edit', 'Fiyat duzenleme', 'Fiyat kolonlari duzenleme'),
  ('projects.control.export', 'Project control export', 'Project control disa aktarim'),
  ('projects.control.export.with_prices', 'Project control fiyatli export', 'Fiyat kolonlariyla disa aktarim'),
  ('projects.control.revision.activate', 'Revizyon aktiflestirme', 'BOQ revizyonunu aktiflestirme')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.perm_key IN (
  'projects.control.view',
  'projects.control.boq.upload',
  'projects.control.boq.delete',
  'projects.control.boq.edit',
  'projects.control.assign_person',
  'projects.control.price.usd.view',
  'projects.control.price.uzs.view',
  'projects.control.price.edit',
  'projects.control.export',
  'projects.control.export.with_prices',
  'projects.control.revision.activate'
)
WHERE r.slug IN ('super_admin', 'admin');
