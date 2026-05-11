/**
 * patch-032 — employee_compensation_history (Faz 1 altyapı).
 * employees tablosuna dokunmaz. Mevcut kayıtlar için bir başlangıç satırı eklenir.
 *
 * effective_from: hire_date (DATE) → yoksa DATE(created_at) → yoksa CURDATE()
 */
const path = require('path');
const mysql = require('mysql2/promise');
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
    if (!(await hasTable(conn, 'employee_compensation_history'))) {
      await conn.query(`
        CREATE TABLE employee_compensation_history (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          employee_id INT UNSIGNED NOT NULL,
          effective_from DATE NOT NULL,
          effective_to DATE NULL,
          salary_currency VARCHAR(8) NOT NULL DEFAULT 'UZS',
          salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
          official_salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
          unofficial_salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
          official_salary_currency VARCHAR(8) NULL,
          official_salary_fx_rate DECIMAL(18, 6) NULL,
          reason VARCHAR(500) NULL,
          created_by INT UNSIGNED NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_emp_comp_hist_emp_effective (employee_id, effective_from),
          KEY idx_emp_comp_hist_employee (employee_id),
          KEY idx_emp_comp_hist_emp_from (employee_id, effective_from),
          CONSTRAINT fk_emp_comp_hist_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
          CONSTRAINT fk_emp_comp_hist_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // eslint-disable-next-line no-console
      console.log('[patch-032] employee_compensation_history oluşturuldu');
    } else {
      // eslint-disable-next-line no-console
      console.log('[patch-032] employee_compensation_history zaten var, CREATE atlandı');
    }

    const [ins] = await conn.query(
      `INSERT INTO employee_compensation_history (
         employee_id, effective_from, effective_to,
         salary_currency, salary_amount, official_salary_amount, unofficial_salary_amount,
         official_salary_currency, official_salary_fx_rate,
         reason, created_by
       )
       SELECT
         e.id AS employee_id,
         COALESCE(DATE(e.hire_date), DATE(e.created_at), CURDATE()) AS effective_from,
         NULL AS effective_to,
         CASE WHEN UPPER(TRIM(COALESCE(e.salary_currency, ''))) = 'USD' THEN 'USD' ELSE 'UZS' END AS salary_currency,
         e.salary_amount,
         e.official_salary_amount,
         e.unofficial_salary_amount,
         COALESCE(NULLIF(TRIM(e.official_salary_currency), ''), NULLIF(TRIM(e.salary_currency), ''), 'UZS') AS official_salary_currency,
         COALESCE(e.official_salary_fx_rate, 1) AS official_salary_fx_rate,
         'BACKFILL_INITIAL' AS reason,
         NULL AS created_by
       FROM employees e
       WHERE NOT EXISTS (
         SELECT 1 FROM employee_compensation_history h WHERE h.employee_id = e.id
       )`
    );
    // eslint-disable-next-line no-console
    console.log('[patch-032] backfill eklenen satır:', Number(ins.affectedRows || 0));
    // eslint-disable-next-line no-console
    console.log('[patch-032] tamam');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-032]', e);
  process.exit(1);
});
