-- Sistem ayarları, birimler, ürün boyut + m2, stok m2+adet, FIFO katmanları, hareket para
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(64) NOT NULL,
  setting_value TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('default_currency', 'UZS'),
  ('default_locale', 'tr')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

CREATE TABLE IF NOT EXISTS units (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_units_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO units (id, code, is_system, sort_order) VALUES
  (1, 'm2', 1, 1),
  (2, 'adet', 1, 2),
  (3, 'kg', 1, 3),
  (4, 'plaka', 1, 4);

CREATE TABLE IF NOT EXISTS stock_cost_layers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  movement_in_id BIGINT UNSIGNED NOT NULL,
  qty_m2_remaining DECIMAL(18,4) NOT NULL,
  cost_uzs_per_m2 DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  cost_usd_per_m2 DECIMAL(18,6) NULL,
  input_currency CHAR(3) NOT NULL DEFAULT 'UZS',
  fx_uzs_per_usd DECIMAL(18,4) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_scl_product (product_id, id),
  KEY idx_scl_m_in (movement_in_id),
  CONSTRAINT fk_scl_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
