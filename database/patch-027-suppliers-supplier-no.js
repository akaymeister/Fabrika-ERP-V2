const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasColumn(conn, table, col) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col]
  );
  return Number(r[0] && r[0].c) > 0;
}

async function hasIndex(conn, table, idx) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [table, idx]
  );
  return Number(r[0] && r[0].c) > 0;
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
    if (!(await hasColumn(conn, 'suppliers', 'supplier_no'))) {
      await conn.query('ALTER TABLE suppliers ADD COLUMN supplier_no VARCHAR(32) NULL AFTER id');
    }
    const [mxRows] = await conn.query(
      `SELECT supplier_no FROM suppliers WHERE supplier_no IS NOT NULL AND supplier_no REGEXP '^SUP-[0-9]+$'`
    );
    let maxN = 0;
    for (const row of mxRows) {
      const m = String(row.supplier_no || '').match(/^SUP-(\d+)$/i);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    const [need] = await conn.query(
      `SELECT id FROM suppliers WHERE supplier_no IS NULL OR TRIM(COALESCE(supplier_no, '')) = '' ORDER BY id ASC`
    );
    let n = maxN;
    for (const row of need) {
      n += 1;
      const no = `SUP-${String(n).padStart(5, '0')}`;
      // eslint-disable-next-line no-await-in-loop
      await conn.query('UPDATE suppliers SET supplier_no = ? WHERE id = ?', [no, row.id]);
    }
    if (!(await hasIndex(conn, 'suppliers', 'uq_suppliers_supplier_no'))) {
      await conn.query('ALTER TABLE suppliers ADD UNIQUE KEY uq_suppliers_supplier_no (supplier_no)');
    }
    // eslint-disable-next-line no-console
    console.log('[patch-027] supplier_no tamam');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[patch-027]', e);
  process.exit(1);
});
