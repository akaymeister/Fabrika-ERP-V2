/**
 * staff taşıyıcı rolü (pozisyonlu kullanıcılar için users.role_id FK)
 * Idempotent: INSERT IGNORE + staff için role_permissions temizliği
 */
const mysql = require('mysql2/promise');
const path = require('path');
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

  await conn.query("INSERT IGNORE INTO roles (name, slug) VALUES ('PERSONEL', 'staff')");
  await conn.query(`
    DELETE rp FROM role_permissions rp
    INNER JOIN roles r ON r.id = rp.role_id AND r.slug = 'staff'
  `);

  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[patch-016] staff rolü hazır.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-016] Hata:', e.message);
  process.exit(1);
});
