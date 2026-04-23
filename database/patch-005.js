/**
 * 005 sonrası: ürün sütunları, depo FK, m3, indeks (tekrar çalıştırılabilir).
 * node database/patch-005.js
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

async function hasIndex(conn, table, indexName) {
  const [r] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return r[0].c > 0;
}

async function hasFk(conn, table, constraintName) {
  const [r] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = ?`,
    [table, constraintName]
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
    multipleStatements: true,
  });

  for (const [col, def] of [
    ['depth_mm', 'INT UNSIGNED NULL'],
    ['stock_m3', 'DECIMAL(18,6) NOT NULL DEFAULT 0'],
    ['list_fx_uzs_per_usd', 'DECIMAL(18,4) NULL'],
    ['unit_price_usd', 'DECIMAL(18,6) NULL'],
    ['warehouse_id', 'INT UNSIGNED NULL'],
    ['warehouse_subcategory_id', 'INT UNSIGNED NULL'],
  ]) {
    if (!(await hasColumn(conn, 'products', col))) {
      // eslint-disable-next-line no-console
      console.log(`[patch-005] products.${col}`);
      await conn.query(`ALTER TABLE products ADD COLUMN ${col} ${def}`);
    }
  }

  await conn.query(
    'INSERT INTO warehouses (id, name, sort_order) VALUES (1, "Genel depo", 0) ON DUPLICATE KEY UPDATE name=VALUES(name)'
  );
  await conn.query(
    'INSERT INTO warehouse_subcategories (id, warehouse_id, name, sort_order) VALUES (1, 1, "Genel", 0) ON DUPLICATE KEY UPDATE name=VALUES(name)'
  );

  if ((await hasColumn(conn, 'products', 'warehouse_id')) && (await hasColumn(conn, 'products', 'warehouse_subcategory_id'))) {
    await conn.query('UPDATE products SET warehouse_id = 1 WHERE warehouse_id IS NULL');
    await conn.query('UPDATE products SET warehouse_subcategory_id = 1 WHERE warehouse_subcategory_id IS NULL');
  }

  if ((await hasColumn(conn, 'products', 'stock_m2')) && (await hasColumn(conn, 'products', 'depth_mm'))) {
    await conn.query(`
      UPDATE products
      SET stock_m3 = stock_m2 * (IFNULL(depth_mm,0) / 1000)
    `);
  }

  try {
    if (await hasIndex(conn, 'products', 'uq_products_n_u_b')) {
      // eslint-disable-next-line no-console
      console.log('[patch-005] drop uq_products_n_u_b');
      await conn.query('ALTER TABLE products DROP INDEX uq_products_n_u_b');
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[patch-005] drop uq_products_n_u_b', e.message);
  }
  try {
    if (await hasIndex(conn, 'products', 'uq_products_name_unit_brand')) {
      await conn.query('ALTER TABLE products DROP INDEX uq_products_name_unit_brand');
    }
  } catch (e) {
    /* */
  }

  const [dupNames] = await conn.query(
    'SELECT name FROM products GROUP BY name HAVING COUNT(*) > 1'
  );
  for (const row of dupNames) {
    const [ids] = await conn.query('SELECT id FROM products WHERE name = ? ORDER BY id ASC', [row.name]);
    for (let i = 1; i < ids.length; i += 1) {
      const id = ids[i].id;
      // eslint-disable-next-line no-console
      console.log('[patch-005] duplicate name → append id', id);
      await conn.query('UPDATE products SET name = CONCAT(name, " #", ?) WHERE id = ?', [id, id]);
    }
  }

  if (
    !(await hasIndex(conn, 'products', 'uq_products_display_name')) &&
    (await hasColumn(conn, 'products', 'name'))
  ) {
    try {
      await conn.query('ALTER TABLE products ADD UNIQUE KEY uq_products_display_name (name(191))');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[patch-005] uq_products_display_name', e.message);
    }
  }

  if (!(await hasIndex(conn, 'products', 'idx_products_warehouse')) && (await hasColumn(conn, 'products', 'warehouse_id'))) {
    try {
      await conn.query('ALTER TABLE products ADD KEY idx_products_warehouse (warehouse_id, warehouse_subcategory_id)');
    } catch (e) {
      /* */
    }
  }

  if (!(await hasFk(conn, 'products', 'fk_products_warehouse'))) {
    try {
      await conn.query(
        'ALTER TABLE products ADD CONSTRAINT fk_products_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)'
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      if (!String(e.message).includes('Duplicate') && !String(e.message).includes('fk_products_warehouse')) {
        console.warn('[patch-005] fk_products_warehouse', e.message);
      }
    }
  }
  if (!(await hasFk(conn, 'products', 'fk_products_wsub'))) {
    try {
      await conn.query(
        'ALTER TABLE products ADD CONSTRAINT fk_products_wsub FOREIGN KEY (warehouse_subcategory_id) REFERENCES warehouse_subcategories (id)'
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      if (!String(e.message).includes('Duplicate') && !String(e.message).includes('fk_products_wsub')) {
        console.warn('[patch-005] fk_products_wsub', e.message);
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log('[patch-005] Bitti.');
  await conn.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-005]', e.message);
  process.exit(1);
});
