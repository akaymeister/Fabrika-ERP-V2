/**
 * Faz 1B: IK ayarlar modulu + dinamik is tipi / calisma durumu
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

async function ensureBaseTables(conn) {
  if (!(await hasTable(conn, 'hr_settings'))) {
    await conn.query(`
      CREATE TABLE hr_settings (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        setting_key VARCHAR(100) NOT NULL,
        setting_value VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_hr_settings_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  if (!(await hasTable(conn, 'hr_work_types'))) {
    await conn.query(`
      CREATE TABLE hr_work_types (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(64) NOT NULL,
        name VARCHAR(150) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 100,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_hr_work_types_code (code),
        KEY idx_hr_work_types_active (is_active),
        KEY idx_hr_work_types_sort (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  if (!(await hasTable(conn, 'hr_work_statuses'))) {
    await conn.query(`
      CREATE TABLE hr_work_statuses (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(64) NOT NULL,
        name VARCHAR(150) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 100,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_hr_work_statuses_code (code),
        KEY idx_hr_work_statuses_active (is_active),
        KEY idx_hr_work_statuses_sort (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}

async function alterAttendanceColumns(conn) {
  if (await hasColumn(conn, 'employee_attendance', 'work_type')) {
    await conn.query("ALTER TABLE employee_attendance MODIFY COLUMN work_type VARCHAR(64) NOT NULL DEFAULT 'normal'");
  }
  if (await hasColumn(conn, 'employee_attendance', 'work_status')) {
    await conn.query("ALTER TABLE employee_attendance MODIFY COLUMN work_status VARCHAR(64) NOT NULL DEFAULT 'worked'");
  }
}

async function seedDefaults(conn) {
  const settingDefaults = [
    ['daily_start_time', '08:00'],
    ['daily_end_time', '18:00'],
    ['break_1_minutes', '15'],
    ['break_2_minutes', '0'],
    ['break_3_minutes', '0'],
    ['lunch_minutes', '60'],
    ['holiday_days', 'sunday'],
    ['weekly_work_hours', '45'],
    ['daily_work_hours', '9'],
    ['overtime_multiplier_1', '1.25'],
    ['overtime_multiplier_2', '1.5'],
    ['overtime_multiplier_3', '2.0'],
  ];
  for (const [key, value] of settingDefaults) {
    await conn.query(
      'INSERT INTO hr_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = COALESCE(setting_value, VALUES(setting_value))',
      [key, value]
    );
  }

  const typeDefaults = [
    ['normal', 'NORMAL', 10],
    ['assembly', 'MONTAJ', 20],
    ['production', 'URETIM', 30],
    ['shipment', 'SEVKIYAT', 40],
    ['office', 'OFIS', 50],
    ['other', 'DIGER', 60],
  ];
  for (const [code, name, sortOrder] of typeDefaults) {
    await conn.query(
      'INSERT INTO hr_work_types (code, name, is_active, sort_order) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)',
      [code, name, sortOrder]
    );
  }

  const statusDefaults = [
    ['worked', 'CALISTI', 10],
    ['absent', 'GELMEDI', 20],
    ['leave', 'IZINLI', 30],
    ['sick_leave', 'RAPORLU', 40],
    ['half_day', 'YARIM GUN', 50],
    ['overtime', 'FAZLA_MESAI', 60],
  ];
  for (const [code, name, sortOrder] of statusDefaults) {
    await conn.query(
      'INSERT INTO hr_work_statuses (code, name, is_active, sort_order) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)',
      [code, name, sortOrder]
    );
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
  try {
    await ensureBaseTables(conn);
    await alterAttendanceColumns(conn);
    await seedDefaults(conn);
    // eslint-disable-next-line no-console
    console.log('[patch-020] IK ayarlar modulu hazir');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-020]', e);
  process.exit(1);
});
