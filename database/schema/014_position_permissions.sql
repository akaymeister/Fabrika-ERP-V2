-- Super Admin yetki matrisi icin HR pozisyonu -> izin baglantisi
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS position_permissions (
  position_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (position_id, permission_id),
  KEY idx_pp_permission (permission_id),
  CONSTRAINT fk_pp_position FOREIGN KEY (position_id) REFERENCES positions (id) ON DELETE CASCADE,
  CONSTRAINT fk_pp_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
