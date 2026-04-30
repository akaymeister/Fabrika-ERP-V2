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
      ['hr.compensation.view', 'Ücret değerlendirme görüntüleme', 'Ücret artışı / değerlendirme ekranını görüntüleme'],
      ['hr.compensation.edit', 'Ücret değerlendirme düzenleme', 'Zam oranı ve taslak alanlarında düzenleme'],
      ['hr.compensation.apply', 'Ücret değerlendirme uygulama', 'Öneriyi personel kartına uygulama (ileride)'],
      ['hr.payroll.view', 'Bordro görüntüleme', 'Bordro yönetimi sayfası'],
      ['hr.payroll.edit', 'Bordro düzenleme', 'Bordro işlemleri (ileride)'],
    ];
    for (const [key, name, desc] of perms) {
      // eslint-disable-next-line no-await-in-loop
      await conn.query(
        `INSERT INTO permissions (perm_key, name, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
        [key, name, desc]
      );
    }

    await conn.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r
       CROSS JOIN permissions p
       WHERE r.slug IN ('super_admin', 'admin')
         AND p.perm_key IN (
           'hr.compensation.view',
           'hr.compensation.edit',
           'hr.compensation.apply',
           'hr.payroll.view',
           'hr.payroll.edit'
         )`
    );

    // eslint-disable-next-line no-console
    console.log('[patch-026] compensation/payroll yetkileri guncellendi');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-026]', e);
  process.exit(1);
});
