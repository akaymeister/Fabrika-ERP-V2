/**
 * Bordro: ay bazında sabitlenen USD/UZS kuru (1 USD = X UZS).
 * attendance_month_locks.payroll_usd_uzs_rate — kilit anında yazılır, tahakkukta önceliklidir.
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasColumn(conn, tableName, columnName) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tableName, columnName]
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
    if (await hasColumn(conn, 'attendance_month_locks', 'payroll_usd_uzs_rate')) {
      console.log('[patch-030] attendance_month_locks.payroll_usd_uzs_rate already exists, skip');
      return;
    }
    await conn.query(`
      ALTER TABLE attendance_month_locks
      ADD COLUMN payroll_usd_uzs_rate DECIMAL(18,6) NULL
        COMMENT 'Kilit anı: 1 USD = X UZS (resmi UZS / resmi olmayan USD bordro kuralı)'
        AFTER note
    `);
    console.log('[patch-030] Added attendance_month_locks.payroll_usd_uzs_rate');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
