const { pool } = require('../config/database');
const { countPendingRequests } = require('./purchasingService');

/**
 * Modül 1 — Dashboard: özet KPI ve son hareketler.
 * Boş veritabanında güvenli (0 değerler / boş liste).
 */
async function getKpis() {
  const [[totals]] = await pool.query(
    `SELECT
       COALESCE(SUM(COALESCE(p.stock_m2, p.stock_qty) * p.unit_price), 0) AS total_stock_value,
       COUNT(p.id) AS product_count
     FROM products p`
  );

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
    totalStockValue: Number(totals.total_stock_value) || 0,
    productCount: Number(totals.product_count) || 0,
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
