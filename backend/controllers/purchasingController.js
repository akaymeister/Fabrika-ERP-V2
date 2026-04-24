const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { userHasPermission } = require('../services/accessService');
const { listActiveProjectsBrief } = require('../services/projectService');
const { listWarehouses } = require('../services/warehouseService');
const { jsonOk, jsonError } = require('../utils/apiResponse');
const { FRONTEND_PUBLIC } = require('../utils/paths');
const { pool } = require('../config/database');
const {
  listProductOptions,
  listSuppliers,
  createSupplier,
  listUnitsForPurchase,
  listProductsForPurchase,
  getNextRequestCodePreview,
  listPurchaseRequests,
  getPurchaseRequestById,
  createPurchaseRequest,
  updatePurchaseRequest,
  submitDraftRequest,
  cancelRequest,
  setRequestStatus,
  listApprovedRequestItems,
  createPurchaseOrder,
  listPurchaseOrders,
  listOpenOrderIdsForRequest,
  getPurchaseOrderById,
  createGoodsReceipt,
  updatePurchaseOrder,
  updatePurchaseOrderPricing,
  setProcurementStateForOrderStart,
  runOrderBuyerAction,
  runRequestBuyerAction,
} = require('../services/purchasingService');
const { logActivity } = require('../services/activityLogService');

const uploadDir = path.join(FRONTEND_PUBLIC, 'uploads', 'purchase-req');
const lineUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _f, cb) => {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
      } catch (e) {
        /* */
      }
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext.toLowerCase()}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const t = String(req.query?.type || 'image');
    if (t === 'pdf') {
      if (file.mimetype !== 'application/pdf') {
        return cb(new Error('Sadece PDF'));
      }
    } else if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Sadece görsel'));
    }
    cb(null, true);
  },
});

function validationOut(out) {
  return jsonError('VALIDATION', out.error, null, out.messageKey);
}

function parseId(raw) {
  const id = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id < 1) {
    return null;
  }
  return id;
}

/** GET /api/purchasing/scope */
async function getScope(req, res) {
  if (!req.session?.user) {
    return res.status(401).json(jsonError('UNAUTHORIZED', 'Oturum yok', null, 'api.session.required'));
  }
  const u = req.session.user;
  const canPurchasing = await userHasPermission(u.id, u.role?.slug, 'module.purchasing');
  const canRequestRaw = await userHasPermission(u.id, u.role?.slug, 'module.purchasing.request');
  const canApproveRaw = await userHasPermission(u.id, u.role?.slug, 'module.purchasing.approve');
  const canRequest = canRequestRaw || canPurchasing;
  const canApprove = canApproveRaw || canPurchasing;
  const canReceipt = await userHasPermission(u.id, u.role?.slug, 'module.purchasing.receipt');
  const canStock = await userHasPermission(u.id, u.role?.slug, 'module.stock');
  return res.json(jsonOk({ canPurchasing, canRequest, canApprove, canReceipt, canStock }));
}

async function getProductOptions(_req, res) {
  try {
    const out = await listProductOptions();
    return res.json(jsonOk(out));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getProductOptions]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function getProjectsBrief(_req, res) {
  try {
    const projects = await listActiveProjectsBrief();
    return res.json(jsonOk({ projects }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getProjectsBrief]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function getWarehouses(_req, res) {
  try {
    const rows = await listWarehouses();
    return res.json(jsonOk({ warehouses: rows }));
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(
        jsonError('MIGRATION', 'Depo tablosu yok: npm run db:migrate', null, 'api.warehouse.migration')
      );
    }
    // eslint-disable-next-line no-console
    console.error('[getWarehouses]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function getSuppliers(_req, res) {
  try {
    const rows = await listSuppliers();
    return res.json(jsonOk({ suppliers: rows }));
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(
        jsonError('MIGRATION', 'Tedarikçi tablosu yok: npm run db:migrate 006', null, 'api.pur.migration_006')
      );
    }
    // eslint-disable-next-line no-console
    console.error('[getSuppliers]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function postSupplier(req, res) {
  const b = req.body || {};
  const out = await createSupplier({
    name: b.name,
    contact: b.contact,
    taxId: b.taxId,
    phone: b.phone,
    email: b.email,
    address: b.address,
    note: b.note,
    tax_number: b.tax_number,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'CREATE',
    module_name: 'purchasing',
    table_name: 'suppliers',
    record_id: out.id,
    new_data: { id: out.id, name: req.body?.name },
    description: 'Tedarikçi eklendi',
  });
  return res.status(201).json(jsonOk(out));
}

async function getRequests(req, res) {
  const q = req.query?.statuses;
  const statuses = q != null && String(q).trim() !== '' ? String(q).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const receiptInbox =
    String(req.query.receiptInbox || req.query.receipt_inbox || '') === '1' ||
    String(req.query.receiptInbox || '') === 'true';
  const out = await listPurchaseRequests({
    status: req.query?.status,
    statuses,
    projectId: req.query?.projectId,
    requestId: req.query?.id,
    receiptInbox,
  });
  if (out.error) {
    return res.status(500).json(validationOut(out));
  }
  return res.json(jsonOk(out));
}

/** GET /api/purchasing/requests/:id */
async function getRequestById(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const out = await getPurchaseRequestById(id);
  if (out.error) {
    const is404 = out.messageKey === 'api.pur.request_not_found';
    return res.status(is404 ? 404 : 400).json(validationOut(out));
  }
  return res.json(jsonOk({ request: out.request }));
}

/** GET /api/purchasing/requests/:id/receipt-orders — talebe bağlı açık siparişler (depo mal kabul) */
async function getRequestReceiptOrders(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const out = await listOpenOrderIdsForRequest(id);
  return res.json(jsonOk({ orderIds: out.orderIds || [] }));
}

/** PUT /api/purchasing/requests/:id */
async function putRequest(req, res) {
  const u = req.session.user;
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const b = req.body || {};
  const [[reqBefore]] = await pool.query('SELECT id, project_id, title, pr_status, status FROM purchase_requests WHERE id = ?', [id]);
  const out = await updatePurchaseRequest({
    id,
    userId: u.id,
    projectId: b.projectId,
    title: b.title,
    items: b.items,
    note: b.note,
    mode: b.mode,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  const [[reqAfter]] = await pool.query('SELECT id, project_id, title, pr_status, status FROM purchase_requests WHERE id = ?', [id]);
  if (reqAfter) {
    await logActivity(req, {
      action_type: 'UPDATE',
      module_name: 'purchasing',
      table_name: 'purchase_requests',
      record_id: id,
      old_data: reqBefore || null,
      new_data: { ...reqAfter, lineCount: Array.isArray(b.items) ? b.items.length : null },
      description: 'Satınalma talebi güncellendi',
    });
  }
  return res.json(jsonOk(out));
}

async function getNextRequestCode(req, res) {
  const out = await getNextRequestCodePreview(req.query?.projectId);
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.json(jsonOk(out));
}

async function getUnitsForPurchase(_req, res) {
  try {
    const out = await listUnitsForPurchase();
    return res.json(jsonOk(out));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getUnitsForPurchase]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function getProductsForPurchase(req, res) {
  try {
    const out = await listProductsForPurchase({
      warehouseId: req.query?.warehouseId,
      warehouseSubcategoryId: req.query?.warehouseSubcategoryId,
    });
    return res.json(jsonOk(out));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getProductsForPurchase]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function postLineAttachment(req, res) {
  if (!req.file) {
    return res.status(400).json(jsonError('VALIDATION', 'Dosya yok', null, 'api.pur.upload_required'));
  }
  const rel = `/uploads/purchase-req/${path.basename(req.file.path)}`;
  return res.json(jsonOk({ relPath: rel, url: rel }));
}

async function postRequest(req, res) {
  const u = req.session.user;
  const b = req.body || {};
  const out = await createPurchaseRequest({
    userId: u.id,
    projectId: b.projectId,
    title: b.title,
    items: b.items,
    note: b.note,
    mode: b.mode,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  const [[row]] = await pool.query('SELECT id, project_id, title, pr_status, status FROM purchase_requests WHERE id = ?', [out.id]);
  await logActivity(req, {
    action_type: 'CREATE',
    module_name: 'purchasing',
    table_name: 'purchase_requests',
    record_id: out.id,
    new_data: row || { id: out.id, requestCode: out.requestCode },
    description: 'Satınalma talebi oluşturuldu',
  });
  return res.status(201).json(jsonOk({ id: out.id, requestCode: out.requestCode }));
}

async function postRequestSubmit(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const [[b]] = await pool.query('SELECT pr_status, status, id FROM purchase_requests WHERE id = ?', [id]);
  const out = await submitDraftRequest({ id });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  const [[a]] = await pool.query("SELECT pr_status, status FROM purchase_requests WHERE id = ?", [id]);
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'purchasing',
    table_name: 'purchase_requests',
    record_id: id,
    old_data: b,
    new_data: a,
    description: 'Talep onaya gönderildi',
  });
  return res.json(jsonOk({ ok: true }));
}

async function postRequestCancel(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const [[b]] = await pool.query('SELECT pr_status, status, id FROM purchase_requests WHERE id = ?', [id]);
  const out = await cancelRequest({ id, allowed: ['draft', 'pending'] });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'purchasing',
    table_name: 'purchase_requests',
    record_id: id,
    old_data: b,
    new_data: { pr_status: 'cancelled' },
    description: 'Satınalma talebi iptal',
  });
  return res.json(jsonOk({ ok: true }));
}

async function patchRequestStatus(req, res) {
  const u = req.session.user;
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const [[before]] = await pool.query('SELECT id, pr_status, status FROM purchase_requests WHERE id = ?', [id]);
  const stRaw = String(req.body?.status || '');
  const out = await setRequestStatus({
    id,
    status: req.body?.status,
    userId: u.id,
    note: req.body?.note,
  });
  if (out.error) {
    const st = out.messageKey === 'api.pur.request_not_found' ? 404 : 400;
    return res.status(st).json(validationOut(out));
  }
  const [[after]] = await pool.query('SELECT pr_status, status FROM purchase_requests WHERE id = ?', [id]);
  let actionT = 'UPDATE';
  if (stRaw === 'approved') {
    actionT = 'APPROVE';
  } else if (stRaw === 'rejected') {
    actionT = 'REJECT';
  } else if (stRaw === 'revision_requested') {
    actionT = 'UPDATE';
  }
  await logActivity(req, {
    action_type: actionT,
    module_name: 'purchasing',
    table_name: 'purchase_requests',
    record_id: id,
    old_data: before,
    new_data: after,
    description: stRaw ? `Talep kararı: ${stRaw}` : 'Talep durumu',
  });
  return res.json(jsonOk({ ok: true }));
}

async function getApprovedRequestItems(_req, res) {
  const out = await listApprovedRequestItems();
  if (out.error) {
    return res.status(500).json(validationOut(out));
  }
  return res.json(jsonOk(out));
}

async function postOrder(req, res) {
  const u = req.session.user;
  const b = req.body || {};
  const out = await createPurchaseOrder({
    userId: u.id,
    supplierId: b.supplierId,
    orderDate: b.orderDate,
    deliveryDate: b.deliveryDate,
    paymentTerms: b.paymentTerms,
    currency: b.currency,
    note: b.note,
    lines: b.lines,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'CREATE',
    module_name: 'purchasing',
    table_name: 'purchase_orders',
    record_id: out.orderId,
    new_data: { orderId: out.orderId, supplierId: b.supplierId, lineCount: Array.isArray(b.lines) ? b.lines.length : 0 },
    description: 'Satınalma siparişi oluşturuldu',
  });
  return res.status(201).json(jsonOk({ orderId: out.orderId }));
}

async function getOrders(req, res) {
  const u = req.session.user;
  const hidePrice = !(await userHasPermission(u.id, u.role?.slug, 'module.purchasing'));
  const q = req.query?.statuses;
  const statuses = q != null && String(q).trim() !== '' ? String(q).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const openForReceipt =
    String(req.query.openForReceipt || req.query.forReceipt || '') === '1' || String(req.query.openForReceipt || '') === 'true';
  const forPricing =
    String(req.query.forPricing || '') === '1' || String(req.query.forPricing || '') === 'true';
  const completedByBuyer =
    String(req.query.completedByBuyer || req.query.completed || '') === '1' ||
    String(req.query.completedByBuyer || '') === 'true';
  const out = await listPurchaseOrders({
    status: req.query?.status,
    statuses,
    hidePrice,
    openForReceipt,
    forPricing,
    buyerStatus: req.query?.buyerStatus,
    completedByBuyer,
  });
  if (out.error) {
    return res.status(500).json(validationOut(out));
  }
  return res.json(jsonOk(out));
}

async function getOrder(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const u = req.session.user;
  const hidePrice = !(await userHasPermission(u.id, u.role?.slug, 'module.purchasing'));
  const out = await getPurchaseOrderById(id, { hidePrice });
  if (out.notFound) {
    return res.status(404).json(jsonError('NOT_FOUND', 'Sipariş yok', null, 'api.pur.order_not_found'));
  }
  return res.json(jsonOk(out));
}

async function putOrder(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const b = req.body || {};
  const out = await updatePurchaseOrder({
    id,
    supplierId: b.supplierId,
    orderDate: b.orderDate,
    deliveryDate: b.deliveryDate,
    currency: b.currency,
    note: b.note,
    lines: b.lines,
  });
  if (out.error) {
    const code = out.messageKey === 'api.pur.order_readonly' ? 409 : 400;
    return res.status(code).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'purchasing',
    table_name: 'purchase_orders',
    record_id: id,
    description: 'Sipariş güncellendi (satınalma işleme)',
  });
  return res.json(jsonOk({ ok: true }));
}

async function putOrderPricing(req, res) {
  try {
    const id = parseId(req.params.id);
    if (id == null) {
      return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
    }
    const u = req.session.user;
    const b = req.body || {};
    const out = await updatePurchaseOrderPricing({
      id,
      supplierId: b.supplierId,
      orderDate: b.orderDate,
      deliveryDate: b.deliveryDate,
      currency: b.currency,
      note: b.note,
      lines: b.lines,
      userId: u.id,
    });
    if (out.error) {
      const code = out.messageKey === 'api.pur.order_readonly' ? 409 : 400;
      return res.status(code).json(validationOut(out));
    }
    await logActivity(req, {
      action_type: 'UPDATE',
      module_name: 'purchasing',
      table_name: 'purchase_orders',
      record_id: id,
      new_data: { pricingStatus: out.pricingStatus, changes: out.lineChanges || [] },
      description: 'Sipariş fiyatları güncellendi (satınalma işleme)',
    });
    return res.json(jsonOk(out));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : 'Internal server error',
    });
  }
}

async function postOrderStartProcessing(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const out = await setProcurementStateForOrderStart(id);
  if (out.error) {
    const code = out.messageKey === 'api.pur.order_readonly' ? 409 : 400;
    return res.status(code).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'purchasing',
    table_name: 'purchase_orders',
    record_id: id,
    description: 'Tedarik süreci (taleplerde gösterim)',
  });
  return res.json(jsonOk(out));
}

async function postRequestBuyerAction(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const u = req.session.user;
  const b = req.body || {};
  const out = await runRequestBuyerAction({
    userId: u.id,
    id,
    action: b.action,
    lines: b.lines,
    orderDate: b.orderDate,
    deliveryDate: b.deliveryDate,
    note: b.note,
    currency: b.currency,
  });
  if (out.error) {
    const code =
      out.messageKey === 'api.pur.request_not_approved'
        ? 409
        : out.messageKey === 'api.pur.request_not_found'
          ? 404
          : 400;
    return res.status(code).json(validationOut(out));
  }
  const desc =
    String(b.action) === 'complete'
      ? `Talep siparişe dönüştürüldü (orderIds=${(out.orderIds || []).join(',')})`
      : 'Talep işleme alındı (satınalmacı)';
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'purchasing',
    table_name: 'purchase_requests',
    record_id: id,
    description: desc,
  });
  return res.json(jsonOk(out));
}

async function postOrderBuyerAction(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const action = req.body && req.body.action;
  const out = await runOrderBuyerAction({ id, action });
  if (out.error) {
    const code = out.messageKey === 'api.pur.order_readonly' ? 409 : 400;
    return res.status(code).json(validationOut(out));
  }
  const desc =
    String(action) === 'ready'
      ? 'Satınalmacı: depo / mal kabul için hazır'
      : String(action) === 'complete'
        ? 'Satınalmacı: sipariş tamamlandı'
        : String(action) === 'revise'
          ? 'Satınalmacı: sipariş revize istendi'
          : 'Satınalmacı: işleme alındı (İşleniyor)';
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'purchasing',
    table_name: 'purchase_orders',
    record_id: id,
    new_data: { action, buyerStatus: out.buyerStatus || null },
    description: desc,
  });
  return res.json(jsonOk(out));
}

async function postGoodsReceipt(req, res) {
  const u = req.session.user;
  const b = req.body || {};
  const out = await createGoodsReceipt({
    userId: u.id,
    orderId: b.orderId,
    note: b.note,
    lines: b.lines,
    auditReq: req,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'CREATE',
    module_name: 'purchasing',
    table_name: 'goods_receipts',
    record_id: out.goodsReceiptId,
    new_data: { orderId: b.orderId, goodsReceiptId: out.goodsReceiptId, orderStatus: out.orderStatus },
    description: 'Mal kabul kaydı',
  });
  return res.status(201).json(jsonOk(out));
}

module.exports = {
  getScope,
  getProductOptions,
  getProjectsBrief,
  getNextRequestCode,
  getUnitsForPurchase,
  getProductsForPurchase,
  lineUpload,
  postLineAttachment,
  getWarehouses,
  getSuppliers,
  postSupplier,
  getRequests,
  getRequestById,
  getRequestReceiptOrders,
  putRequest,
  postRequest,
  postRequestSubmit,
  postRequestCancel,
  patchRequestStatus,
  getApprovedRequestItems,
  postOrder,
  getOrders,
  getOrder,
  putOrder,
  putOrderPricing,
  postOrderStartProcessing,
  postOrderBuyerAction,
  postRequestBuyerAction,
  postGoodsReceipt,
};
