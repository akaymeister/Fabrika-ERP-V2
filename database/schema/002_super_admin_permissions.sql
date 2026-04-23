-- Süper yönetici + merkezi yetkiler (rol ve kullanıcı ek izinleri)
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  perm_key VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_key (perm_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_rp_permission (permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  KEY idx_up_permission (permission_id),
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_up_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Rol: süper yönetici
INSERT IGNORE INTO roles (name, slug) VALUES
  ('Süper Yönetici', 'super_admin');

-- İzin kataloğu
INSERT INTO permissions (perm_key, name, description) VALUES
  ('admin.full',         'Tam yönetim',               'Süper yönetici: tüm sistem'),
  ('users.read',         'Kullanıcıları görüntüle',  'Kullanıcı listesi'),
  ('users.create',       'Kullanıcı oluştur',         NULL),
  ('users.update',       'Kullanıcı düzenle',         NULL),
  ('users.delete',       'Kullanıcı sil / pasif',     NULL),
  ('roles.read',         'Rolleri görüntüle',         NULL),
  ('roles.assign',       'Rol atama / izin yönetimi',  NULL),
  ('module.stock',       'Stok modülü',              NULL),
  ('module.purchasing',  'Satınalma modülü',         NULL),
  ('module.projects',    'Proje modülü',              NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

-- super_admin: katalogdaki tüm izinler
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'super_admin';
