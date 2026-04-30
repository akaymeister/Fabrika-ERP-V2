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
    if (!(await hasColumn(conn, 'employees', 'overtime_eligible'))) {
      await conn.query('ALTER TABLE employees ADD COLUMN overtime_eligible TINYINT(1) NOT NULL DEFAULT 0 AFTER employment_status');
    }
    if (!(await hasColumn(conn, 'employee_attendance', 'raw_overtime_minutes'))) {
      await conn.query(
        'ALTER TABLE employee_attendance ADD COLUMN raw_overtime_minutes INT NOT NULL DEFAULT 0 AFTER overtime_hours'
      );
    }
    if (!(await hasColumn(conn, 'employee_attendance', 'payable_overtime_minutes'))) {
      await conn.query(
        'ALTER TABLE employee_attendance ADD COLUMN payable_overtime_minutes INT NOT NULL DEFAULT 0 AFTER raw_overtime_minutes'
      );
    }

    await conn.query(
      `UPDATE employee_attendance a
       INNER JOIN employees e ON e.id = a.employee_id
       SET a.raw_overtime_minutes = IFNULL(a.raw_overtime_minutes, ROUND(IFNULL(a.overtime_hours, 0) * 60)),
           a.payable_overtime_minutes = CASE
             WHEN IFNULL(e.overtime_eligible, 0) = 1 THEN IFNULL(a.raw_overtime_minutes, ROUND(IFNULL(a.overtime_hours, 0) * 60))
             ELSE 0
           END,
           a.overtime_hours = CASE
             WHEN IFNULL(e.overtime_eligible, 0) = 1
               THEN ROUND((IFNULL(a.raw_overtime_minutes, ROUND(IFNULL(a.overtime_hours, 0) * 60)) / 60), 2)
             ELSE 0
           END`
    );

    // eslint-disable-next-line no-console
    console.log('[patch-023] overtime eligibility alanlari eklendi');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-023]', e);
  process.exit(1);
});

