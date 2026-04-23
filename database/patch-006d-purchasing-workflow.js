/**
 * Satınalma iş akışı: onay alanları, rol izinleri (talep aç / onay)
 * node database/patch-006d-purchasing-workflow.js
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasCol(conn, table, col) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col]
  );
  return r[0].c > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  if (!(await hasCol(conn, 'purchase_requests', 'status_message'))) {
    await conn.query(
      'ALTER TABLE purchase_requests ADD COLUMN status_message VARCHAR(2000) NULL COMMENT "Red/revizyon gerekçesi" AFTER note'
    );
    // eslint-disable-next-line no-console
    console.log('[006d] status_message eklendi');
  }
  if (!(await hasCol(conn, 'purchase_requests', 'decided_by'))) {
    await conn.query(
      'ALTER TABLE purchase_requests ADD COLUMN decided_by INT UNSIGNED NULL COMMENT "Onaylayan" AFTER pr_status'
    );
    // eslint-disable-next-line no-console
    console.log('[006d] decided_by eklendi');
  }
  if (!(await hasCol(conn, 'purchase_requests', 'decided_at'))) {
    await conn.query('ALTER TABLE purchase_requests ADD COLUMN decided_at DATETIME NULL AFTER decided_by');
    // eslint-disable-next-line no-console
    console.log('[006d] decided_at eklendi');
  }

  await conn.query(
    `INSERT INTO permissions (perm_key, name, description) VALUES
     ('module.purchasing.request', 'Satınalma talebi aç', 'Talep formu, taslak, gönderim (fiyatsız)'),
     ('module.purchasing.approve', 'Satınalma talebi onayla', 'Talep inceleme, onay/red/revizyon')
     ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`
  );
  // eslint-disable-next-line no-console
  console.log('[006d] permissions eklendi');

  // module.purchasing yetkisi olanlara: talep aç
  await conn.query(
    `INSERT IGNORE INTO role_permissions (role_id, permission_id)
     SELECT rp.role_id, p2.id
     FROM role_permissions rp
     INNER JOIN permissions p1 ON p1.id = rp.permission_id AND p1.perm_key = 'module.purchasing'
     CROSS JOIN permissions p2 ON p2.perm_key = 'module.purchasing.request'`
  );

  // Onay: yönetici, admin, super_admin (satınalmacı ayrı ekranda sipariş işler, bu izin sadece onay)
  await conn.query(
    `INSERT IGNORE INTO role_permissions (role_id, permission_id)
     SELECT r.id, p.id
     FROM roles r
     CROSS JOIN permissions p
     WHERE p.perm_key = 'module.purchasing.approve'
       AND r.slug IN ('admin', 'yonetici', 'super_admin')`
  );

  // super_admin: yeni izinler (kataloga eklenen her şey zaten tüm id’ler; emin olmak için)
  await conn.query(
    `INSERT IGNORE INTO role_permissions (role_id, permission_id)
     SELECT r.id, p.id
     FROM roles r
     CROSS JOIN permissions p
     WHERE r.slug = 'super_admin' AND p.perm_key IN ('module.purchasing.request', 'module.purchasing.approve')`
  );

  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[006d] Bitti.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[006d]', e.message);
  process.exit(1);
});
