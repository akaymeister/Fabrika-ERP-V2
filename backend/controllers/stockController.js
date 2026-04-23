const multer = require('multer');
const { pool } = require('../config/database');
const { listBrands, createBrand, updateBrand, deleteBrand } = require('../services/stockBrandService');
const { listProducts, createProduct, updateProduct, deleteProduct: deleteProductService } = require('../services/stockProductService');
const { buildTemplateBuffer, importProductsFromExcelBuffer } = require('../services/stockProductImportService');
const {
  listMovements,
  recordMovement,
  recordMovementIn,
  recordMovementOut,
  voidStockInMovement,
  voidStockOutMovement,
  replaceStockInMovement,
  replaceStockOutMovement,
} = require('../services/stockMovementService');
const { listActiveProjectsBrief } = require('../services/projectService');
const {
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} = require('../services/warehouseService');
const { jsonOk, jsonError } = require('../utils/apiResponse');
const { toUpperTr } = require('../utils/textNormalize');

const productImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
});

function validationOut(out) {
  return jsonError('VALIDATION', out.error, null, out.messageKey);
}

async function getBrands(req, res) {
  try {
    const rows = await listBrands();
    return res.json(jsonOk({ brands: rows }));
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(
        jsonError('MIGRATION', 'Marka tablosu yok: npm run db:migrate', null, 'api.stock.brands_migration')
      );
    }
    // eslint-disable-next-line no-console
    console.error('[getBrands]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function postBrand(req, res) {
  const out = await createBrand(req.body?.name);
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.status(201).json(jsonOk({ id: out.id }));
}

async function patchBrand(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const out = await updateBrand(id, req.body?.name);
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.json(jsonOk(out));
}

async function removeBrand(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const out = await deleteBrand(id);
  if (out.error) {
    if (out.messageKey === 'api.stock.brand_not_found') {
      return res.status(404).json(validationOut(out));
    }
    if (
      out.messageKey === 'api.stock.brand_in_use' ||
      out.messageKey === 'api.stock.brand_system_cannot_delete'
    ) {
      return res.status(400).json(validationOut(out));
    }
    return res.status(400).json(validationOut(out));
  }
  return res.json(jsonOk({ ok: true }));
}

async function getUnits(req, res) {
  try {
    const [rows] = await pool.query('SELECT id, code, is_system, sort_order FROM units ORDER BY sort_order, id');
    return res.json(jsonOk({ units: rows }));
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(
        jsonError('MIGRATION', 'Birim tablosu yok: npm run db:migrate (004)', null, 'api.stock.units_migration')
      );
    }
    throw e;
  }
}

async function postUnit(req, res) {
  const raw = String(req.body?.code || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (raw.length < 1) {
    return res.status(400).json(jsonError('VALIDATION', 'Birim kodu gerekli (ör. m, lt)', null, 'api.stock.unit_code_required'));
  }
  const code = toUpperTr(raw);
  try {
    const [r] = await pool.query('INSERT INTO units (code, is_system, sort_order) VALUES (?, 0, 99)', [code]);
    return res.status(201).json(jsonOk({ id: r.insertId, code }));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(jsonError('VALIDATION', 'Bu birim zaten var', null, 'api.stock.unit_exists'));
    }
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(
        jsonError('MIGRATION', 'Birim tablosu yok: npm run db:migrate (004)', null, 'api.stock.units_migration')
      );
    }
    throw e;
  }
}

async function getProducts(req, res) {
  try {
    const rows = await listProducts({
      brandId: req.query.brandId,
      q: req.query.q,
      warehouseId: req.query.warehouseId,
      warehouseSubcategoryId: req.query.warehouseSubcategoryId,
    });
    return res.json(jsonOk({ products: rows }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getProducts]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function postProduct(req, res) {
  const b = req.body;
  const out = await createProduct({
    materialLabel: b?.materialLabel ?? b?.name,
    widthMm: b?.widthMm,
    heightMm: b?.heightMm,
    depthMm: b?.depthMm,
    unitId: b?.unitId,
    brandId: b?.brandId,
    unitPrice: b?.unitPrice,
    fxUzsPerUsd: b?.fxUzsPerUsd,
    warehouseId: b?.warehouseId,
    warehouseSubcategoryId: b?.warehouseSubcategoryId,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.status(201).json(
    jsonOk({
      id: out.id,
      productCode: out.productCode,
      name: out.name,
      m2PerPiece: out.m2PerPiece,
      warn: out.warn,
      warnKey: out.warnKey,
    })
  );
}

async function getProductImportTemplate(_req, res) {
  try {
    const buf = buildTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="urun_import_sablonu.xlsx"');
    return res.send(buf);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getProductImportTemplate]', e);
    return res.status(500).json(jsonError('IO', e.message || 'XLSX hatası', null, 'api.error.unknown'));
  }
}

async function postProductImport(req, res) {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json(jsonError('VALIDATION', 'Excel/CSV dosyası gerekli (file)', null, 'api.stock.import_file_required'));
  }
  const out = await importProductsFromExcelBuffer(req.file.buffer);
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.json(jsonOk(out));
}

async function patchProduct(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const b = req.body;
  const out = await updateProduct(id, {
    materialLabel: b?.materialLabel,
    widthMm: b?.widthMm,
    heightMm: b?.heightMm,
    depthMm: b?.depthMm,
    unitPrice: b?.unitPrice,
    unitId: b?.unitId,
    fxUzsPerUsd: b?.fxUzsPerUsd,
    brandId: b?.brandId,
    warehouseId: b?.warehouseId,
    warehouseSubcategoryId: b?.warehouseSubcategoryId,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.json(jsonOk(out));
}

async function removeProduct(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const out = await deleteProductService(id);
  if (out.error) {
    if (out.messageKey === 'api.stock.product_not_found') {
      return res.status(404).json(validationOut(out));
    }
    return res.status(400).json(validationOut(out));
  }
  return res.json(jsonOk({ ok: true }));
}

async function getMovements(req, res) {
  try {
    const rows = await listMovements({
      productId: req.query.productId,
      movementType: req.query.movementType,
      projectId: req.query.projectId,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json(jsonOk({ movements: rows }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getMovements]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function getActiveProjectsForStock(_req, res) {
  try {
    const rows = await listActiveProjectsBrief();
    return res.json(jsonOk({ projects: rows }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getActiveProjectsForStock]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

/** Giriş veya çıkış hareketi sil (açıklama zorunlu) */
async function postVoidMovement(req, res) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json(jsonError('VALIDATION', 'Geçersiz hareket id', null, 'api.stock.movement_id_invalid'));
    }
    if (!req.body?.reason || !String(req.body.reason).trim()) {
      return res
        .status(400)
        .json(jsonError('VALIDATION', 'Açıklama zorunludur', null, 'api.stock.void_reason_required'));
    }
    const [[row]] = await pool.query('SELECT movement_type AS t FROM stock_movements WHERE id = ? LIMIT 1', [id]);
    if (!row) {
      return res.status(404).json(jsonError('NOT_FOUND', 'Hareket bulunamadı', null, 'api.stock.movement_not_found'));
    }
    const uid = req.session.user.id;
    const t = String(row.t || '').toLowerCase();
    let out;
    if (t === 'in') {
      out = await voidStockInMovement({ movementId: id, userId: uid, reason: req.body.reason, kind: 'delete' });
    } else if (t === 'out') {
      out = await voidStockOutMovement({ movementId: id, userId: uid, reason: req.body.reason, kind: 'delete' });
    } else {
      return res.status(400).json(
        jsonError('VALIDATION', 'Bu hareket tipi silinemez', null, 'api.stock.movement_void_type_invalid')
      );
    }
    if (out.error) {
      return res.status(400).json(validationOut(out));
    }
    return res.json(jsonOk(out));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[postVoidMovement]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function postReplaceStockIn(req, res) {
  try {
    const uid = req.session.user.id;
    const b = req.body || {};
    if (!b.reason || !String(b.reason).trim()) {
      return res
        .status(400)
        .json(jsonError('VALIDATION', 'Açıklama zorunludur', null, 'api.stock.void_reason_required'));
    }
    const inParams = {
      productId: b.productId,
      note: b.note,
      qtyPieces: b.qtyPieces,
      qtyM2: b.qtyM2,
      projectId: b.projectId,
      inputCurrency: b.inputCurrency,
      lineTotalUzs: b.lineTotalUzs,
      lineTotalUsd: b.lineTotalUsd,
      fxUzsPerUsd: b.fxUzsPerUsd,
    };
    const out = await replaceStockInMovement({
      oldMovementId: req.params.id,
      userId: uid,
      reason: b.reason,
      inParams,
    });
    if (out.error) {
      return res.status(400).json(validationOut(out));
    }
    return res.status(201).json(jsonOk(out));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[postReplaceStockIn]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

/** Çıkış hareketi düzelt: açıklama + yeni çıkış bilgileri */
async function postReplaceStockOut(req, res) {
  try {
    const uid = req.session.user.id;
    const b = req.body || {};
    if (!b.reason || !String(b.reason).trim()) {
      return res
        .status(400)
        .json(jsonError('VALIDATION', 'Açıklama zorunludur', null, 'api.stock.void_reason_required'));
    }
    const out = await replaceStockOutMovement({
      oldMovementId: req.params.id,
      userId: uid,
      reason: b.reason,
      outParams: {
        productId: b.productId,
        projectId: b.projectId,
        qtyPieces: b.qtyPieces,
        qtyM2: b.qtyM2,
        note: b.note,
      },
    });
    if (out.error) {
      return res.status(400).json(validationOut(out));
    }
    return res.status(201).json(jsonOk(out));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[postReplaceStockOut]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function postMovement(req, res) {
  const b = req.body;
  const uid = req.session.user.id;
  const type = String(b?.movementType || '').toLowerCase();

  if (type === 'in') {
    const hasFin = (Number(b?.lineTotalUzs) > 0) || (Number(b?.lineTotalUsd) > 0);
    if (hasFin || b?.inputCurrency) {
      const out = await recordMovementIn({
        productId: b.productId,
        userId: uid,
        note: b.note,
        qtyPieces: b.qtyPieces,
        qtyM2: b.qtyM2,
        projectId: b.projectId,
        inputCurrency: b.inputCurrency,
        lineTotalUzs: b.lineTotalUzs,
        lineTotalUsd: b.lineTotalUsd,
        fxUzsPerUsd: b.fxUzsPerUsd,
      });
      if (out.error) {
        return res.status(400).json(validationOut(out));
      }
      return res.status(201).json(jsonOk(out));
    }
  }

  if (type === 'out') {
    const out = await recordMovementOut({
      productId: b.productId,
      userId: uid,
      note: b.note,
      qtyM2: b.qtyM2,
      qtyPieces: b.qtyPieces,
      projectId: b.projectId,
    });
    if (out.error) {
      return res.status(400).json(validationOut(out));
    }
    return res.status(201).json(jsonOk(out));
  }

  const out = await recordMovement({
    productId: b?.productId,
    movementType: b?.movementType,
    qty: b?.qty,
    userId: uid,
    note: b?.note,
    refType: b?.refType,
    refId: b?.refId,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.status(201).json(jsonOk(out));
}

async function getWarehouses(_req, res) {
  try {
    const rows = await listWarehouses();
    return res.json(jsonOk({ warehouses: rows }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getWarehouses]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function postWarehouse(req, res) {
  const out = await createWarehouse(req.body?.name);
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.status(201).json(jsonOk({ id: out.id }));
}

async function patchWarehouse(req, res) {
  const wid = parseInt(String(req.params.id), 10);
  const out = await updateWarehouse(wid, req.body?.name);
  if (out.error) {
    const status = out.messageKey === 'api.warehouse.not_found' ? 404 : 400;
    return res.status(status).json(validationOut(out));
  }
  return res.json(jsonOk({ name: out.name }));
}

async function postWarehouseSub(req, res) {
  const wid = parseInt(String(req.params.id), 10);
  const out = await createSubcategory(wid, req.body?.name);
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  return res.status(201).json(jsonOk({ id: out.id }));
}

async function patchWarehouseSub(req, res) {
  const wid = parseInt(String(req.params.id), 10);
  const subId = parseInt(String(req.params.subId), 10);
  const out = await updateSubcategory(wid, subId, req.body?.name);
  if (out.error) {
    const status = out.messageKey === 'api.warehouse.sub_not_found' ? 404 : 400;
    return res.status(status).json(validationOut(out));
  }
  return res.json(jsonOk({ name: out.name }));
}

function httpStatusForWarehouseError(messageKey) {
  if (messageKey === 'api.warehouse.sub_not_found') {
    return 404;
  }
  return 400;
}

async function removeWarehouseSub(req, res) {
  const wid = parseInt(String(req.params.id), 10);
  const subId = parseInt(String(req.params.subId), 10);
  const out = await deleteSubcategory(wid, subId);
  if (out.error) {
    return res.status(httpStatusForWarehouseError(out.messageKey)).json(validationOut(out));
  }
  return res.json(jsonOk({ ok: true }));
}

module.exports = {
  getBrands,
  postBrand,
  patchBrand,
  removeBrand,
  getUnits,
  postUnit,
  getProducts,
  getProductImportTemplate,
  postProductImport,
  postProduct,
  patchProduct,
  removeProduct,
  productImportUpload,
  getMovements,
  getActiveProjectsForStock,
  postMovement,
  postVoidMovement,
  postReplaceStockIn,
  postReplaceStockOut,
  getWarehouses,
  postWarehouse,
  patchWarehouse,
  postWarehouseSub,
  patchWarehouseSub,
  removeWarehouseSub,
};
