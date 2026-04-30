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
    if (!(await hasColumn(conn, 'hr_work_statuses', 'multiplier'))) {
      await conn.query(
        'ALTER TABLE hr_work_statuses ADD COLUMN multiplier DECIMAL(6,2) NOT NULL DEFAULT 1.00 AFTER sort_order'
      );
    }

    await conn.query(
      `UPDATE hr_work_statuses
       SET multiplier = CASE code
         WHEN 'worked' THEN 1.00
         WHEN 'paid_leave' THEN 1.00
         WHEN 'unpaid_leave' THEN 0.00
         WHEN 'half_day' THEN 0.50
         WHEN 'overtime' THEN 1.50
         WHEN 'absent' THEN 0.00
         WHEN 'leave' THEN 0.00
         WHEN 'sick_leave' THEN 0.00
         ELSE IFNULL(multiplier, 1.00)
       END`
    );

    // eslint-disable-next-line no-console
    console.log('[patch-021] hr_work_statuses.multiplier hazır');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-021]', e);
  process.exit(1);
});

