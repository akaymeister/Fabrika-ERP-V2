/**
 * Stok: movement_source, satınalma / mal kabul; sipariş: mal kabul bekleniyor
 * Tekrar çalıştırılabilir (idempotent).
 * npm run db:migrate sonunda otomatik çağrılır.
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasCol(conn, table, col) {
  const [r] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col]
  );
  return r[0].c > 0;
}

async function hasTable(conn, name) {
  const [r] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name]
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

  if (!(await hasTable(conn, 'stock_movements'))) {
    // eslint-disable-next-line no-console
    console.log('[patch-009] stock_movements yok, atlandı');
    await conn.end();
    return;
  }

  if (!(await hasCol(conn, 'stock_movements', 'movement_source'))) {
    await conn.query(`
      ALTER TABLE stock_movements
        ADD COLUMN movement_source VARCHAR(32) NULL
        COMMENT 'MANUAL_STOCK_IN,PURCHASE_RECEIPT,STOCK_ADJUSTMENT,RETURN_IN,OPENING_BALANCE'
    `);
    // eslint-disable-next-line no-console
    console.log('[patch-009] stock_movements.movement_source eklendi');
  } else {
    // eslint-disable-next-line no-console
    console.log('[patch-009] stock_movements.movement_source zaten var, atlandı');
  }
  if (!(await hasCol(conn, 'stock_movements', 'purchase_order_id'))) {
    await conn.query('ALTER TABLE stock_movements ADD COLUMN purchase_order_id INT UNSIGNED NULL');
    // eslint-disable-next-line no-console
    console.log('[patch-009] stock_movements.purchase_order_id eklendi');
  }
  if (!(await hasCol(conn, 'stock_movements', 'goods_receipt_id'))) {
    await conn.query('ALTER TABLE stock_movements ADD COLUMN goods_receipt_id INT UNSIGNED NULL');
    // eslint-disable-next-line no-console
    console.log('[patch-009] stock_movements.goods_receipt_id eklendi');
  }

  try {
    await conn.query(
      "UPDATE stock_movements SET movement_source = 'MANUAL_STOCK_IN' WHERE movement_type = 'in' AND (movement_source IS NULL OR movement_source = '')"
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[patch-009] backfill movement_source atlandı:', e.message);
  }

  if (await hasTable(conn, 'purchase_orders')) {
    try {
      await conn.query(
        "ALTER TABLE purchase_orders MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'awaiting_goods_receipt'"
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[patch-009] purchase_orders.status modify:', e.message);
    }
    try {
      const [r] = await conn.query(
        "UPDATE purchase_orders SET status = 'awaiting_goods_receipt' WHERE status = 'ordered'"
      );
      // eslint-disable-next-line no-console
      if (r.affectedRows > 0) {
        console.log(`[patch-009] ${r.affectedRows} sipariş: ordered → awaiting_goods_receipt`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[patch-009] sipariş status güncelleme:', e.message);
    }
  }

  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[patch-009] Bitti.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-009] Hata:', e.message);
  process.exit(1);
});
