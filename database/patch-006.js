/**
 * Stok hareketi: doğrudan m² girişi (adet yerine) bilgisi.
 * node database/patch-006.js
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasColumn(conn, table, col) {
  const [r] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col]
  );
  return r[0].c > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  if (!(await hasColumn(conn, 'stock_movements', 'direct_m2_entry'))) {
    await conn.query(
      "ALTER TABLE stock_movements ADD COLUMN direct_m2_entry TINYINT(1) NULL COMMENT '1=m2 doğrudan, 0=adet/malzeme birimi' AFTER qty_pieces"
    );
    // eslint-disable-next-line no-console
    console.log('[patch-006] stock_movements.direct_m2_entry eklendi');
  } else {
    // eslint-disable-next-line no-console
    console.log('[patch-006] direct_m2_entry zaten var, atlandı');
  }
  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[patch-006] Bitti.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-006]', e.message);
  process.exit(1);
});
