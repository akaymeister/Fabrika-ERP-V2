/**
 * Satınalma talep: depo, alt kategori, birim id, satır görsel/PDF; status VARCHAR
 * node database/patch-006c-purchase-request-ui.js
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
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  if (await hasCol(conn, 'purchase_requests', 'pr_status')) {
    try {
      await conn.query('ALTER TABLE purchase_requests MODIFY pr_status VARCHAR(32) NOT NULL DEFAULT \'pending\'');
      // eslint-disable-next-line no-console
      console.log('[006c] pr_status VARCHAR(32)');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[006c] pr_status:', e.message);
    }
  }
  try {
    await conn.query("ALTER TABLE purchase_requests MODIFY `status` VARCHAR(32) NOT NULL DEFAULT 'draft'");
    // eslint-disable-next-line no-console
    console.log('[006c] status VARCHAR(32)');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[006c] status alter:', e.message);
  }

  const itemCols = [
    ['warehouse_id', 'INT UNSIGNED NULL'],
    ['warehouse_subcategory_id', 'INT UNSIGNED NULL'],
    ['unit_id', 'INT UNSIGNED NULL'],
    ['line_image_path', 'VARCHAR(500) NULL'],
    ['line_pdf_path', 'VARCHAR(500) NULL'],
  ];
  for (const [name, def] of itemCols) {
    if (!(await hasCol(conn, 'purchase_request_items', name))) {
      try {
        await conn.query(`ALTER TABLE purchase_request_items ADD COLUMN ${name} ${def}`);
        // eslint-disable-next-line no-console
        console.log(`[006c] purchase_request_items.${name} eklendi`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`[006c] ${name}:`, e.message);
      }
    }
  }
  if ((await hasCol(conn, 'purchase_request_items', 'unit_id')) && (await hasCol(conn, 'purchase_request_items', 'unit_code'))) {
    try {
      await conn.query('ALTER TABLE purchase_request_items MODIFY unit_code VARCHAR(32) NULL');
    } catch {
      /* */
    }
  }

  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[006c] Bitti.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[006c]', e.message);
  process.exit(1);
});
