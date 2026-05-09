/**
 * patch-028 — `employees` tablosuna resmi maaş için para birimi ve kur kolonları.
 *
 * Eklenen kolonlar:
 *  - official_salary_currency  VARCHAR(8)   NULL   (UZS / USD)
 *  - official_salary_fx_rate   DECIMAL(18,6) NULL  (sistem para birimine kur, ileride formülde kullanılacak)
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasColumn(conn, table, col) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col]
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
    const adds = [];
    if (!(await hasColumn(conn, 'employees', 'official_salary_currency'))) {
      await conn.query(
        "ALTER TABLE employees ADD COLUMN official_salary_currency VARCHAR(8) NULL AFTER official_salary_amount"
      );
      adds.push('official_salary_currency');
    }
    if (!(await hasColumn(conn, 'employees', 'official_salary_fx_rate'))) {
      await conn.query(
        'ALTER TABLE employees ADD COLUMN official_salary_fx_rate DECIMAL(18,6) NULL AFTER official_salary_currency'
      );
      adds.push('official_salary_fx_rate');
    }
    // Backfill: official_salary_currency boşsa salary_currency'yi kullan, fx için 1.0
    await conn.query(
      "UPDATE employees SET official_salary_currency = COALESCE(NULLIF(TRIM(official_salary_currency), ''), salary_currency) WHERE official_salary_currency IS NULL OR TRIM(official_salary_currency) = ''"
    );
    await conn.query(
      'UPDATE employees SET official_salary_fx_rate = 1 WHERE official_salary_fx_rate IS NULL'
    );
    // eslint-disable-next-line no-console
    console.log('[patch-028] eklenen sütunlar:', adds.length ? adds.join(', ') : 'yok');
    // eslint-disable-next-line no-console
    console.log('[patch-028] tamam');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-028]', e);
  process.exit(1);
});
