-- Satınalma modülü: tedarikçi, satır tabloları, sipariş, mal kabul, yetkiler
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(300) NOT NULL,
  contact VARCHAR(300) NULL,
  tax_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  unit_code VARCHAR(32) NULL,
  line_note VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pri_request (request_id),
  KEY idx_pri_product (product_id),
  CONSTRAINT fk_pri_request FOREIGN KEY (request_id) REFERENCES purchase_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_pri_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code VARCHAR(32) NULL,
  supplier_id INT UNSIGNED NOT NULL,
  project_id INT UNSIGNED NULL,
  order_date DATE NOT NULL,
  delivery_date DATE NULL,
  payment_terms VARCHAR(200) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'UZS',
  status VARCHAR(20) NOT NULL DEFAULT 'ordered',
  note VARCHAR(2000) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_po_code (order_code),
  KEY idx_po_supplier (supplier_id),
  KEY idx_po_status (status),
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_po_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL,
  CONSTRAINT fk_po_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  request_item_id INT UNSIGNED NULL,
  product_id INT UNSIGNED NOT NULL,
  qty_ordered DECIMAL(18,4) NOT NULL,
  unit_price DECIMAL(18,4) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'UZS',
  fx_rate DECIMAL(18,6) NULL COMMENT 'Yabancı para kuru; UZS/SYSTEM için uygulama 1 yazar',
  qty_received DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  line_note VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_poi_order (order_id),
  KEY idx_poi_ri (request_item_id),
  KEY idx_poi_product (product_id),
  CONSTRAINT fk_poi_order FOREIGN KEY (order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_poi_ri FOREIGN KEY (request_item_id) REFERENCES purchase_request_items (id) ON DELETE SET NULL,
  CONSTRAINT fk_poi_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goods_receipts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_code VARCHAR(32) NULL,
  purchase_order_id INT UNSIGNED NOT NULL,
  warehouse_id INT UNSIGNED NULL,
  waybill_number VARCHAR(120) NULL,
  received_by INT UNSIGNED NULL,
  note VARCHAR(2000) NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_gr_code (receipt_code),
  KEY idx_gr_po (purchase_order_id),
  KEY idx_gr_wh (warehouse_id),
  CONSTRAINT fk_gr_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id),
  CONSTRAINT fk_gr_user FOREIGN KEY (received_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  goods_receipt_id INT UNSIGNED NOT NULL,
  order_item_id INT UNSIGNED NOT NULL,
  qty_waybill DECIMAL(18,4) NULL,
  qty_accepted DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  qty_rejected DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  qty_damaged DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  line_note VARCHAR(1000) NULL,
  stock_movement_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_gri_gr (goods_receipt_id),
  KEY idx_gri_oi (order_item_id),
  CONSTRAINT fk_gri_gr FOREIGN KEY (goods_receipt_id) REFERENCES goods_receipts (id) ON DELETE CASCADE,
  CONSTRAINT fk_gri_oi FOREIGN KEY (order_item_id) REFERENCES purchase_order_items (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO permissions (perm_key, name, description) VALUES
  ('module.purchasing.receipt', 'Mal kabul (satınalma)', 'Siparişe göre depo girişi, fiyatsız')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.perm_key = 'module.purchasing' AND r.slug IN ('admin', 'yonetici', 'satin_almaci');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.perm_key = 'module.purchasing.receipt' AND r.slug IN ('depocu', 'admin', 'yonetici', 'satin_almaci');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.perm_key = 'module.purchasing.receipt' AND r.slug = 'super_admin';
