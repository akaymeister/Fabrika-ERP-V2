/**
 * 004 .sql sonrası ürün/stok şeması (tekrar çalıştırılabilir).
 * node database/patch-004.js
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

async function hasForeignKeyName(conn, tableName, constraintName) {
  const [r] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
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

  if (!(await hasColumn(conn, 'brands', 'slug'))) {
    // eslint-disable-next-line no-console
    console.log('[patch-004] brands.slug');
    await conn.query('ALTER TABLE brands ADD COLUMN slug VARCHAR(50) NULL AFTER name');
  }
  let [[ub]] = await conn.query('SELECT id FROM brands WHERE slug = ?', ['unbranded']);
  if (!ub) {
    await conn.query("INSERT INTO brands (name, slug) VALUES ('Markasız', 'unbranded')");
    [[ub]] = await conn.query('SELECT id FROM brands WHERE slug = ?', ['unbranded']);
  }
  const unbrandedId = ub.id;

  if (!(await hasColumn(conn, 'products', 'unit_id'))) {
    // eslint-disable-next-line no-console
    console.log('[patch-004] products yeni sütunlar');
    await conn.query(`
      ALTER TABLE products
        ADD COLUMN material_label VARCHAR(300) NULL AFTER name,
        ADD COLUMN unit_id INT UNSIGNED NULL,
        ADD COLUMN width_mm INT UNSIGNED NULL,
        ADD COLUMN height_mm INT UNSIGNED NULL,
        ADD COLUMN m2_per_piece DECIMAL(18,6) NOT NULL DEFAULT 0,
        ADD COLUMN stock_m2 DECIMAL(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN stock_pieces DECIMAL(18,4) NOT NULL DEFAULT 0
    `);
  }

  if (await hasIndex(conn, 'products', 'uq_products_name_unit_brand')) {
    // eslint-disable-next-line no-console
    console.log('[patch-004] unique indeks yenileme');
    await conn.query('ALTER TABLE products DROP INDEX uq_products_name_unit_brand');
    await conn.query(`
      ALTER TABLE products
        ADD UNIQUE KEY uq_products_n_u_b (name(191), unit_id, brand_id)
    `);
  } else if (!(await hasIndex(conn, 'products', 'uq_products_n_u_b'))) {
    await conn.query(`
      ALTER TABLE products
        ADD UNIQUE KEY uq_products_n_u_b (name(191), unit_id, brand_id)
    `);
  }

  await conn.query('UPDATE products SET unit_id = 1 WHERE unit_id IS NULL');
  if ((await hasColumn(conn, 'products', 'stock_qty')) && (await hasColumn(conn, 'products', 'stock_m2'))) {
    await conn.query(`
      UPDATE products
      SET m2_per_piece = CASE
        WHEN IFNULL(width_mm,0) > 0 AND IFNULL(height_mm,0) > 0
        THEN (width_mm * height_mm) / 1000000
        ELSE 0
      END
    `);
    await conn.query('UPDATE products SET stock_m2 = stock_qty WHERE stock_m2 = 0');
    await conn.query(`
      UPDATE products
      SET stock_pieces = CASE WHEN m2_per_piece > 0 THEN stock_m2 / m2_per_piece ELSE stock_m2 END
    `);
  }

  await conn.query('UPDATE products SET brand_id = ? WHERE brand_id IS NULL OR brand_id = 0', [unbrandedId]);

  if (!(await hasIndex(conn, 'products', 'idx_products_unit'))) {
    await conn.query('ALTER TABLE products ADD KEY idx_products_unit (unit_id)');
  }

  if (!(await hasForeignKeyName(conn, 'products', 'fk_products_unit'))) {
    try {
      await conn.query('ALTER TABLE products ADD CONSTRAINT fk_products_unit FOREIGN KEY (unit_id) REFERENCES units (id)');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_DUP_NAME' || e.errno === 1022) {
        /* kısıt adı mevcut */
      } else {
        // eslint-disable-next-line no-console
        console.warn('[patch-004] fk_products_unit', e.message);
      }
    }
  }

  for (const [col, def] of [
    ['qty_pieces', 'DECIMAL(18,4) NULL'],
    ['input_currency', "CHAR(3) NULL DEFAULT 'UZS'"],
    ['line_total_uzs', 'DECIMAL(18,2) NULL'],
    ['line_total_usd', 'DECIMAL(18,2) NULL'],
    ['fx_uzs_per_usd', 'DECIMAL(18,4) NULL'],
    ['cogs_uzs_total', 'DECIMAL(18,2) NULL'],
  ]) {
    if (!(await hasColumn(conn, 'stock_movements', col))) {
      // eslint-disable-next-line no-console
      console.log(`[patch-004] stock_movements.${col}`);
      await conn.query(`ALTER TABLE stock_movements ADD COLUMN ${col} ${def}`);
    }
  }

  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[patch-004] Bitti.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-004]', e.message);
  process.exit(1);
});
