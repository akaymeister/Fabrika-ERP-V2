const { getKpis, getRecentMovements } = require('../services/dashboardService');
const { jsonOk } = require('../utils/apiResponse');
const { userHasAnyPermission } = require('../services/accessService');

/**
 * Permission gruplar — UI navigation.js + app.js route guard listeleriyle
 * birebir uyumlu (Faz 3 granular kapsamı + eski module.* anahtarları).
 */
const STOCK_PERMS = [
  'module.stock',
  'stock.hub.view',
  'stock.products.view',
  'stock.brands.view',
  'stock.warehouses.view',
  'stock.in.view',
  'stock.out.view',
  'stock.movements.view',
  'stock.reports.view',
];

const PROJECTS_PERMS = ['module.projects', 'projects.hub.view', 'projects.control.view'];

const PURCHASING_PERMS = [
  'module.purchasing',
  'module.purchasing.request',
  'module.purchasing.approve',
  'module.purchasing.receipt',
  'purchasing.hub.view',
  'purchasing.request.view',
  'purchasing.request.create',
  'purchasing.request.approve',
  'purchasing.processing.view',
  'purchasing.order.view',
  'purchasing.receipt.view',
  'purchasing.suppliers.view',
];

const HR_PERMS = [
  'module.hr',
  'hr.hub.view',
  'hr.employees.view',
  'hr.attendance.view',
  'hr.payroll.view',
  'hr.compensation.view',
];

async function getSummary(req, res) {
  const u = req.session?.user;
  if (!u) {
    // requireAuth zaten yakalar; ekstra güvenlik.
    return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
  }
  const slug = u.role?.slug;
  const uid = u.id;

  // Her modül için: izin var mı? userHasAnyPermission super_admin'i otomatik geçer.
  const canStock = await userHasAnyPermission(uid, slug, STOCK_PERMS);
  const canProjects = await userHasAnyPermission(uid, slug, PROJECTS_PERMS);
  const canPurchasing = await userHasAnyPermission(uid, slug, PURCHASING_PERMS);
  const canHr = await userHasAnyPermission(uid, slug, HR_PERMS);

  // KPI: izin yoksa alan `null` döner; frontend buna bakarak KPI'ı gizler.
  const kpis = await getKpis({ canStock, canProjects, canPurchasing });

  // allowed objesi UI'da kart/section gating için ikincil kaynak (frontend
  // ayrıca authContext.hasAny ile aynı kararı üretir — iki kat güvenlik).
  return res.json(
    jsonOk({
      allowed: {
        stock: canStock,
        projects: canProjects,
        purchasing: canPurchasing,
        hr: canHr,
      },
      ...kpis,
    })
  );
}

async function getActivity(req, res) {
  // Bu endpoint'e ulaşmak zaten requireAnyPermission(stock view'ları) ile
  // korunur (dashboardRoutes); buradaki kontrol fail-safe ikincil katman.
  const u = req.session?.user;
  if (!u) {
    return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
  }
  const raw = parseInt(String(req.query?.limit ?? ''), 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 10) : 10;
  const movements = await getRecentMovements(limit);
  return res.json(jsonOk({ movements }));
}

module.exports = {
  getSummary,
  getActivity,
  // Test/debug için izin listeleri dışa açılır.
  __PERMS__: { STOCK_PERMS, PROJECTS_PERMS, PURCHASING_PERMS, HR_PERMS },
};
