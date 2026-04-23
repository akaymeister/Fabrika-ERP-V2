const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { userHasPermission } = require('../services/accessService');
const { listActiveProjectsBrief } = require('../services/projectService');
const { listWarehouses } = require('../services/warehouseService');
const { jsonOk, jsonError } = require('../utils/apiResponse');
const { FRONTEND_PUBLIC } = require('../utils/paths');
const {
  listProductOptions,
  listSuppliers,
  createSupplier,
  listUnitsForPurchase,
  listProductsForPurchase,
  getNextRequestCodePreview,
  listPurchaseRequests,
  createPurchaseRequest,
  submitDraftRequest,
  cancelRequest,
  setRequestStatus,
  listApprovedRequestItems,
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrderById,
  createGoodsReceipt,
} = require('../services/purchasingService');

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
  const canReceipt = await userHasPermission(u.id, u.role?.slug, 'module.purchasing.receipt');
  return res.json(jsonOk({ canPurchasing, canReceipt }));
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
  const out = await createSupplier({ name: req.body?.name, contact: req.body?.contact, taxId: req.body?.taxId });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.status(201).json(jsonOk(out));
}

async function getRequests(req, res) {
  const out = await listPurchaseRequests({ status: req.query?.status, projectId: req.query?.projectId });
  if (out.error) {
    return res.status(500).json(validationOut(out));
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
  return res.status(201).json(jsonOk({ id: out.id, requestCode: out.requestCode }));
}

async function postRequestSubmit(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const out = await submitDraftRequest({ id });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.json(jsonOk({ ok: true }));
}

async function postRequestCancel(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const out = await cancelRequest({ id, allowed: ['draft', 'pending'] });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.json(jsonOk({ ok: true }));
}

async function patchRequestStatus(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.pur.id_invalid'));
  }
  const out = await setRequestStatus({ id, status: req.body?.status });
  if (out.error) {
    const st = out.messageKey === 'api.pur.request_not_found' ? 404 : 400;
    return res.status(st).json(validationOut(out));
  }
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
  return res.status(201).json(jsonOk({ orderId: out.orderId }));
}

async function getOrders(req, res) {
  const u = req.session.user;
  const hidePrice = !(await userHasPermission(u.id, u.role?.slug, 'module.purchasing'));
  const out = await listPurchaseOrders({ status: req.query?.status, hidePrice });
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

async function postGoodsReceipt(req, res) {
  const u = req.session.user;
  const b = req.body || {};
  const out = await createGoodsReceipt({
    userId: u.id,
    orderId: b.orderId,
    warehouseId: b.warehouseId,
    waybillNumber: b.waybillNumber,
    note: b.note,
    lines: b.lines,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
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
  postRequest,
  postRequestSubmit,
  postRequestCancel,
  patchRequestStatus,
  getApprovedRequestItems,
  postOrder,
  getOrders,
  getOrder,
  postGoodsReceipt,
};
