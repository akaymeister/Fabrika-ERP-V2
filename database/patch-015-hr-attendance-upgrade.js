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

async function hasTable(conn, table) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table]
  );
  return Number(r[0] && r[0].c) > 0;
}

async function hasFk(conn, name) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?',
    [name]
  );
  return Number(r[0] && r[0].c) > 0;
}

async function hasIndex(conn, table, idx) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [table, idx]
  );
  return Number(r[0] && r[0].c) > 0;
}

async function addCol(conn, table, col, ddl, added) {
  if (await hasCol(conn, table, col)) return;
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  added.push(`${table}.${col}`);
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
    await addCol(conn, 'employee_attendance', 'project_id', 'project_id INT UNSIGNED NULL AFTER work_date', added);
    await addCol(
      conn,
      'employee_attendance',
      'work_type',
      "work_type VARCHAR(32) NOT NULL DEFAULT 'normal' AFTER project_id",
      added
    );
    await addCol(conn, 'employee_attendance', 'total_hours', 'total_hours DECIMAL(6,2) NOT NULL DEFAULT 0.00 AFTER work_status', added);

    await conn.query(
      `ALTER TABLE employee_attendance
       MODIFY COLUMN work_status ENUM('worked', 'absent', 'leave', 'sick_leave', 'half_day', 'overtime') NOT NULL DEFAULT 'worked'`
    );

    if (!(await hasTable(conn, 'attendance_month_locks'))) {
      await conn.query(
        `CREATE TABLE attendance_month_locks (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          month_key CHAR(7) NOT NULL COMMENT 'YYYY-MM',
          is_locked TINYINT(1) NOT NULL DEFAULT 1,
          locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          locked_by INT UNSIGNED NULL,
          unlocked_at DATETIME NULL,
          unlocked_by INT UNSIGNED NULL,
          note VARCHAR(500) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_attendance_month_lock (month_key),
          CONSTRAINT fk_att_lock_locked_by FOREIGN KEY (locked_by) REFERENCES users (id) ON DELETE SET NULL,
          CONSTRAINT fk_att_lock_unlocked_by FOREIGN KEY (unlocked_by) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );
      added.push('attendance_month_locks');
    }

    if (!(await hasFk(conn, 'fk_employee_attendance_project'))) {
      await conn.query(
        'ALTER TABLE employee_attendance ADD CONSTRAINT fk_employee_attendance_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL'
      );
    }
    if (!(await hasIndex(conn, 'employee_attendance', 'idx_employee_attendance_project'))) {
      await conn.query('ALTER TABLE employee_attendance ADD KEY idx_employee_attendance_project (project_id)');
    }
    if (!(await hasIndex(conn, 'employee_attendance', 'idx_employee_attendance_work_type'))) {
      await conn.query('ALTER TABLE employee_attendance ADD KEY idx_employee_attendance_work_type (work_type)');
    }

    await conn.query(
      `INSERT INTO permissions (perm_key, name, description)
       VALUES ('hr.attendance.unlock', 'Puantaj kilit açma', 'Kilitli ay puantajını açabilir')
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`
    );
    await conn.query(
      `INSERT IGNORE INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r
       CROSS JOIN permissions p
       WHERE r.slug = 'super_admin' AND p.perm_key = 'hr.attendance.unlock'`
    );

    console.log('[patch-015] tamamlandi. Eklenen alanlar:', added.join(', ') || 'yok');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[patch-015]', e);
  process.exit(1);
});

