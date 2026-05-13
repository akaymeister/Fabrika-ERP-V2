/**
 * patch-034 — Faz 3B: employee_month_payroll_snapshot + employee_month_payroll_adjustments
 *
 * Uygulama kodu bu aşamada snapshot üretmez; yalnızca şema.
 * Idempotent: tablolar varsa CREATE atlanır; FK yoksa ve referans güvenliyse eklenir.
 *
 * npm run db:migrate zincirinde çalıştırılır.
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

async function hasColumn(conn, tableName, columnName) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tableName, columnName]
  );
  return Number(r[0] && r[0].c) > 0;
}

async function hasFk(conn, constraintName) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?',
    [constraintName]
  );
  return Number(r[0] && r[0].c) > 0;
}

/**
 * Referans tablo + kolon var mı; FK zaten var mı. Hata olursa false ve rapora yazar.
 * ON DELETE CASCADE kullanılmaz.
 */
async function tryAddForeignKey(conn, rapor, { constraintName, sql, needs }) {
  if (await hasFk(conn, constraintName)) {
    rapor.push({ constraint: constraintName, durum: 'zaten_var' });
    return true;
  }
  for (const { table, column } of needs) {
    if (!(await hasTable(conn, table))) {
      rapor.push({
        constraint: constraintName,
        durum: 'atlandi',
        sebep: `referans_tablo_yok: ${table}`,
      });
      return false;
    }
    if (!(await hasColumn(conn, table, column))) {
      rapor.push({
        constraint: constraintName,
        durum: 'atlandi',
        sebep: `referans_kolon_yok: ${table}.${column}`,
      });
      return false;
    }
  }
  try {
    await conn.query(sql);
    rapor.push({ constraint: constraintName, durum: 'eklendi' });
    return true;
  } catch (e) {
    rapor.push({
      constraint: constraintName,
      durum: 'hata',
      sebep: e && e.message ? String(e.message) : String(e),
      code: e && e.code,
    });
    return false;
  }
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

  /** @type {object[]} */
  const fkRapor = [];

  try {
    if (!(await hasTable(conn, 'employee_month_payroll_snapshot'))) {
      await conn.query(`
        CREATE TABLE employee_month_payroll_snapshot (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          month_key CHAR(7) NOT NULL COMMENT 'YYYY-MM',
          employee_id INT UNSIGNED NOT NULL,
          generation SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Tam satir supersede zinciri',
          attendance_lock_id BIGINT UNSIGNED NOT NULL,
          compensation_history_id BIGINT UNSIGNED NULL,
          effective_from DATE NULL,
          effective_to DATE NULL,
          salary_currency VARCHAR(8) NOT NULL DEFAULT 'UZS',
          salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
          official_salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
          unofficial_salary_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
          official_salary_currency VARCHAR(8) NULL,
          official_salary_fx_rate DECIMAL(18, 6) NULL,
          payroll_usd_uzs_rate_used DECIMAL(18, 6) NOT NULL COMMENT 'Kilit aninda kullanilan 1 USD = X UZS',
          breakdown_json JSON NULL,
          input_fingerprint CHAR(64) NULL,
          frozen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          frozen_by_user_id INT UNSIGNED NULL,
          freeze_reason VARCHAR(64) NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_emp_month_payroll_snap (month_key, employee_id, generation),
          KEY idx_emp_month_payroll_snap_month (month_key),
          KEY idx_emp_month_payroll_snap_emp (employee_id),
          KEY idx_emp_month_payroll_snap_lock (attendance_lock_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // eslint-disable-next-line no-console
      console.log('[patch-034] employee_month_payroll_snapshot olusturuldu');
    } else {
      // eslint-disable-next-line no-console
      console.log('[patch-034] employee_month_payroll_snapshot zaten var, CREATE atlandi');
    }

    if (!(await hasTable(conn, 'employee_month_payroll_adjustments'))) {
      await conn.query(`
        CREATE TABLE employee_month_payroll_adjustments (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          snapshot_id BIGINT UNSIGNED NOT NULL,
          month_key CHAR(7) NOT NULL COMMENT 'YYYY-MM',
          employee_id INT UNSIGNED NOT NULL,
          adjustment_type VARCHAR(32) NOT NULL,
          delta_official_uzs DECIMAL(18, 2) NULL,
          delta_unofficial_uzs DECIMAL(18, 2) NULL,
          delta_amount_usd DECIMAL(18, 6) NULL,
          currency_mode VARCHAR(16) NOT NULL DEFAULT 'mixed',
          reason VARCHAR(500) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by_user_id INT UNSIGNED NULL,
          dispute_id INT UNSIGNED NULL,
          PRIMARY KEY (id),
          KEY idx_payroll_adj_snapshot (snapshot_id),
          KEY idx_payroll_adj_month_emp (month_key, employee_id),
          KEY idx_payroll_adj_dispute (dispute_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      // eslint-disable-next-line no-console
      console.log('[patch-034] employee_month_payroll_adjustments olusturuldu');
    } else {
      // eslint-disable-next-line no-console
      console.log('[patch-034] employee_month_payroll_adjustments zaten var, CREATE atlandi');
    }

    await tryAddForeignKey(conn, fkRapor, {
      constraintName: 'fk_emp_month_snap_employee',
      sql: `ALTER TABLE employee_month_payroll_snapshot
            ADD CONSTRAINT fk_emp_month_snap_employee
            FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT`,
      needs: [
        { table: 'employees', column: 'id' },
      ],
    });

    await tryAddForeignKey(conn, fkRapor, {
      constraintName: 'fk_emp_month_snap_lock',
      sql: `ALTER TABLE employee_month_payroll_snapshot
            ADD CONSTRAINT fk_emp_month_snap_lock
            FOREIGN KEY (attendance_lock_id) REFERENCES attendance_month_locks (id) ON DELETE RESTRICT`,
      needs: [
        { table: 'attendance_month_locks', column: 'id' },
      ],
    });

    await tryAddForeignKey(conn, fkRapor, {
      constraintName: 'fk_emp_month_snap_frozen_by',
      sql: `ALTER TABLE employee_month_payroll_snapshot
            ADD CONSTRAINT fk_emp_month_snap_frozen_by
            FOREIGN KEY (frozen_by_user_id) REFERENCES users (id) ON DELETE SET NULL`,
      needs: [
        { table: 'users', column: 'id' },
      ],
    });

    await tryAddForeignKey(conn, fkRapor, {
      constraintName: 'fk_emp_month_snap_comp_hist',
      sql: `ALTER TABLE employee_month_payroll_snapshot
            ADD CONSTRAINT fk_emp_month_snap_comp_hist
            FOREIGN KEY (compensation_history_id) REFERENCES employee_compensation_history (id) ON DELETE SET NULL`,
      needs: [
        { table: 'employee_compensation_history', column: 'id' },
      ],
    });

    await tryAddForeignKey(conn, fkRapor, {
      constraintName: 'fk_payroll_adj_snapshot',
      sql: `ALTER TABLE employee_month_payroll_adjustments
            ADD CONSTRAINT fk_payroll_adj_snapshot
            FOREIGN KEY (snapshot_id) REFERENCES employee_month_payroll_snapshot (id) ON DELETE RESTRICT`,
      needs: [
        { table: 'employee_month_payroll_snapshot', column: 'id' },
      ],
    });

    await tryAddForeignKey(conn, fkRapor, {
      constraintName: 'fk_payroll_adj_employee',
      sql: `ALTER TABLE employee_month_payroll_adjustments
            ADD CONSTRAINT fk_payroll_adj_employee
            FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT`,
      needs: [
        { table: 'employees', column: 'id' },
      ],
    });

    await tryAddForeignKey(conn, fkRapor, {
      constraintName: 'fk_payroll_adj_created_by',
      sql: `ALTER TABLE employee_month_payroll_adjustments
            ADD CONSTRAINT fk_payroll_adj_created_by
            FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL`,
      needs: [
        { table: 'users', column: 'id' },
      ],
    });

    await tryAddForeignKey(conn, fkRapor, {
      constraintName: 'fk_payroll_adj_dispute',
      sql: `ALTER TABLE employee_month_payroll_adjustments
            ADD CONSTRAINT fk_payroll_adj_dispute
            FOREIGN KEY (dispute_id) REFERENCES payroll_disputes (id) ON DELETE SET NULL`,
      needs: [
        { table: 'payroll_disputes', column: 'id' },
      ],
    });

    // eslint-disable-next-line no-console
    console.log('[patch-034] FK ozeti:', JSON.stringify(fkRapor, null, 2));
    // eslint-disable-next-line no-console
    console.log('[patch-034] tamam');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-034]', e);
  process.exit(1);
});
