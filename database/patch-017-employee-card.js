/**
 * Faz 1: Personel kartı genişletme — idempotent migration
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasCol(conn, table, col) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col]
  );
  return Number(r[0] && r[0].c) > 0;
}

async function addCol(conn, table, ddl, added) {
  const col = ddl.match(/^`?([a-zA-Z0-9_]+)`?/);
  const name = col && col[1];
  if (!name) throw new Error('addCol: column adi cikarilamadi');
  if (await hasCol(conn, table, name)) return;
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  added.push(`${table}.${name}`);
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
    const added = [];

    await addCol(conn, 'employees', 'first_name VARCHAR(100) NOT NULL DEFAULT \'\' AFTER full_name', added);
    await addCol(conn, 'employees', 'last_name VARCHAR(100) NOT NULL DEFAULT \'\' AFTER first_name', added);
    await addCol(conn, 'employees', 'nationality VARCHAR(20) NULL AFTER last_name', added);
    await addCol(conn, 'employees', 'photo_path VARCHAR(255) NULL AFTER nationality', added);
    await addCol(
      conn,
      'employees',
      "salary_currency ENUM('UZS','USD') NOT NULL DEFAULT 'UZS' AFTER photo_path",
      added
    );
    await addCol(conn, 'employees', 'salary_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER salary_currency', added);
    await addCol(
      conn,
      'employees',
      'official_salary_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER salary_amount',
      added
    );
    await addCol(
      conn,
      'employees',
      'unofficial_salary_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER official_salary_amount',
      added
    );
    await addCol(conn, 'employees', 'country VARCHAR(50) NULL AFTER unofficial_salary_amount', added);
    await addCol(conn, 'employees', 'region_or_city VARCHAR(100) NULL AFTER country', added);
    await addCol(conn, 'employees', 'address_line TEXT NULL AFTER region_or_city', added);

    await conn.query(`
      UPDATE employees SET
        first_name = TRIM(SUBSTRING_INDEX(full_name, ' ', 1)),
        last_name = TRIM(SUBSTRING(full_name, LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 2))
      WHERE (first_name IS NULL OR first_name = '')
        AND full_name IS NOT NULL
        AND TRIM(full_name) <> ''
    `);

    await conn.query(`
      UPDATE employees SET
        full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
      WHERE first_name IS NOT NULL OR last_name IS NOT NULL
    `);

    await conn.query(`
      UPDATE employees SET unofficial_salary_amount = salary_amount - official_salary_amount
    `);

    try {
      await conn.query('ALTER TABLE employees MODIFY COLUMN employee_no VARCHAR(20) NULL');
    } catch (_) {
      /* tip uyumsuzlugu vb. */
    }

    const [prsRows] = await conn.query(
      `SELECT employee_no FROM employees WHERE employee_no IS NOT NULL AND employee_no LIKE 'PRS-%'`
    );
    let seq = 0;
    for (const pr of prsRows) {
      const m = String(pr.employee_no || '').match(/^PRS-(\d+)$/i);
      if (m) seq = Math.max(seq, parseInt(m[1], 10));
    }

    const [missingNo] = await conn.query(`
      SELECT id FROM employees
      WHERE employee_no IS NULL OR TRIM(employee_no) = ''
      ORDER BY id ASC
    `);
    for (const row of missingNo) {
      seq += 1;
      const no = `PRS-${String(seq).padStart(3, '0')}`;
      await conn.query('UPDATE employees SET employee_no = ? WHERE id = ?', [no, row.id]);
    }

    try {
      await conn.query('ALTER TABLE employees ADD KEY idx_employees_nationality (nationality)');
    } catch (_) {
      /* exists */
    }
    try {
      await conn.query('ALTER TABLE employees ADD KEY idx_employees_country (country)');
    } catch (_) {
      /* exists */
    }
    try {
      await conn.query('ALTER TABLE employees ADD KEY idx_employees_region (region_or_city)');
    } catch (_) {
      /* exists */
    }

    // eslint-disable-next-line no-console
    console.log('[patch-017] tamamlandi. Yeni kolonlar:', added.join(', ') || 'yok');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-017]', e);
  process.exit(1);
});
