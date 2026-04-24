/**
 * Satınalmacı ekranı: buyer_state (in_progress, ready_for_warehouse)
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [cols] = await conn.query(
      "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'buyer_state'"
    );
    if (Number(cols[0].c) === 0) {
      await conn.query(
        'ALTER TABLE purchase_orders ADD COLUMN buyer_state VARCHAR(32) NULL DEFAULT NULL COMMENT \'in_progress|ready_for_warehouse\' AFTER `status`'
      );
      // eslint-disable-next-line no-console
      console.log('[patch-012] purchase_orders.buyer_state eklendi');
    } else {
      // eslint-disable-next-line no-console
      console.log('[patch-012] buyer_state zaten var');
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
