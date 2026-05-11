/**
 * patch-033 — Maaş düzenleme ve geçmiş görüntüleme izinleri (Faz 1).
 * hr.salary.edit — revizyon / cache güncelleme (Faz 2'de kullanılacak)
 * hr.salary.history_view — compensation history API ve ileride UI
 */
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
    const perms = [
      ['hr.salary.edit', 'Maaş düzenleme (revizyon / cache)', 'Personel maaş revizyonu ve employees cache güncelleme (Faz 2).'],
      ['hr.salary.history_view', 'Maaş geçmişi görüntüleme', 'employee_compensation_history okuma ve liste.'],
    ];
    for (const [key, name, desc] of perms) {
      // eslint-disable-next-line no-await-in-loop
      await conn.query(
        `INSERT INTO permissions (perm_key, name, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
        [key, name, desc || name]
      );
    }

    await conn.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r
       INNER JOIN permissions p ON p.perm_key IN ('hr.salary.edit', 'hr.salary.history_view')
       WHERE r.slug IN ('super_admin', 'admin')`
    );

    // eslint-disable-next-line no-console
    console.log('[patch-033] hr.salary.edit ve hr.salary.history_view eklendi (admin / super_admin)');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-033]', e);
  process.exit(1);
});
