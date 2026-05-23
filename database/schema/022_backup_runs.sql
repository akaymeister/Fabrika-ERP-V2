-- Manuel veritabanı yedekleme geçmişi (süper yönetici)

CREATE TABLE IF NOT EXISTS backup_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  triggered_by VARCHAR(16) NOT NULL DEFAULT 'manual' COMMENT 'manual',
  user_id INT UNSIGNED NULL,
  status ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL COMMENT 'BACKUP_ROOT altında göreli yol',
  file_size_bytes BIGINT UNSIGNED NULL,
  includes_uploads TINYINT(1) NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_backup_status (status),
  KEY idx_backup_started (started_at),
  KEY idx_backup_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Manuel DB yedekleri; dosyalar backups/ altında, public servis edilmez.';
