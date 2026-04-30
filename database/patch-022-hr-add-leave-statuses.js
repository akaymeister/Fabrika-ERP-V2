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

async function upsertStatus(conn, code, name, sortOrder, multiplierEnabled) {
  await conn.query(
    `INSERT INTO hr_work_statuses (code, name, is_active, sort_order${multiplierEnabled ? ', multiplier' : ''})
     VALUES (?, ?, 1, ?${multiplierEnabled ? ', ?' : ''})
     ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = 1${
       multiplierEnabled ? ', multiplier = VALUES(multiplier)' : ''
     }`,
    multiplierEnabled ? [code, name, sortOrder, code === 'unpaid_leave' || code === 'absent' ? 0 : 1] : [code, name, sortOrder]
  );
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
    const multiplierEnabled = await hasColumn(conn, 'hr_work_statuses', 'multiplier');
    await upsertStatus(conn, 'paid_leave', 'UCRETLI IZIN', 30, multiplierEnabled);
    await upsertStatus(conn, 'unpaid_leave', 'UCRETSIZ IZIN', 40, multiplierEnabled);
    // eslint-disable-next-line no-console
    console.log('[patch-022] paid/unpaid leave status kodlari eklendi');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-022]', e);
  process.exit(1);
});

