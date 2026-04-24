-- Merkezi audit / etkinlik günlüğü (kritik işlemler)
-- Silme/ güncelleme: yalnızca uygulama (ileride sadece süper yönetici okuma ekranı).

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  username VARCHAR(191) NULL,
  full_name VARCHAR(255) NULL,
  action_type VARCHAR(32) NOT NULL
    COMMENT 'CREATE, UPDATE, DELETE, LOGIN, LOGOUT, APPROVE, REJECT, STOCK_IN, STOCK_OUT, ...',
  module_name VARCHAR(32) NOT NULL
    COMMENT 'auth, users, stock, products, projects, purchasing, warehouse',
  table_name VARCHAR(128) NULL,
  record_id VARCHAR(64) NULL,
  old_data JSON NULL,
  new_data JSON NULL,
  description VARCHAR(2000) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_act_created (created_at),
  KEY idx_act_user_time (user_id, created_at),
  KEY idx_act_module_action (module_name, action_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Uygulama denetim günlüğü; kullanıcılar bu tabloya erişemez.';
