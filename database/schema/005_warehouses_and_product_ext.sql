-- Depo (ana) + alt kategori; ürün: derinlik, m3, kur, zorunlu depo
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS warehouses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wh_sort (sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouse_subcategories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  warehouse_id INT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wsc_wh (warehouse_id, sort_order),
  CONSTRAINT fk_wsc_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Varsayılan depo (patch/migration backfill)
INSERT INTO warehouses (id, name, sort_order) VALUES (1, 'Genel depo', 0)
  ON DUPLICATE KEY UPDATE name = VALUES(name);
INSERT INTO warehouse_subcategories (id, warehouse_id, name, sort_order) VALUES (1, 1, 'Genel', 0)
  ON DUPLICATE KEY UPDATE name = VALUES(name);
