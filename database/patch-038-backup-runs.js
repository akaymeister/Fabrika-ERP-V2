/**
 * patch-038 — backup_runs tablosu (manuel yedekleme geçmişi)
 */
const path = require('path');
const mysql = require('mysql2/promise');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasTable(conn, tableName) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [tableName]
  );
  return Number(r[0] && r[0].c) > 0;
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

  try {
    if (await hasTable(conn, 'backup_runs')) {
      // eslint-disable-next-line no-console
      console.log('[patch-038] backup_runs zaten var — atlandı');
      return;
    }

    const sqlPath = path.join(__dirname, 'schema', '022_backup_runs.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await conn.query(sql);
    // eslint-disable-next-line no-console
    console.log('[patch-038] backup_runs oluşturuldu');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-038]', e);
  process.exit(1);
});
