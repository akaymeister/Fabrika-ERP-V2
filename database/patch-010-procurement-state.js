/**
 * Talep: procurement_state (started|ongoing) — tedarik süreci metni.
 * Tekrar çalıştırılabilir.
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
  });
  try {
    const [cols] = await pool.query(
      "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_requests' AND COLUMN_NAME = 'procurement_state'"
    );
    if (Number(cols[0].c) === 0) {
      await pool.query(
        "ALTER TABLE purchase_requests ADD COLUMN procurement_state VARCHAR(32) NULL DEFAULT NULL COMMENT 'started|ongoing' AFTER pr_status"
      );
      // eslint-disable-next-line no-console
      console.log('[patch-010] purchase_requests.procurement_state eklendi');
    } else {
      // eslint-disable-next-line no-console
      console.log('[patch-010] purchase_requests.procurement_state zaten var, atlandı');
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
