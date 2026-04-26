/**
 * Satınalma sürecini 3 bağımsız eksene ayırır:
 * - purchase_requests.request_status
 * - purchase_orders.receipt_status / pricing_status
 * - purchase_order_items.receipt_status / pricing_status
 *
 * Eski status / pr_status alanları compatibility için korunur.
 * Script idempotent çalışır ve mevcut veriyi yeni alanlara backfill eder.
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasCol(conn, table, col) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, col]
  );
  return Number(r[0] && r[0].c) > 0;
}

async function hasFk(conn, name) {
  const [r] = await conn.query(
    'SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?',
    [name]
  );
  return Number(r[0] && r[0].c) > 0;
}

async function addCol(conn, table, col, ddl, added) {
  if (await hasCol(conn, table, col)) return;
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  added.push(`${table}.${col}`);
}

async function addProcurementStartedByFk(conn) {
  if (await hasFk(conn, 'fk_po_proc_started_by')) return false;
  await conn.query(
    `ALTER TABLE purchase_orders
     ADD CONSTRAINT fk_po_proc_started_by FOREIGN KEY (procurement_started_by) REFERENCES users (id) ON DELETE SET NULL`
  );
  return true;
}

async function addRequestFk(conn) {
  if (await hasFk(conn, 'fk_po_request')) return false;
  await conn.query(
    `ALTER TABLE purchase_orders
     ADD CONSTRAINT fk_po_request FOREIGN KEY (request_id) REFERENCES purchase_requests (id) ON DELETE SET NULL`
  );
  return true;
}

async function addPricedByFk(conn) {
  if (await hasFk(conn, 'fk_poi_priced_by')) return false;
  await conn.query(
    `ALTER TABLE purchase_order_items
     ADD CONSTRAINT fk_poi_priced_by FOREIGN KEY (priced_by) REFERENCES users (id) ON DELETE SET NULL`
  );
  return true;
}

async function backfillRequestStatus(conn) {
  if (!(await hasCol(conn, 'purchase_requests', 'request_status'))) return 0;
  const [r] = await conn.query(
    `UPDATE purchase_requests
     SET request_status = CASE
       WHEN COALESCE(NULLIF(TRIM(pr_status), ''), '') <> '' THEN
         CASE pr_status
           WHEN 'pending' THEN 'pending_approval'
           WHEN 'approved' THEN 'approved'
           WHEN 'revision_requested' THEN 'revision_requested'
           WHEN 'rejected' THEN 'rejected'
           WHEN 'cancelled' THEN 'cancelled'
           WHEN 'draft' THEN 'draft'
           ELSE pr_status
         END
       ELSE
         CASE status
           WHEN 'draft' THEN 'draft'
           WHEN 'submitted' THEN 'pending_approval'
           WHEN 'approved' THEN 'approved'
           WHEN 'fulfilled' THEN 'approved'
           WHEN 'rejected' THEN 'rejected'
           WHEN 'cancelled' THEN 'cancelled'
           ELSE 'draft'
         END
     END
     WHERE request_status IS NULL OR TRIM(request_status) = ''`
  );
  return Number(r.affectedRows || 0);
}

async function backfillOrderRequestId(conn) {
  if (!(await hasCol(conn, 'purchase_orders', 'request_id'))) return 0;
  const [r] = await conn.query(
    `UPDATE purchase_orders po
     INNER JOIN (
       SELECT poi.order_id,
              CASE
                WHEN COUNT(DISTINCT pri.request_id) = 1 THEN MAX(pri.request_id)
                ELSE NULL
              END AS request_id
       FROM purchase_order_items poi
       LEFT JOIN purchase_request_items pri ON pri.id = poi.request_item_id
       GROUP BY poi.order_id
     ) x ON x.order_id = po.id
     SET po.request_id = x.request_id
     WHERE po.request_id IS NULL AND x.request_id IS NOT NULL`
  );
  return Number(r.affectedRows || 0);
}

async function backfillOrderItemStates(conn) {
  if (!(await hasCol(conn, 'purchase_order_items', 'receipt_status'))) return { receipt: 0, pricing: 0 };
  const [r1] = await conn.query(
    `UPDATE purchase_order_items
     SET receipt_status = CASE
       WHEN COALESCE(qty_received, 0) <= 0.0000 THEN 'awaiting_receipt'
       WHEN COALESCE(qty_received, 0) + 0.0001 >= COALESCE(qty_ordered, 0) THEN 'received_completed'
       ELSE 'partially_received'
     END
     WHERE receipt_status IS NULL OR TRIM(receipt_status) = ''`
  );
  const [r2] = await conn.query(
    `UPDATE purchase_order_items
     SET pricing_status = CASE
       WHEN COALESCE(unit_price, 0) > 0 THEN 'fully_priced'
       WHEN unit_price IS NULL THEN 'unpriced'
       ELSE pricing_status
     END
     WHERE pricing_status IS NULL OR TRIM(pricing_status) = ''`
  );
  return { receipt: Number(r1.affectedRows || 0), pricing: Number(r2.affectedRows || 0) };
}

async function backfillOrderStates(conn) {
  if (!(await hasCol(conn, 'purchase_orders', 'receipt_status'))) return { receipt: 0, pricing: 0 };
  const [r1] = await conn.query(
    `UPDATE purchase_orders po
     INNER JOIN (
       SELECT poi.order_id,
              CASE
                WHEN COUNT(*) = 0 THEN 'awaiting_receipt'
                WHEN SUM(CASE WHEN poi.receipt_status = 'received_completed' THEN 1 ELSE 0 END) = COUNT(*) THEN 'received_completed'
                WHEN SUM(CASE WHEN COALESCE(poi.qty_received, 0) > 0 THEN 1 ELSE 0 END) > 0 THEN 'partially_received'
                ELSE 'awaiting_receipt'
              END AS receipt_status
       FROM purchase_order_items poi
       GROUP BY poi.order_id
     ) x ON x.order_id = po.id
     SET po.receipt_status = x.receipt_status
     WHERE po.receipt_status IS NULL OR TRIM(po.receipt_status) = ''`
  );
  const [r2] = await conn.query(
    `UPDATE purchase_orders po
     INNER JOIN (
       SELECT poi.order_id,
              CASE
                WHEN COUNT(*) = 0 THEN 'unpriced'
                WHEN SUM(CASE WHEN poi.pricing_status IS NULL OR TRIM(poi.pricing_status) = '' THEN 1 ELSE 0 END) > 0 THEN NULL
                WHEN SUM(CASE WHEN poi.pricing_status = 'fully_priced' THEN 1 ELSE 0 END) = COUNT(*) THEN 'fully_priced'
                WHEN SUM(CASE WHEN poi.pricing_status IN ('fully_priced', 'partially_priced') THEN 1 ELSE 0 END) > 0 THEN 'partially_priced'
                ELSE 'unpriced'
              END AS pricing_status
       FROM purchase_order_items poi
       GROUP BY poi.order_id
     ) x ON x.order_id = po.id
     SET po.pricing_status = x.pricing_status
     WHERE (po.pricing_status IS NULL OR TRIM(po.pricing_status) = '')
       AND x.pricing_status IS NOT NULL`
  );
  return {
    receipt: Number(r1.affectedRows || 0),
    pricing: Number(r2.affectedRows || 0),
  };
}

async function collectManualReview(conn) {
  const [[zeroPriceItems]] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM purchase_order_items
     WHERE COALESCE(unit_price, 0) = 0
       AND (pricing_status IS NULL OR TRIM(pricing_status) = '')`
  );
  const [zeroPriceSamples] = await conn.query(
    `SELECT id, order_id, product_id, qty_ordered, qty_received, unit_price, currency
     FROM purchase_order_items
     WHERE COALESCE(unit_price, 0) = 0
       AND (pricing_status IS NULL OR TRIM(pricing_status) = '')
     ORDER BY order_id, id
     LIMIT 20`
  );
  const [[pricingPendingOrders]] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM purchase_orders
     WHERE pricing_status IS NULL OR TRIM(pricing_status) = ''`
  );
  return {
    zeroPriceItems: Number(zeroPriceItems.c || 0),
    zeroPriceSamples,
    pricingPendingOrders: Number(pricingPendingOrders.c || 0),
  };
}

async function syncLegacyStatuses(conn) {
  const [r1] = await conn.query(
    `UPDATE purchase_orders
     SET status = CASE
       WHEN receipt_status = 'received_completed' THEN 'completed'
       WHEN receipt_status = 'partially_received' THEN 'partial_received'
       ELSE 'awaiting_goods_receipt'
     END
     WHERE receipt_status IS NOT NULL`
  );
  const [r2] = await conn.query(
    `UPDATE purchase_requests
     SET pr_status = CASE request_status
       WHEN 'pending_approval' THEN 'pending'
       WHEN 'approved' THEN 'approved'
       WHEN 'revision_requested' THEN 'revision_requested'
       WHEN 'rejected' THEN 'rejected'
       WHEN 'cancelled' THEN 'cancelled'
       WHEN 'draft' THEN 'draft'
       ELSE pr_status
     END
     WHERE request_status IS NOT NULL`
  );
  return {
    poLegacy: Number(r1.affectedRows || 0),
    prLegacy: Number(r2.affectedRows || 0),
  };
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
    const added = [];
    await addCol(
      conn,
      'purchase_requests',
      'pr_status',
      "pr_status VARCHAR(32) NULL COMMENT 'legacy request status mirror' AFTER status",
      added
    );
    await addCol(
      conn,
      'purchase_requests',
      'request_status',
      "request_status VARCHAR(32) NULL COMMENT 'draft|pending_approval|approved|revision_requested|rejected|cancelled' AFTER pr_status",
      added
    );

    await addCol(conn, 'purchase_orders', 'request_id', 'request_id INT UNSIGNED NULL AFTER supplier_id', added);
    await addCol(
      conn,
      'purchase_orders',
      'receipt_status',
      "receipt_status VARCHAR(32) NULL COMMENT 'awaiting_receipt|partially_received|received_completed' AFTER status",
      added
    );
    await addCol(
      conn,
      'purchase_orders',
      'pricing_status',
      "pricing_status VARCHAR(32) NULL COMMENT 'unpriced|partially_priced|fully_priced' AFTER receipt_status",
      added
    );
    await addCol(
      conn,
      'purchase_orders',
      'procurement_started_at',
      'procurement_started_at DATETIME NULL AFTER pricing_status',
      added
    );
    await addCol(
      conn,
      'purchase_orders',
      'procurement_started_by',
      'procurement_started_by INT UNSIGNED NULL AFTER procurement_started_at',
      added
    );
    await addCol(conn, 'purchase_orders', 'closed_at', 'closed_at DATETIME NULL AFTER procurement_started_by', added);

    await addCol(
      conn,
      'purchase_order_items',
      'receipt_status',
      "receipt_status VARCHAR(32) NULL COMMENT 'awaiting_receipt|partially_received|received_completed' AFTER qty_received",
      added
    );
    await addCol(
      conn,
      'purchase_order_items',
      'pricing_status',
      "pricing_status VARCHAR(32) NULL COMMENT 'unpriced|partially_priced|fully_priced' AFTER receipt_status",
      added
    );
    await addCol(conn, 'purchase_order_items', 'fx_rate', 'fx_rate DECIMAL(18,6) NULL AFTER currency', added);
    await addCol(conn, 'purchase_order_items', 'priced_at', 'priced_at DATETIME NULL AFTER fx_rate', added);
    await addCol(conn, 'purchase_order_items', 'priced_by', 'priced_by INT UNSIGNED NULL AFTER priced_at', added);

    const fkAdded = [];
    if (await hasCol(conn, 'purchase_orders', 'request_id')) {
      if (await addRequestFk(conn)) fkAdded.push('fk_po_request');
    }
    if (await hasCol(conn, 'purchase_orders', 'procurement_started_by')) {
      if (await addProcurementStartedByFk(conn)) fkAdded.push('fk_po_proc_started_by');
    }
    if (await hasCol(conn, 'purchase_order_items', 'priced_by')) {
      if (await addPricedByFk(conn)) fkAdded.push('fk_poi_priced_by');
    }

    const reqStatus = await backfillRequestStatus(conn);
    const reqId = await backfillOrderRequestId(conn);
    const itemStates = await backfillOrderItemStates(conn);
    const orderStates = await backfillOrderStates(conn);
    const legacySync = await syncLegacyStatuses(conn);
    const manualReview = await collectManualReview(conn);

    console.log('[patch-014] eklenen sütunlar:', added.length ? added.join(', ') : 'yok');
    console.log('[patch-014] eklenen foreign key:', fkAdded.length ? fkAdded.join(', ') : 'yok');
    console.log('[patch-014] backfill request_status:', reqStatus);
    console.log('[patch-014] backfill purchase_orders.request_id:', reqId);
    console.log('[patch-014] backfill item states:', `receipt=${itemStates.receipt}, pricing=${itemStates.pricing}`);
    console.log('[patch-014] backfill order states:', `receipt=${orderStates.receipt}, pricing=${orderStates.pricing}`);
    console.log('[patch-014] legacy sync:', `po=${legacySync.poLegacy}, pr=${legacySync.prLegacy}`);
    console.log('[patch-014] manual review:', `zero_price_items=${manualReview.zeroPriceItems}, pricing_status_null_orders=${manualReview.pricingPendingOrders}`);
    if (manualReview.zeroPriceSamples.length) {
      console.log('[patch-014] manual review samples (first 20):');
      console.table(manualReview.zeroPriceSamples);
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[patch-014]', e);
  process.exit(1);
});
