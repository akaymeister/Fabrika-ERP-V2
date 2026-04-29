const { pool } = require('../config/database');
const { countPendingRequests } = require('./purchasingService');

async function hasColumn(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0] && rows[0].c) > 0;
}

/**
 * Modül 1 — Dashboard: özet KPI ve son hareketler.
 * Boş veritabanında güvenli (0 değerler / boş liste).
 */
async function getKpis() {
  const hasStockM2 = await hasColumn('products', 'stock_m2');
  const stockQtyExpr = hasStockM2 ? 'COALESCE(p.stock_m2, p.stock_qty)' : 'p.stock_qty';
  const [[prodAgg]] = await pool.query(
    `SELECT
       COALESCE(SUM((${stockQtyExpr}) * p.unit_price), 0) AS list_stock_value,
       COUNT(p.id) AS product_count
     FROM products p`
  );

  let totalStockValue = 0;
  const hasCostLayers = await hasColumn('stock_cost_layers', 'qty_m2_remaining');
  if (hasCostLayers) {
    const [[layerRow]] = await pool.query(
      `SELECT COALESCE(SUM(qty_m2_remaining * cost_uzs_per_m2), 0) AS fifo_value
       FROM stock_cost_layers`
    );
    const fifoVal = Number(layerRow && layerRow.fifo_value) || 0;
    if (fifoVal > 0) {
      totalStockValue = fifoVal;
    }
  }
  if (totalStockValue <= 0) {
    totalStockValue = Number(prodAgg.list_stock_value) || 0;
  }

  const [[proj]] = await pool.query(
    `SELECT COUNT(*) AS active_project_count
     FROM projects
     WHERE status = 'active'`
  );

  let pendingPurchaseCount = 0;
  try {
    pendingPurchaseCount = await countPendingRequests();
  } catch (_) {
    const [[pr]] = await pool.query(
      `SELECT COUNT(*) AS pending_purchase_count
       FROM purchase_requests
       WHERE status = 'submitted'`
    );
    pendingPurchaseCount = Number(pr.pending_purchase_count) || 0;
  }

  return {
    totalStockValue,
    productCount: Number(prodAgg.product_count) || 0,
    activeProjectCount: Number(proj.active_project_count) || 0,
    pendingPurchaseCount: Number(pendingPurchaseCount) || 0,
  };
}

async function getRecentMovements(limit = 10) {
  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 10, 1), 50);
  const [rows] = await pool.query(
    `SELECT
       sm.id,
       sm.movement_type,
       sm.qty,
       sm.note,
       sm.created_at,
       p.name AS product_name,
       p.product_code,
       u.username AS user_username
     FROM stock_movements sm
     INNER JOIN products p ON p.id = sm.product_id
     LEFT JOIN users u ON u.id = sm.user_id
     ORDER BY sm.id DESC
     LIMIT ${lim}`
  );
  return rows;
}

module.exports = { getKpis, getRecentMovements };
