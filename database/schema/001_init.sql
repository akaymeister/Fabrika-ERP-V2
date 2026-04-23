-- Fabrika ERP V2 — temel şema
-- Geliştirme sırası: kullanıcı/rol → satınalma → stok → proje → İK
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Roller (Admin, Yönetici, Satın almacı, Depocu)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Kullanıcılar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  role_id INT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Marka (stok: ürün benzersizliği ad + ölçü + marka)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_brands_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Ürün (kod: STK-00001 formatı uygulama katmanında)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_code VARCHAR(32) NOT NULL,
  name VARCHAR(300) NOT NULL,
  unit VARCHAR(64) NOT NULL COMMENT 'Ölçü birimi: m2, adet, kg, vb.',
  brand_id INT UNSIGNED NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  stock_qty DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_name_unit_brand (name, unit, brand_id),
  UNIQUE KEY uq_products_code (product_code),
  KEY idx_products_brand (brand_id),
  CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Stok hareketleri (son hareketler + ileride denetim)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  movement_type ENUM('in', 'out', 'adjustment') NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  ref_type VARCHAR(32) NULL COMMENT 'project, purchase, manual, ...',
  ref_id INT UNSIGNED NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sm_product (product_id),
  KEY idx_sm_created (created_at),
  KEY idx_sm_user (user_id),
  CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_sm_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Satın alma talepleri (Modül 3 iskeleti)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_id INT UNSIGNED NOT NULL,
  title VARCHAR(300) NOT NULL,
  status ENUM('draft','submitted','approved','rejected','fulfilled') NOT NULL DEFAULT 'draft',
  note VARCHAR(2000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pr_requester (requester_id),
  KEY idx_pr_status (status),
  CONSTRAINT fk_pr_requester FOREIGN KEY (requester_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Projeler (Modül 5: firma + kısa kod + yıl + sıra — format serviste)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_code VARCHAR(64) NOT NULL,
  company_code VARCHAR(16) NOT NULL DEFAULT 'AHKFC',
  short_code VARCHAR(32) NULL,
  sequence_no INT UNSIGNED NOT NULL DEFAULT 1,
  year SMALLINT NOT NULL,
  name VARCHAR(300) NOT NULL,
  status ENUM('draft','active','on_hold','closed') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_projects_code (project_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
