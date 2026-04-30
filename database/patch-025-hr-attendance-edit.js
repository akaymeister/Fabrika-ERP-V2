const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    await conn.query(
      `INSERT INTO permissions (perm_key, name, description)
       VALUES ('hr.attendance.edit', 'Puantaj düzenleme', 'Günlük ve tekil puantaj kayıtlarını oluşturma/güncelleme')
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`
    );

    await conn.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r
       CROSS JOIN permissions p
       WHERE r.slug IN ('super_admin', 'admin') AND p.perm_key = 'hr.attendance.edit'`
    );

    // eslint-disable-next-line no-console
    console.log('[patch-025] hr.attendance.edit eklendi (super_admin, admin)');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-025]', e);
  process.exit(1);
});
