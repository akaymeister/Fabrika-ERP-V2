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
      ['hr.salary.view_group', 'Maaş kolon grubu görüntüleme'],
      ['hr.salary.view_total', 'Toplam maaş görüntüleme'],
      ['hr.salary.view_rgu_uzs', 'RGU UZS görüntüleme'],
      ['hr.salary.view_grgu_uzs', 'GRGU UZS görüntüleme'],
      ['hr.salary.view_gu_usd', 'GU USD görüntüleme'],
      ['hr.salary.view_rsu', 'RSU görüntüleme'],
      ['hr.salary.view_grsu', 'GRSU görüntüleme'],
      ['hr.salary.view_su', 'SU görüntüleme'],
    ];
    for (const [key, name] of perms) {
      // eslint-disable-next-line no-await-in-loop
      await conn.query(
        `INSERT INTO permissions (perm_key, name, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
        [key, name, name]
      );
    }

    await conn.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r
       INNER JOIN permissions p ON p.perm_key IN (
         'hr.salary.view_group',
         'hr.salary.view_total',
         'hr.salary.view_rgu_uzs',
         'hr.salary.view_grgu_uzs',
         'hr.salary.view_gu_usd',
         'hr.salary.view_rsu',
         'hr.salary.view_grsu',
         'hr.salary.view_su'
       )
       WHERE r.slug IN ('super_admin', 'admin')`
    );

    // eslint-disable-next-line no-console
    console.log('[patch-024] hr salary kolon permissionlari eklendi');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-024]', e);
  process.exit(1);
});

