/**
 * Tüm database/schema/*.sql dosyalarını ad sırasıyla uygular.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const dir = path.join(__dirname, 'schema');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!files.length) {
    // eslint-disable-next-line no-console
    console.error('[migrate] schema klasöründe .sql yok');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  for (const file of files) {
    const sqlPath = path.join(dir, file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    // eslint-disable-next-line no-console
    console.log('[migrate] Uygulanıyor:', sqlPath);
    await conn.query(sql);
  }

  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[migrate] Tamamlandı.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] Hata:', e.message);
  process.exit(1);
});
