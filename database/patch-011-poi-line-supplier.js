/**
 * purchase_order_items.supplier_id — satır bazlı tedarikçi (NULL = sipariş üst tedarikçisi).
 * npm run db:migrate sonunda çalışır.
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasCol(conn, table, col) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col]
  );
  return r[0].c > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    if (!(await hasCol(conn, 'purchase_order_items', 'supplier_id'))) {
      await conn.query(
        `ALTER TABLE purchase_order_items
         ADD COLUMN supplier_id INT UNSIGNED NULL,
         ADD KEY idx_poi_supplier (supplier_id),
         ADD CONSTRAINT fk_poi_supplier2 FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL`
      );
      // eslint-disable-next-line no-console
      console.log('[patch-011] purchase_order_items.supplier_id eklendi');
    } else {
      // eslint-disable-next-line no-console
      console.log('[patch-011] purchase_order_items.supplier_id zaten var');
    }
    await conn.query(
      `UPDATE purchase_order_items poi
       INNER JOIN purchase_orders po ON po.id = poi.order_id
       SET poi.supplier_id = po.supplier_id
       WHERE poi.supplier_id IS NULL`
    );
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
