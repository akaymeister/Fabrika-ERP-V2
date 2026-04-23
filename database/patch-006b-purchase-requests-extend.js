/**
 * purchase_requests genişletme: talep no, proje, pr_status
 * (006 migration önce/sonra; idempotent sütun ekler)
 * node database/patch-006b-purchase-requests-extend.js
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

async function hasFk(conn, name) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.table_constraints WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?',
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
    multipleStatements: true,
  });
  if (!(await hasCol(conn, 'purchase_requests', 'request_code'))) {
    await conn.query('ALTER TABLE purchase_requests ADD COLUMN request_code VARCHAR(32) NULL COMMENT \'TAL-...\' AFTER id');
    // eslint-disable-next-line no-console
    console.log('[006b] request_code eklendi');
  }
  if (!(await hasCol(conn, 'purchase_requests', 'project_id'))) {
    await conn.query('ALTER TABLE purchase_requests ADD COLUMN project_id INT UNSIGNED NULL');
    // eslint-disable-next-line no-console
    console.log('[006b] project_id eklendi');
  }
  if (!(await hasCol(conn, 'purchase_requests', 'pr_status'))) {
    await conn.query("ALTER TABLE purchase_requests ADD COLUMN pr_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending|approved|rejected' AFTER project_id");
    // eslint-disable-next-line no-console
    console.log('[006b] pr_status eklendi');
  }
  await conn.query(
    'UPDATE purchase_requests SET pr_status = CASE WHEN `status` = \'rejected\' THEN \'rejected\' WHEN `status` IN (\'approved\', \'fulfilled\') THEN \'approved\' WHEN `status` = \'submitted\' THEN \'pending\' WHEN `status` = \'draft\' THEN \'pending\' ELSE \'pending\' END WHERE 1=1'
  );
  if (!(await hasFk(conn, 'fk_pr_project'))) {
    try {
      await conn.query(
        'ALTER TABLE purchase_requests ADD CONSTRAINT fk_pr_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL'
      );
      // eslint-disable-next-line no-console
      console.log('[006b] fk_pr_project eklendi');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[006b] fk_pr_project atlandı:', e.message);
    }
  }
  const [idRows] = await conn.query('SELECT id FROM purchase_requests WHERE request_code IS NULL OR request_code = \'\'');
  for (const row of idRows) {
    const id = row.id;
    await conn.query('UPDATE purchase_requests SET request_code = CONCAT(\'TAL-\', DATE_FORMAT(created_at, \'%Y\'), \'-\', LPAD(?, 5, \'0\')) WHERE id = ?', [id, id]);
  }
  if (!(await hasFk(conn, 'fk_gr_warehouse'))) {
    const [t] = await conn.query("SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'warehouses'");
    if (t[0].c > 0) {
      try {
        await conn.query(
          'ALTER TABLE goods_receipts ADD CONSTRAINT fk_gr_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL'
        );
        // eslint-disable-next-line no-console
        console.log('[006b] goods_receipts.fk_gr_warehouse eklendi');
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('[006b] fk_gr_warehouse atlandı:', e.message);
      }
    }
  }
  await conn.end();
  // eslint-disable-next-line no-console
  console.log('[006b] Bitti.');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[006b]', e.message);
  process.exit(1);
});
