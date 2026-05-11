const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
    await conn.query(`
CREATE TABLE IF NOT EXISTS payroll_disputes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  period_month CHAR(7) NOT NULL COMMENT 'YYYY-MM',
  employee_id INT UNSIGNED NOT NULL,
  dispute_date DATE NULL,
  request_type VARCHAR(40) NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  status ENUM('open', 'approved', 'rejected', 'resolved') NOT NULL DEFAULT 'open',
  resolution_note TEXT NULL,
  created_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payroll_disputes_period (period_month),
  KEY idx_payroll_disputes_employee (employee_id),
  KEY idx_payroll_disputes_status (status),
  CONSTRAINT fk_payroll_disputes_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_disputes_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_payroll_disputes_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`);
    // eslint-disable-next-line no-console
    console.log('[patch-029] payroll_disputes tablosu hazir');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-029]', e);
  process.exit(1);
});
