const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { toUpperTr, optionalNoteUpperTr } = require('../utils/textNormalize');
const { recordMovementIn } = require('./stockMovementService');
const { usdToSystemAmount } = require('./systemSettingsService');
const { listProducts, m3FromStockM2AndDepth } = require('./stockProductService');
const { logActivity } = require('./activityLogService');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function legacyStatusFromPrStatus(pr) {
  const s = String(pr);
  if (s === 'pending') return 'submitted';
  if (s === 'revision_requested') return 'submitted';
  return s;
}

function isM2Unit(code) {
  const u = String(code || '')
    .trim()
    .toLowerCase();
  return u === 'm2' || u === 'm²' || u === 'sqm';
}

/**
 * Sistem m²: talep / sipariş satırındaki miktar ve birim
 */
function qtyToSystemM2(qty, unitCode, m2p) {
  const q = Number(qty) || 0;
  if (q <= 0) return 0;
  if (isM2Unit(unitCode)) return q;
  const p = Number(m2p) || 0;
  if (p > 0) return q * p;
  return q;
}

function isM2ByProductRow(p) {
  const c = p.unit_code || p.unit || p.unit_legacy || '';
  return isM2Unit(c);
}

function isM3Unit(code) {
  const u = String(code || '')
    .trim()
    .toLowerCase();
  return u === 'm3' || u.includes('m³') || u.includes('m3');
}

function normalizeReceiptStatusValue(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s || s === 'awaiting_receipt') return 'pending';
  if (s === 'partially_received' || s === 'partial_received' || s === 'partial') return 'partial';
  if (s === 'received_completed' || s === 'completed') return 'completed';
  if (s === 'cancelled') return 'cancelled';
  return s;
}

function normalizePricingStatusValue(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return 'unpriced';
  if (s === 'fully_priced' || s === 'priced') return 'priced';
  if (s === 'partially_priced') return 'partially_priced';
  return s;
}

function normalizeBuyerStatusValue(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return 'draft';
  if (s === 'ready_for_warehouse') return 'completed';
  return s;
}

/** Satır iptali (line_status); kolon yoksa tüm satırlar aktif sayılır */
function isPurchaseOrderLineCancelled(row) {
  const s = String(row && row.line_status).trim().toLowerCase();
  return s === 'cancelled';
}

function normalizePricingCurrency(raw) {
  const cur = String(raw || '').trim().toUpperCase();
  if (cur === 'SYSTEM') return 'UZS';
  return cur;
}

function isSupportedPricingCurrency(raw) {
  const cur = normalizePricingCurrency(raw);
  return cur === 'UZS' || cur === 'USD';
}

function calcUzsUsdTotals({ unitPrice, qty, currency, fxRate }) {
  const up = Number(unitPrice) || 0;
  const q = Number(qty) || 0;
  const fx = Number(fxRate);
  if (up <= 0 || q <= 0 || !Number.isFinite(fx) || fx <= 0) {
    return { totalUzs: 0, totalUsd: 0 };
  }
  const cur = normalizePricingCurrency(currency);
  if (cur === 'USD') {
    const totalUsd = up * q;
    return { totalUsd, totalUzs: usdToSystemAmount(totalUsd, fx) };
  }
  const totalUzs = up * q;
  return { totalUzs, totalUsd: totalUzs / fx };
}

function movementQtyFromOrderUnit(qty, unitCode, m2p) {
  const actualQty = Number(qty) || 0;
  const safeUnit = String(unitCode || '').trim();
  const qtyM2 = qtyToSystemM2(actualQty, safeUnit, m2p);
  if (actualQty <= 0) {
    return { actualQty: 0, qtyM2: 0, qtyPieces: 0, unitCode: safeUnit };
  }
  if (isM2Unit(safeUnit)) {
    return { actualQty, qtyM2, qtyPieces: null, unitCode: safeUnit };
  }
  return { actualQty, qtyM2, qtyPieces: actualQty, unitCode: safeUnit };
}

function primaryUnitCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function calcM2FromPrimaryQty(qty, unitCode, m2p) {
  const q = Number(qty) || 0;
  if (q <= 0) return null;
  const calcM2 = qtyToSystemM2(q, unitCode, m2p);
  return Number.isFinite(calcM2) && calcM2 > 0 ? calcM2 : null;
}

function calcM3FromPrimaryQty(qty, unitCode, m2p, depthMm) {
  const q = Number(qty) || 0;
  if (q <= 0) return null;
  if (isM3Unit(unitCode)) return q;
  const calcM2 = calcM2FromPrimaryQty(q, unitCode, m2p);
  const depth = Number(depthMm) || 0;
  if (!Number.isFinite(calcM2) || calcM2 <= 0 || depth <= 0) return null;
  return m3FromStockM2AndDepth(calcM2, depth);
}

function toPositiveIntOrNull(v) {
  if (v == null || v === '') {
    return null;
  }
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Arayüz: mevcut stok sütunu — m²/m³ göstermez; ana hareket birimine göre (adet, plaka, kg, …)
 */
function primaryStockDisplay(p) {
  if (!p) {
    return { value: 0, label: '—', text: '—' };
  }
  const raw = p.unit_code || p.unit || p.unit_legacy || 'adet';
  const uc = String(raw).toLowerCase();
  const pieces = Number(p.stock_pieces);
  const sqty = Number(p.stock_qty);
  const hasP = p.stock_pieces != null && p.stock_pieces !== '' && Number.isFinite(pieces);
  const hasQ = p.stock_qty != null && p.stock_qty !== '' && Number.isFinite(sqty);
  const fmt = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(Number(n) || 0);
  const trLab = (s) => {
    const t = String(s || '').trim();
    if (!t) return '';
    return t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
  };

  if (isM2Unit(raw) || isM3Unit(raw)) {
    if (hasP) {
      return { value: pieces, label: 'Plaka', text: `${fmt(pieces)} Plaka` };
    }
    return { value: 0, label: 'Plaka', text: '0 Plaka' };
  }
  if (uc === 'kg' || uc === 'g' || uc.includes('kg') || uc.includes(' gr')) {
    const q = hasQ ? sqty : hasP ? pieces : 0;
    return { value: q, label: 'Kg', text: `${fmt(q)} Kg` };
  }
  if (uc.includes('plaka') || uc === 'plk' || uc === 'plt') {
    return { value: hasP ? pieces : 0, label: 'Plaka', text: `${fmt(hasP ? pieces : 0)} Plaka` };
  }
  if (uc === 'adet' || uc === 'ad' || uc === 'pc' || uc === 'piece' || uc === 'x' || uc === 'pkt') {
    const q = hasP ? pieces : hasQ ? sqty : 0;
    return { value: q, label: 'Adet', text: `${fmt(q)} Adet` };
  }
  const qv = hasP ? pieces : hasQ ? sqty : 0;
  const lab = trLab(raw) || 'Adet';
  return { value: qv, label: lab, text: `${fmt(qv)} ${lab}` };
}

async function hasCol(a, b, c) {
  const conn = c === undefined ? pool : a;
  const t = c === undefined ? a : b;
  const col = c === undefined ? b : c;
  const [r] = await conn.query(
    'SELECT COUNT(*) AS a FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [t, col]
  );
  return r[0].a > 0;
}
async function tableExists(t) {
  const [r] = await pool.query(
    'SELECT COUNT(*) AS a FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [t]
  );
  return r[0].a > 0;
}

/* ---------- Tedarikçi ---------- */
async function listProductOptions() {
  const [rows] = await pool.query(
    `SELECT p.id, p.product_code, p.name, p.m2_per_piece, p.unit AS unit_legacy, u.code AS unit_code
     FROM products p
     LEFT JOIN units u ON u.id = p.unit_id
     ORDER BY p.product_code
     LIMIT 5000`
  );
  for (const r of rows) {
    if (!r.unit_code) r.unit_code = r.unit_legacy || 'adet';
  }
  return { products: rows };
}

async function supplierExtraCols() {
  const extras = {};
  for (const c of ['phone', 'email', 'address', 'note', 'tax_number']) {
    extras[c] = await hasCol('suppliers', c);
  }
  return extras;
}

async function listSuppliers() {
  const ex = await supplierExtraCols();
  const cols = ['id', 'name', 'contact', 'tax_id'];
  if (ex.phone) cols.push('phone');
  if (ex.email) cols.push('email');
  if (ex.address) cols.push('address');
  if (ex.note) cols.push('note');
  if (ex.tax_number) cols.push('tax_number');
  cols.push('created_at');
  const [rows] = await pool.query(`SELECT ${cols.join(', ')} FROM suppliers ORDER BY name`);
  return rows;
}

async function createSupplier({ name, contact, taxId, phone, email, address, note, tax_number }) {
  const n = toUpperTr(String(name || '').trim());
  if (!n) {
    return err('Tedarikçi adı gerekli', 'api.pur.supplier_name_required');
  }
  const ex = await supplierExtraCols();
  const cols = ['name', 'contact', 'tax_id'];
  const vals = [n, contact || null, taxId || tax_number || null];
  if (ex.phone) { cols.push('phone'); vals.push(phone || null); }
  if (ex.email) { cols.push('email'); vals.push(email || null); }
  if (ex.address) { cols.push('address'); vals.push(address || null); }
  if (ex.note) { cols.push('note'); vals.push(note || null); }
  if (ex.tax_number) { cols.push('tax_number'); vals.push(tax_number || null); }
  const ph = cols.map(() => '?').join(',');
  const [r] = await pool.query(`INSERT INTO suppliers (${cols.join(',')}) VALUES (${ph})`, vals);
  return { id: r.insertId, name: n };
}

async function listUnitsForPurchase() {
  const [rows] = await pool.query('SELECT id, code, is_system, sort_order FROM units ORDER BY sort_order, id');
  return { units: rows };
}

async function listProductsForPurchase({ warehouseId, warehouseSubcategoryId }) {
  const rows = await listProducts({
    warehouseId: warehouseId != null && warehouseId !== '' ? parseInt(String(warehouseId), 10) : undefined,
    warehouseSubcategoryId: warehouseSubcategoryId != null && warehouseSubcategoryId !== '' ? parseInt(String(warehouseSubcategoryId), 10) : undefined,
  });
  return {
    products: rows.map((r) => {
      const p = { ...r };
      if (!p.unit_code) p.unit_code = p.unit || p.unit_legacy;
      return { ...p, stock_display: primaryStockDisplay(p) };
    }),
  };
}

/**
 * AHKFC-ST001 formatı: proje company_code + ST + 3 hane (aynı projede seri)
 */
async function getNextRequestCodePreview(projectId) {
  if (!(await hasCol('purchase_requests', 'request_code'))) {
    return err('DB: 006b', 'api.pur.migration_006b');
  }
  const pid = parseInt(String(projectId), 10);
  if (!Number.isFinite(pid) || pid < 1) {
    return err('Proje gerekli', 'api.pur.project_required');
  }
  const [[prj]] = await pool.query("SELECT id, company_code FROM projects WHERE id = ? AND status = 'active' LIMIT 1", [pid]);
  if (!prj) {
    return err('Geçersiz proje', 'api.pur.project_invalid');
  }
  const code = await computeNextRequestCodeForProject(null, pid, prj.company_code);
  return { requestCode: code };
}

async function computeNextRequestCodeForProject(conn, projectId, companyCodeOpt) {
  const q = conn && conn.query ? (sql, p) => conn.query(sql, p) : (sql, p) => pool.query(sql, p);
  let cc = companyCodeOpt;
  if (cc == null) {
    const [[prj]] = await q('SELECT company_code FROM projects WHERE id = ?', [projectId]);
    cc = prj && prj.company_code;
  }
  const company = String(cc || 'AHKFC')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const safe = company || 'AHKFC';
  const [rows] = await q(
    "SELECT request_code FROM purchase_requests WHERE project_id = ? AND request_code IS NOT NULL AND request_code != ''",
    [projectId]
  );
  const re = new RegExp(`^${escapeRegex(safe)}-ST(\\d+)$`, 'i');
  let maxN = 0;
  for (const r of rows) {
    const m = String(r.request_code || '').match(re);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `${safe}-ST${String(maxN + 1).padStart(3, '0')}`;
}

/** Sipariş oluşturulunca talep durumu: tamamı PO'da mı, kısmi mi */
async function recomputeRequestStatusAfterPoLines(conn, requestIds) {
  const u = [...new Set((requestIds || []).filter((x) => x != null).map((x) => parseInt(String(x), 10)))];
  for (const rid of u) {
    if (!Number.isFinite(rid) || rid < 1) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const [[cnt]] = await conn.query('SELECT COUNT(*) AS n FROM purchase_request_items WHERE request_id = ?', [rid]);
    const [[cntP]] = await conn.query(
      `SELECT COUNT(*) AS n FROM purchase_request_items pri
       WHERE pri.request_id = ? AND EXISTS (SELECT 1 FROM purchase_order_items poi WHERE poi.request_item_id = pri.id)`,
      [rid]
    );
    const t = Number(cnt.n);
    const p = Number(cntP.n);
    if (p <= 0) {
      // eslint-disable-next-line no-continue
      continue;
    }
    let nst = 'partial';
    if (t > 0 && p >= t) nst = 'ordered';
    const leg = legacyStatusFromPrStatus(nst);
    await conn.query('UPDATE purchase_requests SET pr_status = ?, `status` = ? WHERE id = ?', [nst, leg, rid]);
  }
}

/* ---------- Talepler ---------- */
async function loadProductForPurchasing(productId) {
  const pid = toPositiveIntOrNull(productId);
  if (!pid) {
    return null;
  }
  const [rows] = await pool.query(
    `SELECT p.*, u.code AS unit_code, u.code AS u_code
     FROM products p
     LEFT JOIN units u ON u.id = p.unit_id
     WHERE p.id = ?
     LIMIT 1`,
    [pid]
  );
  if (!rows.length) {
    return null;
  }
  const p = rows[0];
  if (!p.unit_code) {
    p.unit_code = p.unit || p.unit_legacy || 'adet';
  }
  return p;
}

/** request_code, pr_status kolonlarını 006b patch doldurur */
async function listPurchaseRequests({ status, statuses, projectId, requestId, receiptInbox } = {}) {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: npm run db:patch-6b (purchase_requests sütunları)', 'api.pur.migration_006b');
  }
  let where = '1=1';
  const p = [];
  if (requestId != null && requestId !== '') {
    where += ' AND pr.id = ?';
    p.push(parseInt(String(requestId), 10));
  }
  if (receiptInbox) {
    where +=
      " AND COALESCE(NULLIF(TRIM(pr.pr_status), ''), 'pending') NOT IN ('draft', 'cancelled', 'rejected')";
  } else if (statuses && Array.isArray(statuses) && statuses.length) {
    const safe = statuses.map((s) => String(s).trim()).filter(Boolean);
    if (safe.length) {
      where += ` AND pr.pr_status IN (${safe.map(() => '?').join(',')})`;
      p.push(...safe);
    }
  } else if (status) {
    where += ' AND pr.pr_status = ?';
    p.push(String(status));
  }
  if (projectId) {
    where += ' AND pr.project_id = ?';
    p.push(parseInt(String(projectId), 10));
  }
  const exSm = await hasCol('purchase_requests', 'status_message');
  const exProc = await hasCol('purchase_requests', 'procurement_state');
  const extraSel = exSm
    ? ', pr.status_message, pr.decided_by, pr.decided_at, COALESCE(NULLIF(TRIM(ua.full_name), \'\'), ua.username) AS approver_name'
    : '';
  const procSel = exProc ? ', pr.procurement_state' : '';
  const extraJoin = exSm ? 'LEFT JOIN users ua ON ua.id = pr.decided_by' : '';
  const [list] = await pool.query(
    `SELECT pr.id, pr.request_code, pr.title, pr.pr_status, pr.project_id, pr.requester_id, pr.created_at, pr.note,
            prj.project_code, prj.name AS project_name,
            COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS requester_name
            ${procSel}
            ${extraSel}
     FROM purchase_requests pr
     LEFT JOIN projects prj ON prj.id = pr.project_id
     LEFT JOIN users u ON u.id = pr.requester_id
     ${extraJoin}
     WHERE ${where}
     ORDER BY pr.id DESC
     LIMIT 200`,
    p
  );
  let items = [];
  if (list.length) {
    const exW = await hasCol('purchase_request_items', 'warehouse_id');
    const wJoin = exW
      ? 'LEFT JOIN warehouses wh ON wh.id = pri.warehouse_id LEFT JOIN warehouse_subcategories wsc ON wsc.id = pri.warehouse_subcategory_id'
      : '';
    const wSel = exW
      ? 'pri.warehouse_id, pri.warehouse_subcategory_id, pri.unit_id, pri.line_image_path, pri.line_pdf_path, wh.name AS warehouse_name, wsc.name AS subcategory_name,'
      : '';
    const [it] = await pool.query(
      `SELECT pri.id, pri.request_id, pri.product_id, pri.quantity, pri.unit_code, pri.line_note,
              ${wSel}
              p.product_code, p.name AS product_name, p.m2_per_piece, p.unit_id AS product_default_unit_id,
              p.stock_pieces, p.stock_qty, p.unit AS p_unit_legacy,
              u2.code AS p_unit_code
       FROM purchase_request_items pri
       INNER JOIN products p ON p.id = pri.product_id
       LEFT JOIN units u2 ON u2.id = p.unit_id
       ${wJoin}
       WHERE pri.request_id IN (${list.map(() => '?').join(',')})
       ORDER BY pri.id`,
      list.map((r) => r.id)
    );
    for (const row of it) {
      const disp = primaryStockDisplay({
        unit_code: row.p_unit_code,
        unit: row.p_unit_legacy,
        unit_legacy: row.p_unit_legacy,
        stock_pieces: row.stock_pieces,
        stock_qty: row.stock_qty,
      });
      row.stock_display = disp;
      row.stock_display_text = disp.text;
    }
    items = it;
  }
  const byR = new Map();
  for (const it of items) {
    if (!byR.has(it.request_id)) byR.set(it.request_id, []);
    byR.get(it.request_id).push(it);
  }
  for (const r of list) {
    r.items = byR.get(r.id) || [];
  }
  return { requests: list };
}

/**
 * Satır ekle (create / update ortak; conn transaction içinde)
 * @returns {import('../utils/serviceError').Err|null}
 */
async function insertPurchaseRequestLineRows(conn, reqId, items, { hasExt, hasFiles, hasUid }) {
  for (const it of items) {
    const prodId = parseInt(String(it.productId), 10);
    if (!Number.isFinite(prodId) || prodId < 1) {
      return err('Ürün veya satır hatası', 'api.pur.line_invalid');
    }
    const P = await loadProductForPurchasing(prodId);
    if (!P) {
      return err('Ürün veya satır hatası', 'api.pur.line_invalid');
    }
    if (P.warehouse_id && it.warehouseId != null && it.warehouseId !== '' && Number(P.warehouse_id) !== Number(it.warehouseId)) {
      return err('Ürün seçilen depo ile eşleşmiyor', 'api.pur.warehouse_product_mismatch');
    }
    if (P.warehouse_subcategory_id && it.warehouseSubcategoryId != null && it.warehouseSubcategoryId !== '') {
      if (Number(P.warehouse_subcategory_id) !== Number(it.warehouseSubcategoryId)) {
        return err('Ürün seçilen alt kategori ile eşleşmiyor', 'api.pur.sub_product_mismatch');
      }
    }
    const q = Number(it.quantity);
    if (!Number.isFinite(q) || q <= 0) {
      return err('Geçerli miktar gerekli', 'api.pur.qty_invalid');
    }
    const uc = (it.unitCode || P.unit_code || P.unit || 'adet').toString();
    const m2n = qtyToSystemM2(q, uc, P.m2_per_piece);
    if (m2n <= 0) {
      return err('Miktar / birim hatalı', 'api.pur.qty_m2_invalid');
    }
    const lnote = it.lineNote ? toUpperTr(String(it.lineNote)) : null;
    const wid = it.warehouseId != null && it.warehouseId !== '' ? parseInt(String(it.warehouseId), 10) : null;
    const sid = it.warehouseSubcategoryId != null && it.warehouseSubcategoryId !== '' ? parseInt(String(it.warehouseSubcategoryId), 10) : null;
    const uId = it.unitId != null && it.unitId !== '' ? parseInt(String(it.unitId), 10) : null;
    const img = it.lineImagePath && String(it.lineImagePath).trim() ? String(it.lineImagePath).trim().slice(0, 500) : null;
    const pdf = it.linePdfPath && String(it.linePdfPath).trim() ? String(it.linePdfPath).trim().slice(0, 500) : null;
    if (hasExt && hasFiles && hasUid) {
      await conn.query(
        'INSERT INTO purchase_request_items (request_id, product_id, quantity, unit_code, unit_id, line_note, warehouse_id, warehouse_subcategory_id, line_image_path, line_pdf_path) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [reqId, prodId, q, uc, uId, lnote, wid, sid, img, pdf]
      );
    } else if (hasExt && hasFiles && !hasUid) {
      await conn.query(
        'INSERT INTO purchase_request_items (request_id, product_id, quantity, unit_code, line_note, warehouse_id, warehouse_subcategory_id, line_image_path, line_pdf_path) VALUES (?,?,?,?,?,?,?,?,?)',
        [reqId, prodId, q, uc, lnote, wid, sid, img, pdf]
      );
    } else if (hasExt && hasUid) {
      await conn.query(
        'INSERT INTO purchase_request_items (request_id, product_id, quantity, unit_code, unit_id, line_note, warehouse_id, warehouse_subcategory_id) VALUES (?,?,?,?,?,?,?,?,?)',
        [reqId, prodId, q, uc, uId, lnote, wid, sid]
      );
    } else if (hasExt) {
      await conn.query(
        'INSERT INTO purchase_request_items (request_id, product_id, quantity, unit_code, line_note, warehouse_id, warehouse_subcategory_id) VALUES (?,?,?,?,?,?,?,?)',
        [reqId, prodId, q, uc, lnote, wid, sid]
      );
    } else {
      await conn.query('INSERT INTO purchase_request_items (request_id, product_id, quantity, unit_code, line_note) VALUES (?,?,?,?,?)', [
        reqId,
        prodId,
        q,
        uc,
        lnote,
      ]);
    }
  }
  return null;
}

/** Tek talep + satırlar (düzenleme / onay ekranı) */
async function getPurchaseRequestById(id) {
  const mid = parseInt(String(id), 10);
  if (!Number.isFinite(mid) || mid < 1) {
    return err('Geçersiz id', 'api.pur.id_invalid');
  }
  const res = await listPurchaseRequests({ requestId: mid });
  if (res.error) {
    return res;
  }
  const r = (res.requests || [])[0];
  if (!r) {
    return err('Talep yok', 'api.pur.request_not_found');
  }
  return { request: r };
}

async function createPurchaseRequest({ userId, projectId, title, items, note, mode }) {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: npm run db:patch-6b', 'api.pur.migration_006b');
  }
  const isDraft = String(mode || 'submit') === 'draft';
  const pid = parseInt(String(projectId), 10);
  if (!Number.isFinite(pid) || pid < 1) {
    return err('Proje zorunlu', 'api.pur.project_required');
  }
  const [[prj]] = await pool.query("SELECT id, company_code FROM projects WHERE id = ? AND status = 'active' LIMIT 1", [pid]);
  if (!prj) {
    return err('Geçersiz proje', 'api.pur.project_invalid');
  }
  if (!Array.isArray(items) || !items.length) {
    return err('En az bir satır gerekli', 'api.pur.items_required');
  }
  const hasExt = await hasCol('purchase_request_items', 'warehouse_id');
  const hasUid = await hasCol('purchase_request_items', 'unit_id');
  const hasFiles = await hasCol('purchase_request_items', 'line_image_path');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const t = optionalNoteUpperTr(title) || toUpperTr('Satınalma talebi');
    const prs = isDraft ? 'draft' : 'pending';
    const leg = isDraft ? 'draft' : 'submitted';
    const [ins] = await conn.query(
      'INSERT INTO purchase_requests (requester_id, title, `status`, note, project_id, pr_status) VALUES (?,?,?,?,?,?)',
      [userId, t, leg, note || null, pid, prs]
    );
    const reqId = ins.insertId;
    const rcode = await computeNextRequestCodeForProject(conn, pid, prj.company_code);
    await conn.query('UPDATE purchase_requests SET request_code = ? WHERE id = ?', [rcode, reqId]);
    const lineErr = await insertPurchaseRequestLineRows(conn, reqId, items, { hasExt, hasFiles, hasUid });
    if (lineErr) {
      await conn.rollback();
      return lineErr;
    }
    await conn.commit();
    return { id: reqId, requestCode: rcode };
  } catch (e) {
    await conn.rollback();
    if (e.code === 'VALID') {
      return err('Ürün veya satır hatası', 'api.pur.line_invalid');
    }
    throw e;
  } finally {
    conn.release();
  }
}

async function submitDraftRequest({ id }) {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: 006b', 'api.pur.migration_006b');
  }
  const mid = parseInt(String(id), 10);
  if (!Number.isFinite(mid) || mid < 1) {
    return err('Geçersiz id', 'api.pur.id_invalid');
  }
  const [[row]] = await pool.query("SELECT pr_status FROM purchase_requests WHERE id = ?", [mid]);
  if (!row) {
    return err('Talep yok', 'api.pur.request_not_found');
  }
  const st = String(row.pr_status);
  if (st === 'draft') {
    await pool.query("UPDATE purchase_requests SET pr_status = 'pending', `status` = 'submitted' WHERE id = ? AND pr_status = 'draft'", [mid]);
    return { ok: true };
  }
  if (st === 'revision_requested') {
    const hasSm = await hasCol('purchase_requests', 'status_message');
    if (hasSm) {
      await pool.query(
        "UPDATE purchase_requests SET pr_status = 'pending', `status` = 'submitted', status_message = NULL, decided_by = NULL, decided_at = NULL WHERE id = ? AND pr_status = 'revision_requested'",
        [mid]
      );
    } else {
      await pool.query("UPDATE purchase_requests SET pr_status = 'pending', `status` = 'submitted' WHERE id = ? AND pr_status = 'revision_requested'", [mid]);
    }
    return { ok: true };
  }
  return err('Sadece taslak veya revizyon bekleyen talep gönderilebilir', 'api.pur.request_not_draft');
}

async function cancelRequest({ id, allowed = ['draft', 'pending', 'revision_requested'] }) {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: 006b', 'api.pur.migration_006b');
  }
  const mid = parseInt(String(id), 10);
  if (!Number.isFinite(mid) || mid < 1) {
    return err('Geçersiz id', 'api.pur.id_invalid');
  }
  const [[row]] = await pool.query("SELECT pr_status FROM purchase_requests WHERE id = ?", [mid]);
  if (!row) {
    return err('Talep yok', 'api.pur.request_not_found');
  }
  if (!allowed.map(String).includes(String(row.pr_status))) {
    return err('Bu durumda iptal edilemez', 'api.pur.cancel_forbidden');
  }
  await pool.query("UPDATE purchase_requests SET pr_status = 'cancelled', `status` = 'cancelled' WHERE id = ?", [mid]);
  return { ok: true };
}

async function setRequestStatus({ id, status, userId, note }) {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: npm run db:patch-6b', 'api.pur.migration_006b');
  }
  const s = String(status);
  if (!['approved', 'rejected', 'revision_requested'].includes(s)) {
    return err('Geçersiz durum', 'api.pur.status_invalid');
  }
  const mid = parseInt(String(id), 10);
  if (!Number.isFinite(mid) || mid < 1) {
    return err('Geçersiz id', 'api.pur.id_invalid');
  }
  const uid = parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid < 1) {
    return err('Kullanıcı yok', 'api.pur.id_invalid');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.query("SELECT pr_status, id FROM purchase_requests WHERE id = ? FOR UPDATE", [mid]);
    if (!row) {
      await conn.rollback();
      return err('Talep yok', 'api.pur.request_not_found');
    }
    if (String(row.pr_status) !== 'pending') {
      await conn.rollback();
      return err('Sadece onay bekleyen talep güncellenebilir', 'api.pur.request_not_pending');
    }
    let legacy = s === 'approved' ? 'approved' : 'rejected';
    if (s === 'revision_requested') {
      legacy = 'submitted';
    }
    const n = note && String(note).trim() ? String(note).trim().slice(0, 2000) : null;
    const hasDecided = await hasCol(conn, 'purchase_requests', 'decided_by');
    if (hasDecided) {
      await conn.query(
        'UPDATE purchase_requests SET pr_status = ?, `status` = ?, decided_by = ?, decided_at = NOW(), status_message = ? WHERE id = ? AND pr_status = ?',
        [s, legacy, uid, n, mid, 'pending']
      );
    } else {
      await conn.query("UPDATE purchase_requests SET pr_status = ?, `status` = ? WHERE id = ? AND pr_status = 'pending'", [s, legacy, mid]);
    }
    let orderId = null;
    if (s === 'approved') {
      const out = await createPurchaseOrderFromApprovedRequest({ userId: uid, requestId: mid, _useConn: conn });
      if (out.error) {
        await conn.rollback();
        return out;
      }
      orderId = out.orderId || null;
    }
    await conn.commit();
    return orderId ? { ok: true, orderId } : { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updatePurchaseRequest({ id, userId, projectId, title, items, note, mode }) {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: 006b', 'api.pur.migration_006b');
  }
  const mid = parseInt(String(id), 10);
  if (!Number.isFinite(mid) || mid < 1) {
    return err('Geçersiz id', 'api.pur.id_invalid');
  }
  const [[reqRow]] = await pool.query('SELECT id, requester_id, pr_status, project_id FROM purchase_requests WHERE id = ?', [mid]);
  if (!reqRow) {
    return err('Talep yok', 'api.pur.request_not_found');
  }
  if (Number(reqRow.requester_id) !== Number(userId)) {
    return err('Sadece talep sahibi düzenleyebilir', 'api.pur.request_not_owner');
  }
  const st = String(reqRow.pr_status);
  if (!['draft', 'revision_requested'].includes(st)) {
    return err('Sadece taslak veya revizyon talebi düzenlenebilir', 'api.pur.request_not_editable');
  }
  const pid = parseInt(String(projectId), 10);
  if (!Number.isFinite(pid) || pid < 1) {
    return err('Proje zorunlu', 'api.pur.project_required');
  }
  const [[prj]] = await pool.query("SELECT id, company_code FROM projects WHERE id = ? AND status = 'active' LIMIT 1", [pid]);
  if (!prj) {
    return err('Geçersiz proje', 'api.pur.project_invalid');
  }
  if (!Array.isArray(items) || !items.length) {
    return err('En az bir satır gerekli', 'api.pur.items_required');
  }
  const isDraft = String(mode || 'submit') === 'draft';
  const hasExt = await hasCol('purchase_request_items', 'warehouse_id');
  const hasUid = await hasCol('purchase_request_items', 'unit_id');
  const hasFiles = await hasCol('purchase_request_items', 'line_image_path');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const t = optionalNoteUpperTr(title) || toUpperTr('Satınalma talebi');
    const newPrs = isDraft ? 'draft' : 'pending';
    const newLeg = isDraft ? 'draft' : 'submitted';
    await conn.query(
      'UPDATE purchase_requests SET title = ?, `status` = ?, note = ?, project_id = ?, pr_status = ? WHERE id = ?',
      [t, newLeg, note || null, pid, newPrs, mid]
    );
    await conn.query('DELETE FROM purchase_request_items WHERE request_id = ?', [mid]);
    const lineErr = await insertPurchaseRequestLineRows(conn, mid, items, { hasExt, hasFiles, hasUid });
    if (lineErr) {
      await conn.rollback();
      return lineErr;
    }
    await conn.commit();
    return { ok: true, id: mid };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listApprovedRequestItems() {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: npm run db:patch-6b', 'api.pur.migration_006b');
  }
  const [rows] = await pool.query(
    `SELECT pri.id, pri.request_id, pri.product_id, pri.quantity, pri.unit_code, pri.line_note,
            pr.request_code, pr.project_id, prj.project_code, prj.name AS project_name,
            p.product_code, p.name AS product_name, p.m2_per_piece
     FROM purchase_request_items pri
     INNER JOIN purchase_requests pr ON pr.id = pri.request_id
     LEFT JOIN projects prj ON prj.id = pr.project_id
     INNER JOIN products p ON p.id = pri.product_id
     WHERE pr.pr_status IN ('approved', 'partial')
       AND NOT EXISTS (
         SELECT 1 FROM purchase_order_items poi WHERE poi.request_item_id = pri.id
       )
     ORDER BY pr.id DESC, pri.id`
  );
  return { items: rows };
}

async function ensurePendingSupplier(conn) {
  const name = toUpperTr('Tedarikçi bekleniyor');
  const [rows] = await conn.query('SELECT id FROM suppliers WHERE name = ? ORDER BY id ASC LIMIT 1', [name]);
  if (rows.length) {
    return rows[0].id;
  }
  const [ins] = await conn.query('INSERT INTO suppliers (name, contact, tax_id) VALUES (?, NULL, NULL)', [name]);
  return ins.insertId;
}

function isOrderReadonlyForPricing(row) {
  if (!row) return true;
  if (String(row.status) === 'cancelled') return true;
  return normalizeReceiptStatusValue(row.receipt_status) === 'completed' && normalizePricingStatusValue(row.pricing_status) === 'priced';
}

async function createPurchaseOrder({
  userId,
  supplierId,
  orderDate,
  deliveryDate,
  paymentTerms,
  currency,
  note,
  lines,
  _useConn,
  allowAutoSupplier,
}) {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: npm run db:patch-6b', 'api.pur.migration_006b');
  }
  if (!Array.isArray(lines) || !lines.length) {
    return err('Sipariş satırları gerekli', 'api.pur.order_lines_required');
  }
  const cur = String(currency || 'UZS')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3) || 'UZS';
  const odate = orderDate || new Date().toISOString().slice(0, 10);
  const conn = _useConn || (await pool.getConnection());
  const ownConn = !_useConn;
  try {
    if (ownConn) {
      await conn.beginTransaction();
    }
    let sid = parseInt(String(supplierId), 10);
    if (!Number.isFinite(sid) || sid < 1) {
      if (allowAutoSupplier) {
        sid = await ensurePendingSupplier(conn);
      } else {
        if (ownConn) await conn.rollback();
        return err('Tedarikçi gerekli', 'api.pur.supplier_required');
      }
    }
    const [[sup]] = await conn.query('SELECT id FROM suppliers WHERE id = ?', [sid]);
    if (!sup) {
      if (allowAutoSupplier) {
        sid = await ensurePendingSupplier(conn);
      } else {
        if (ownConn) await conn.rollback();
        return err('Tedarikçi bulunamadı', 'api.pur.supplier_not_found');
      }
    }
    let projectId = null;
    const oiIns = [];
    for (const ln of lines) {
      const riId = parseInt(String(ln.requestItemId), 10);
      const up = Number(ln.unitPrice);
      if (!Number.isFinite(riId) || riId < 1 || !Number.isFinite(up) || up < 0) {
        if (ownConn) await conn.rollback();
        return err('Talep satırı ve geçerli birim fiyat gerekli', 'api.pur.line_price_required');
      }
      const [[pri]] = await conn.query(
        `SELECT pri.*, pr.pr_status, pr.project_id
         FROM purchase_request_items pri
         INNER JOIN purchase_requests pr ON pr.id = pri.request_id
         WHERE pri.id = ? FOR UPDATE`,
        [riId]
      );
      if (!pri) {
        if (ownConn) await conn.rollback();
        return err('Talep satırı yok', 'api.pur.request_item_not_found');
      }
      const prs = String(pri.pr_status);
      if (!['approved', 'partial'].includes(prs)) {
        if (ownConn) await conn.rollback();
        return err('Sadece onaylı veya kısmi talep satırları siparişe bağlanabilir', 'api.pur.request_item_not_approved');
      }
      const [[ex]] = await conn.query('SELECT id FROM purchase_order_items WHERE request_item_id = ? LIMIT 1', [riId]);
      if (ex) {
        if (ownConn) await conn.rollback();
        return err('Bu talep satırı zaten siparişe bağlı', 'api.pur.request_item_used');
      }
      if (projectId == null) {
        projectId = pri.project_id;
      } else if (Number(pri.project_id) !== Number(projectId)) {
        if (ownConn) await conn.rollback();
        return err('Aynı siparişte aynı projeye ait satırlar olmalı', 'api.pur.project_mismatch');
      }
      const P = await loadProductForPurchasing(pri.product_id);
      if (!P) {
        if (ownConn) await conn.rollback();
        return err('Ürün yok', 'api.stock.product_not_found');
      }
      oiIns.push({ pri, up, orderedQty: Number(pri.quantity) || 0, product: P, riId });
    }
    if (projectId == null) {
      if (ownConn) await conn.rollback();
      return err('Sipariş için talep satırında proje gerekli (006b / project_id)', 'api.pur.po_project_required');
    }
    const hasOrderReceiptStatus = await hasCol(conn, 'purchase_orders', 'receipt_status');
    const hasOrderPricingStatus = await hasCol(conn, 'purchase_orders', 'pricing_status');
    let orderInsertSql =
      'INSERT INTO purchase_orders (order_code, supplier_id, project_id, order_date, delivery_date, payment_terms, currency, status';
    if (hasOrderReceiptStatus) orderInsertSql += ', receipt_status';
    if (hasOrderPricingStatus) orderInsertSql += ', pricing_status';
    orderInsertSql += ', note, created_by) VALUES (NULL,?,?,?,?,?,?';
    orderInsertSql += ",'awaiting_goods_receipt'";
    if (hasOrderReceiptStatus) orderInsertSql += ",'awaiting_receipt'";
    if (hasOrderPricingStatus) orderInsertSql += ",'unpriced'";
    orderInsertSql += ',?,?)';
    const [oins] = await conn.query(orderInsertSql, [
      sid,
      projectId,
      odate,
      deliveryDate || null,
      paymentTerms || null,
      cur,
      optionalNoteUpperTr(note) || null,
      userId,
    ]);
    const oid = oins.insertId;
    await conn.query('UPDATE purchase_orders SET order_code = CONCAT(\'SIP-\', DATE_FORMAT(created_at, \'%Y\'), \'-\', LPAD(?, 5, \'0\')) WHERE id = ?', [oid, oid]);
    const hasItemReceiptStatus = await hasCol(conn, 'purchase_order_items', 'receipt_status');
    const hasItemPricingStatus = await hasCol(conn, 'purchase_order_items', 'pricing_status');
    for (const row of oiIns) {
      let itemInsertSql =
        'INSERT INTO purchase_order_items (order_id, request_item_id, product_id, qty_ordered, unit_price, currency, qty_received';
      if (hasItemReceiptStatus) itemInsertSql += ', receipt_status';
      if (hasItemPricingStatus) itemInsertSql += ', pricing_status';
      itemInsertSql += ') VALUES (?,?,?,?,?,?,0';
      if (hasItemReceiptStatus) itemInsertSql += ",'awaiting_receipt'";
      if (hasItemPricingStatus) itemInsertSql += ",'unpriced'";
      itemInsertSql += ')';
      await conn.query(itemInsertSql, [oid, row.riId, row.pri.product_id, row.orderedQty, row.up, cur]);
    }
    if (await hasCol('purchase_order_items', 'supplier_id')) {
      await conn.query('UPDATE purchase_order_items SET supplier_id = ? WHERE order_id = ?', [sid, oid]);
    }
    const rids = oiIns.map((r) => r.pri.request_id).filter((x) => x != null);
    await recomputeRequestStatusAfterPoLines(conn, rids);
    if (ownConn) {
      await conn.commit();
    }
    return { orderId: oid };
  } catch (e) {
    if (ownConn) {
      await conn.rollback();
    }
    throw e;
  } finally {
    if (ownConn) {
      conn.release();
    }
  }
}

async function createPurchaseOrderFromApprovedRequest({ userId, requestId, _useConn } = {}) {
  const rid = parseInt(String(requestId), 10);
  if (!Number.isFinite(rid) || rid < 1) {
    return err('Geçersiz talep', 'api.pur.id_invalid');
  }
  const conn = _useConn || (await pool.getConnection());
  const ownConn = !_useConn;
  try {
    if (ownConn) {
      await conn.beginTransaction();
    }
    const [[reqRow]] = await conn.query('SELECT id, pr_status, note FROM purchase_requests WHERE id = ? FOR UPDATE', [rid]);
    if (!reqRow) {
      if (ownConn) await conn.rollback();
      return err('Talep yok', 'api.pur.request_not_found');
    }
    if (!['approved', 'partial'].includes(String(reqRow.pr_status))) {
      if (ownConn) await conn.rollback();
      return err('Bu talep onaylı / kısmi değil', 'api.pur.request_not_approved');
    }
    const [existing] = await conn.query(
      `SELECT po.id
       FROM purchase_orders po
       INNER JOIN purchase_order_items poi ON poi.order_id = po.id
       INNER JOIN purchase_request_items pri ON pri.id = poi.request_item_id
       WHERE pri.request_id = ?
       ORDER BY po.id ASC
       LIMIT 1`,
      [rid]
    );
    if (existing.length) {
      if (ownConn) await conn.commit();
      return { orderId: existing[0].id };
    }
    const [rows] = await conn.query(
      `SELECT pri.id
       FROM purchase_request_items pri
       WHERE pri.request_id = ?
       ORDER BY pri.id ASC`,
      [rid]
    );
    if (!rows.length) {
      if (ownConn) await conn.rollback();
      return err('Sipariş satırları gerekli', 'api.pur.order_lines_required');
    }
    const out = await createPurchaseOrder({
      userId,
      supplierId: null,
      orderDate: new Date().toISOString().slice(0, 10),
      deliveryDate: null,
      paymentTerms: null,
      currency: 'UZS',
      note: reqRow.note || null,
      lines: rows.map((r) => ({ requestItemId: r.id, unitPrice: 0 })),
      _useConn: conn,
      allowAutoSupplier: true,
    });
    if (out.error) {
      if (ownConn) await conn.rollback();
      return out;
    }
    if (ownConn) {
      await conn.commit();
    }
    return out;
  } catch (e) {
    if (ownConn) {
      await conn.rollback();
    }
    throw e;
  } finally {
    if (ownConn) {
      conn.release();
    }
  }
}

function stripOrderForWarehouse(row) {
  if (!row) return row;
  const o = { ...row };
  delete o.line_total;
  delete o.currency;
  delete o.pricing_status;
  if (o.items) {
    o.items = o.items.map((it) => {
      const x = { ...it };
      delete x.unit_price;
      delete x.currency;
      delete x.fx_rate;
      delete x.pricing_status;
      delete x.supplier_id;
      delete x.line_supplier_id;
      delete x.line_supplier_name;
      delete x.supplier_label;
      delete x.line_total;
      return x;
    });
  }
  return o;
}

async function getPurchaseOrderById(id, { hidePrice } = {}) {
  const [ords] = await pool.query(
    `SELECT po.*,
            CASE WHEN po.status = 'partial' THEN 'partial_received' ELSE po.status END AS status,
            s.name AS supplier_name,
            COALESCE(NULLIF(TRIM(uc.full_name),''), uc.username) AS order_creator_name
     FROM purchase_orders po
     INNER JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users uc ON uc.id = po.created_by
     WHERE po.id = ?`,
    [id]
  );
  if (!ords.length) {
    return { notFound: true };
  }
  const o = ords[0];
  o.receipt_status = normalizeReceiptStatusValue(o.receipt_status || o.status);
  o.pricing_status = normalizePricingStatusValue(o.pricing_status);
  o.buyer_status = normalizeBuyerStatusValue(o.buyer_status || o.buyer_state);
  const exW = await hasCol('purchase_request_items', 'warehouse_id');
  const hasLineSup = await hasCol('purchase_order_items', 'supplier_id');
  let itemSql = `SELECT poi.*, p.product_code, p.name AS product_name, p.stock_pieces, p.stock_qty, p.m2_per_piece, p.depth_mm,
            p.unit AS p_unit_legacy, pu.code AS p_unit_code,
            pri.id AS request_item_id,
            pr.request_code, pr.id AS purchase_request_id,
            pri.quantity AS request_qty, pri.unit_code AS request_unit,
            pri.line_image_path AS request_line_image_path, pri.line_pdf_path AS request_line_pdf_path`;
  if (hasLineSup) {
    itemSql += `, poi.supplier_id AS line_supplier_id, sln.name AS line_supplier_name`;
  }
  if (exW) {
    itemSql += `,
            pri.warehouse_id, pri.warehouse_subcategory_id, wh.name AS warehouse_name, wsc.name AS subcategory_name`;
  }
  itemSql += `
     FROM purchase_order_items poi
     INNER JOIN products p ON p.id = poi.product_id
     LEFT JOIN units pu ON pu.id = p.unit_id
     LEFT JOIN purchase_request_items pri ON pri.id = poi.request_item_id
     LEFT JOIN purchase_requests pr ON pr.id = pri.request_id`;
  if (hasLineSup) {
    itemSql += ' LEFT JOIN suppliers sln ON sln.id = poi.supplier_id';
  }
  if (exW) {
    itemSql += `
     LEFT JOIN warehouses wh ON wh.id = pri.warehouse_id
     LEFT JOIN warehouse_subcategories wsc ON wsc.id = pri.warehouse_subcategory_id`;
  }
  itemSql += ' WHERE poi.order_id = ?';
  const [items] = await pool.query(itemSql, [id]);
  for (const it of items) {
    it.receipt_status = normalizeReceiptStatusValue(it.receipt_status);
    it.pricing_status = normalizePricingStatusValue(it.pricing_status);
    const cancelled = isPurchaseOrderLineCancelled(it);
    it.is_line_cancelled = cancelled;
    if (cancelled) {
      it.qty_remaining = 0;
      it.line_total = 0;
    } else {
      it.qty_remaining = Math.max(0, Number(it.qty_ordered) - Number(it.qty_received || 0));
      it.line_total = Number(it.unit_price) * Number(it.qty_ordered);
    }
    it.primary_unit = primaryUnitCode(it.request_unit || it.p_unit_code || it.p_unit_legacy || 'ADET');
    it.calc_m2_per_unit = calcM2FromPrimaryQty(1, it.primary_unit, it.m2_per_piece);
    it.calc_m3_per_unit = calcM3FromPrimaryQty(1, it.primary_unit, it.m2_per_piece, it.depth_mm);
    const disp = primaryStockDisplay({
      unit_code: it.p_unit_code,
      unit: it.p_unit_legacy,
      unit_legacy: it.p_unit_legacy,
      stock_pieces: it.stock_pieces,
      stock_qty: it.stock_qty,
    });
    it.stock_display_text = disp.text;
    if (hasLineSup) {
      it.supplier_label = it.line_supplier_name || o.supplier_name || '—';
    }
  }
  o.items = items;
  const reqId = items.length && items[0].purchase_request_id ? items[0].purchase_request_id : null;
  if (reqId) {
    const hasDec = await hasCol('purchase_requests', 'decided_by');
    const hasMsg = await hasCol('purchase_requests', 'status_message');
    const extra = [
      hasMsg ? 'pr.status_message' : null,
      hasDec ? "COALESCE(NULLIF(TRIM(ua.full_name),''), ua.username) AS approver_name" : null,
    ]
      .filter(Boolean)
      .join(', ');
    const joinA = hasDec ? 'LEFT JOIN users ua ON ua.id = pr.decided_by' : '';
    const selectExtra = extra ? `, ${extra}` : '';
    const [[meta]] = await pool.query(
      `SELECT pr.request_code,
              COALESCE(NULLIF(TRIM(ur.full_name),''), ur.username) AS requester_name
              ${selectExtra}
       FROM purchase_requests pr
       LEFT JOIN users ur ON ur.id = pr.requester_id
       ${joinA}
       WHERE pr.id = ? LIMIT 1`,
      [reqId]
    );
    if (meta) {
      o.request_code = o.request_code || meta.request_code;
      o.requester_name = meta.requester_name;
      o.approver_name = meta.approver_name;
      o.approval_note = hasMsg ? meta.status_message : undefined;
    }
  }
  o.project_label = o.project_id ? `${o.project_id}` : '—';
  if (o.project_id) {
    const [[pj]] = await pool.query('SELECT project_code, name AS project_name FROM projects WHERE id = ?', [o.project_id]);
    if (pj) {
      o.project_code = pj.project_code;
      o.project_name = pj.project_name;
      o.project_label = (pj.project_code || '') + (pj.project_name ? ' — ' + pj.project_name : '');
    }
  }
  o.grand_total = o.items.reduce((a, it) => a + (Number(it.line_total) || 0), 0);
  if (hidePrice) {
    return { order: stripOrderForWarehouse(o) };
  }
  return { order: o };
}

async function listPurchaseOrders({ status, statuses, hidePrice, openForReceipt, forPricing, buyerStatus, completedByBuyer } = {}) {
  let where = '1=1';
  const p = [];
  const hasReceiptStatus = await hasCol('purchase_orders', 'receipt_status');
  const hasPricingStatus = await hasCol('purchase_orders', 'pricing_status');
  const hasBuyerState = await hasCol('purchase_orders', 'buyer_state');
  const hasPoiLineStatus = await hasCol('purchase_order_items', 'line_status');
  if (openForReceipt) {
    if (hasReceiptStatus) {
      where += " AND po.receipt_status IN ('pending', 'partial', 'awaiting_receipt', 'partially_received')";
    } else {
      where += " AND po.status IN ('awaiting_goods_receipt', 'partial_received', 'partial')";
    }
    if (hasPoiLineStatus) {
      where += ` AND EXISTS (
        SELECT 1 FROM purchase_order_items poi_open
        WHERE poi_open.order_id = po.id
          AND (poi_open.line_status IS NULL OR poi_open.line_status <> 'cancelled')
          AND (poi_open.qty_ordered - COALESCE(poi_open.qty_received, 0)) > 0.0001
      )`;
    }
  } else if (forPricing) {
    if (hasPricingStatus) {
      where += " AND po.pricing_status IN ('unpriced', 'partially_priced')";
    } else {
      where += ' AND 1=1';
    }
  } else if (completedByBuyer && hasBuyerState) {
    where += " AND po.buyer_state = 'completed'";
  } else if (buyerStatus && hasBuyerState) {
    where += ' AND po.buyer_state = ?';
    p.push(String(buyerStatus).trim());
  } else if (statuses && Array.isArray(statuses) && statuses.length) {
    const safe = statuses.map((s) => String(s).trim()).filter(Boolean);
    if (safe.length) {
      where += ` AND po.status IN (${safe.map(() => '?').join(',')})`;
      p.push(...safe);
    }
  } else if (status) {
    where += ' AND po.status = ?';
    p.push(String(status));
  }
  const [list] = await pool.query(
    `SELECT po.id, po.order_code, po.supplier_id, po.project_id, po.order_date, po.delivery_date,
            CASE WHEN po.status = 'partial' THEN 'partial_received' ELSE po.status END AS status,
            ${hasReceiptStatus ? 'po.receipt_status,' : "'awaiting_receipt' AS receipt_status,"}
            ${hasPricingStatus ? 'po.pricing_status,' : "'unpriced' AS pricing_status,"}
            ${hasBuyerState ? 'po.buyer_state,' : "NULL AS buyer_state,"}
            po.currency, po.created_at,
            COALESCE(s.name, CONCAT('Tedarikçi #', po.supplier_id)) AS supplier_name, prj.project_code
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN projects prj ON prj.id = po.project_id
     WHERE ${where}
     ORDER BY po.id DESC
     LIMIT 200`,
    p
  );
  if (hidePrice) {
    for (const r of list) {
      delete r.currency;
    }
  }
  for (const r of list) {
    r.receipt_status = normalizeReceiptStatusValue(r.receipt_status || r.status);
    r.pricing_status = normalizePricingStatusValue(r.pricing_status);
    r.buyer_status = normalizeBuyerStatusValue(r.buyer_status || r.buyer_state);
  }
  return { orders: list };
}

function deriveReceiptStatusForItem(row) {
  const ordered = Number(row && row.qty_ordered) || 0;
  const received = Number(row && row.qty_received) || 0;
  if (received <= 0.0000) return 'pending';
  if (received + 0.0001 >= ordered) return 'completed';
  return 'partial';
}

async function recalculateReceiptStatusesForOrder(conn, orderId) {
  const hasItemReceiptStatus = await hasCol(conn, 'purchase_order_items', 'receipt_status');
  const hasOrderReceiptStatus = await hasCol(conn, 'purchase_orders', 'receipt_status');
  const hasLineStatus = await hasCol(conn, 'purchase_order_items', 'line_status');
  const sel = hasLineStatus
    ? 'SELECT id, qty_ordered, qty_received, line_status FROM purchase_order_items WHERE order_id = ?'
    : 'SELECT id, qty_ordered, qty_received FROM purchase_order_items WHERE order_id = ?';
  const [rows] = await conn.query(sel, [orderId]);
  const activeRows = hasLineStatus ? rows.filter((row) => !isPurchaseOrderLineCancelled(row)) : rows;
  for (const row of rows) {
    if (hasLineStatus && isPurchaseOrderLineCancelled(row)) {
      if (hasItemReceiptStatus) {
        await conn.query('UPDATE purchase_order_items SET receipt_status = ? WHERE id = ?', ['cancelled', row.id]);
      }
      // eslint-disable-next-line no-continue
      continue;
    }
    const receiptStatus = deriveReceiptStatusForItem(row);
    if (hasItemReceiptStatus) {
      await conn.query('UPDATE purchase_order_items SET receipt_status = ? WHERE id = ?', [receiptStatus, row.id]);
    }
  }
  let anyReceived = false;
  let allCompleted = activeRows.length > 0;
  for (const row of activeRows) {
    const receiptStatus = deriveReceiptStatusForItem(row);
    if ((Number(row.qty_received) || 0) > 0) anyReceived = true;
    if (receiptStatus !== 'completed') allCompleted = false;
  }
  if (!activeRows.length && rows.length > 0) {
    allCompleted = true;
    anyReceived = false;
  }
  let orderReceiptStatus = 'pending';
  if (allCompleted && rows.length) orderReceiptStatus = 'completed';
  else if (anyReceived) orderReceiptStatus = 'partial';
  if (hasOrderReceiptStatus) {
    await conn.query('UPDATE purchase_orders SET receipt_status = ? WHERE id = ?', [orderReceiptStatus, orderId]);
  }
  const legacyStatus =
    orderReceiptStatus === 'completed'
      ? 'completed'
      : orderReceiptStatus === 'partial'
        ? 'partial_received'
        : 'awaiting_goods_receipt';
  await conn.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [legacyStatus, orderId]);
  return { orderReceiptStatus, legacyStatus };
}

/**
 * Talep satırlarına bağlı, henüz kapanmamış satınalma sipariş id'leri (mal kabul yönlendirmesi).
 */
async function listOpenOrderIdsForRequest(requestId) {
  const rid = parseInt(String(requestId), 10);
  if (!Number.isFinite(rid) || rid < 1) {
    return { orderIds: [] };
  }
  if (!(await hasCol('purchase_order_items', 'request_item_id'))) {
    return { orderIds: [] };
  }
  const hasLineStatus = await hasCol('purchase_order_items', 'line_status');
  const openLineFilter = hasLineStatus
    ? ` AND EXISTS (
        SELECT 1 FROM purchase_order_items poi2
        WHERE poi2.order_id = po.id
          AND (poi2.line_status IS NULL OR poi2.line_status <> 'cancelled')
          AND (poi2.qty_ordered - COALESCE(poi2.qty_received, 0)) > 0.0001
      )`
    : '';
  const [rows] = await pool.query(
    `SELECT DISTINCT po.id
     FROM purchase_orders po
     INNER JOIN purchase_order_items poi ON poi.order_id = po.id
     INNER JOIN purchase_request_items pri ON pri.id = poi.request_item_id
     WHERE pri.request_id = ? AND po.status NOT IN ('cancelled', 'completed')
     ${openLineFilter}
     ORDER BY po.id ASC`,
    [rid]
  );
  return { orderIds: (rows || []).map((r) => r.id) };
}

async function createGoodsReceipt({ userId, orderId, warehouseId, waybillNumber, note, lines, auditReq } = {}) {
  if (!(await tableExists('warehouses'))) {
    return err('Depo tablosu yok (patch-5)', 'api.warehouse.migration');
  }
  if (!(await hasCol('goods_receipts', 'id'))) {
    return err('Mal kabul tabloları yok (migrasyon 006)', 'api.pur.migration_006');
  }
  const oid = parseInt(String(orderId), 10);
  if (!Array.isArray(lines) || !lines.length) {
    return err('Kabul satırları gerekli', 'api.pur.gr_lines_required');
  }
  const conn = await pool.getConnection();
  const stockInAudit = [];
  try {
    await conn.beginTransaction();
    const [[por]] = await conn.query("SELECT * FROM purchase_orders po WHERE po.id = ? AND po.status != 'cancelled' FOR UPDATE", [oid]);
    if (!por) {
      await conn.rollback();
      return err('Sipariş yok veya iptal', 'api.pur.order_not_found');
    }
    if (por.project_id == null) {
      await conn.rollback();
      return err('Siparişte proje yok; stok girişi için proje gerekli', 'api.pur.order_no_project');
    }
    const [grIns] = await conn.query(
      'INSERT INTO goods_receipts (receipt_code, purchase_order_id, warehouse_id, waybill_number, received_by, note) VALUES (NULL,?,?,?,?,?)',
      [oid, null, null, userId, optionalNoteUpperTr(note) || null]
    );
    const grid = grIns.insertId;
    await conn.query('UPDATE goods_receipts SET receipt_code = CONCAT(\'MKB-\', DATE_FORMAT(created_at, \'%Y\'), \'-\', LPAD(?, 5, \'0\')) WHERE id = ?', [grid, grid]);
    const [[grRow]] = await conn.query('SELECT receipt_code FROM goods_receipts WHERE id = ?', [grid]);
    const rcode = (grRow && grRow.receipt_code) || `MKB-${grid}`;

    for (const ln of lines) {
      const oiId = toPositiveIntOrNull(ln.orderItemId);
      const qa = Number(ln.qtyAccepted) || 0;
      const qr = Number(ln.qtyRejected) || 0;
      const qd = Number(ln.qtyDamaged) || 0;
      const qw = ln.qtyWaybill != null && ln.qtyWaybill !== '' ? Number(ln.qtyWaybill) : null;
      if (!oiId) {
        await conn.rollback();
        return err('Sipariş satır id gerekli', 'api.pur.oi_required');
      }
      const [[oi]] = await conn.query(
        `SELECT poi.*, pri.warehouse_id AS request_warehouse_id, pri.warehouse_subcategory_id AS request_warehouse_subcategory_id,
                pri.unit_code AS request_unit_code
         FROM purchase_order_items poi
         LEFT JOIN purchase_request_items pri ON pri.id = poi.request_item_id
         WHERE poi.id = ? AND poi.order_id = ?
         FOR UPDATE`,
        [oiId, oid]
      );
      if (!oi) {
        await conn.rollback();
        return err('Sipariş satırı yok', 'api.pur.oi_not_found');
      }
      if (await hasCol(conn, 'purchase_order_items', 'line_status')) {
        if (isPurchaseOrderLineCancelled(oi)) {
          await conn.rollback();
          return err('İptal edilmiş sipariş kalemi için mal kabul yapılamaz', 'api.pur.line_cancelled_no_receipt');
        }
      }
      if (qa <= 0) {
        await conn.query(
          'INSERT INTO goods_receipt_items (goods_receipt_id, order_item_id, qty_waybill, qty_accepted, qty_rejected, qty_damaged, line_note) VALUES (?,?,?,?,?,?,?)',
          [grid, oiId, qw, 0, qr, qd, optionalNoteUpperTr(ln.lineNote) || null]
        );
        continue;
      }
      const rem = Number(oi.qty_ordered) - Number(oi.qty_received || 0);
      if (qa - rem > 0.0001) {
        await conn.rollback();
        return err('Kabul miktarı kalan miktardan fazla olamaz', 'api.pur.qty_exceeds_remaining');
      }
      const productId = toPositiveIntOrNull(oi.product_id);
      if (!productId) {
        await conn.rollback();
        return err('Sipariş satırındaki ürün bilgisi geçersiz', 'api.stock.product_not_found');
      }
      const P = await loadProductForPurchasing(productId);
      if (!P) {
        await conn.rollback();
        return err('Ürün yok', 'api.stock.product_not_found');
      }
      const targetWarehouseId = toPositiveIntOrNull(oi.request_warehouse_id) || toPositiveIntOrNull(P.warehouse_id);
      const targetSubcategoryId =
        toPositiveIntOrNull(oi.request_warehouse_subcategory_id) || toPositiveIntOrNull(P.warehouse_subcategory_id);
      if (!targetWarehouseId) {
        await conn.rollback();
        return err('Sipariş satırında depo bilgisi eksik', 'api.pur.warehouse_not_found');
      }
      if (!targetSubcategoryId) {
        await conn.rollback();
        return err('Sipariş satırında alt kategori bilgisi eksik', 'api.pur.sub_product_mismatch');
      }
      const [[wh]] = await conn.query('SELECT id FROM warehouses WHERE id = ?', [targetWarehouseId]);
      if (!wh) {
        await conn.rollback();
        return err('Depo bulunamadı', 'api.pur.warehouse_not_found');
      }
      const [[sub]] = await conn.query('SELECT id, warehouse_id FROM warehouse_subcategories WHERE id = ?', [targetSubcategoryId]);
      if (!sub || Number(sub.warehouse_id) !== targetWarehouseId) {
        await conn.rollback();
        return err('Sipariş satırındaki alt kategori depoyla eşleşmiyor', 'api.pur.sub_product_mismatch');
      }
      if (P.warehouse_id && Number(P.warehouse_id) !== targetWarehouseId) {
        await conn.rollback();
        return err('Ürün bu depoda değil; depo/ürün eşleşmesi hatalı', 'api.pur.warehouse_product_mismatch');
      }
      if (P.warehouse_subcategory_id && Number(P.warehouse_subcategory_id) !== targetSubcategoryId) {
        await conn.rollback();
        return err('Ürün bu alt kategoride değil; alt kategori/ürün eşleşmesi hatalı', 'api.pur.sub_product_mismatch');
      }
      const up = Number(oi.unit_price);
      const lineCur = normalizePricingCurrency(oi.currency || 'UZS');
      if (!isSupportedPricingCurrency(lineCur)) {
        await conn.rollback();
        return err('Bu para birimi için maliyet dönüşümü henüz desteklenmiyor', 'api.pur.currency_not_supported');
      }
      const fxRate = oi.fx_rate != null && oi.fx_rate !== '' ? Number(oi.fx_rate) : null;
      if (!Number.isFinite(fxRate) || fxRate <= 0) {
        await conn.rollback();
        return err('Geçerli kur gerekli (1 USD = ? UZS)', 'api.pur.fx_required');
      }
      const movementQty = movementQtyFromOrderUnit(
        qa,
        oi.request_unit_code || P.unit_code || P.unit || P.unit_legacy || '',
        P.m2_per_piece
      );
      const totals = calcUzsUsdTotals({
        unitPrice: up,
        qty: movementQty.actualQty,
        currency: lineCur,
        fxRate,
      });
      const totalUsd = totals.totalUsd;
      const totalUzs = totals.totalUzs;
      const mIn = await recordMovementIn({
        productId,
        userId,
        note: toUpperTr(`${rcode} — SİP#${oid}`).slice(0, 400),
        qtyPieces: movementQty.qtyPieces,
        qtyM2: movementQty.qtyM2,
        projectId: por.project_id,
        inputCurrency: lineCur,
        lineTotalUzs: totalUzs,
        lineTotalUsd: totalUsd,
        fxUzsPerUsd: fxRate,
        _useConn: conn,
        movementSource: 'PURCHASE_RECEIPT',
        purchaseOrderId: oid,
        goodsReceiptId: grid,
        bypassOpenPurchaseBlock: true,
      });
      if (mIn && mIn.error) {
        await conn.rollback();
        return mIn;
      }
      const smid = mIn?.movementId;
      if (smid) {
        stockInAudit.push({
          movementId: smid,
          productId,
          orderId: oid,
          goodsReceiptId: grid,
          rcode,
          qtyAccepted: qa,
          projectId: por.project_id,
        });
      }
      await conn.query(
        'INSERT INTO goods_receipt_items (goods_receipt_id, order_item_id, qty_waybill, qty_accepted, qty_rejected, qty_damaged, line_note, stock_movement_id) VALUES (?,?,?,?,?,?,?,?)',
        [grid, oiId, qw, qa, qr, qd, optionalNoteUpperTr(ln.lineNote) || null, smid || null]
      );
      const nrec = Number(oi.qty_received) + qa;
      await conn.query('UPDATE purchase_order_items SET qty_received = ? WHERE id = ?', [nrec, oiId]);
    }
    const receiptOut = await recalculateReceiptStatusesForOrder(conn, oid);
    if (await hasCol('purchase_requests', 'procurement_state')) {
      await conn.query(
        `UPDATE purchase_requests pr
         INNER JOIN (
           SELECT DISTINCT pri.request_id AS rid
           FROM purchase_order_items poi
           INNER JOIN purchase_request_items pri ON pri.id = poi.request_item_id
           WHERE poi.order_id = ?
         ) t ON pr.id = t.rid
         SET pr.procurement_state = IF(pr.procurement_state IS NULL, 'started', 'ongoing')`,
        [oid]
      );
    }
    await conn.commit();
    for (const ev of stockInAudit) {
      await logActivity(auditReq || null, {
        action_type: 'STOCK_IN',
        module_name: 'stock',
        table_name: 'stock_movements',
        record_id: ev.movementId,
        new_data: {
          productId: ev.productId,
          movementId: ev.movementId,
          goodsReceiptId: ev.goodsReceiptId,
          purchaseOrderId: ev.orderId,
          receiptCode: ev.rcode,
          qtyAccepted: ev.qtyAccepted,
          projectId: ev.projectId,
          source: 'goods_receipt',
        },
        description: 'Stok girişi (mal kabul)',
        actor:
          auditReq && auditReq.session && auditReq.session.user
            ? undefined
            : { userId, username: null, fullName: null },
      });
    }
    return { goodsReceiptId: grid, orderStatus: receiptOut.legacyStatus, receiptStatus: receiptOut.orderReceiptStatus };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Satınalmacı sipariş satırına fiyat girdikten sonra: bu siparişe ait mal kabul hareketlerinin cost katmanı UZS birim fiyatı güncellenir.
 */
async function recalculateCostLayersForOrderId(orderId) {
  const oid = parseInt(String(orderId), 10);
  if (!Number.isFinite(oid) || oid < 1) {
    return;
  }
  const hasFxRate = await hasCol('purchase_order_items', 'fx_rate');
  const [rows] = await pool.query(
    `SELECT scl.id AS layer_id, sm.id AS movement_id, sm.qty AS m_qty, gri.qty_accepted, poi.unit_price, poi.currency,
            ${hasFxRate ? 'poi.fx_rate' : 'NULL AS fx_rate'}
     FROM stock_cost_layers scl
     INNER JOIN stock_movements sm ON sm.id = scl.movement_in_id AND sm.movement_type = 'in'
     INNER JOIN goods_receipt_items gri ON gri.stock_movement_id = sm.id
     INNER JOIN purchase_order_items poi ON poi.id = gri.order_item_id
     WHERE poi.order_id = ?`,
    [oid]
  );
  for (const r of rows) {
    const m2 = Number(r.m_qty) || 0;
    if (m2 < 0.0001) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const qa = Number(r.qty_accepted) || 0;
    const upr = Number(r.unit_price) || 0;
    const lineCur = normalizePricingCurrency(r.currency || 'UZS');
    if (!isSupportedPricingCurrency(lineCur)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const fxRate = r.fx_rate != null && r.fx_rate !== '' ? Number(r.fx_rate) : null;
    if (!Number.isFinite(fxRate) || fxRate <= 0) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const totals = calcUzsUsdTotals({
      unitPrice: upr,
      qty: qa,
      currency: lineCur,
      fxRate,
    });
    const totalUsd = totals.totalUsd;
    const totalUzs = totals.totalUzs;
    const costUzs = totalUzs > 0 ? totalUzs / m2 : 0;
    const costUsd = totalUsd > 0 ? totalUsd / m2 : null;
    await pool.query(
      'UPDATE stock_cost_layers SET cost_uzs_per_m2 = ?, cost_usd_per_m2 = ?, input_currency = ?, fx_uzs_per_usd = ? WHERE id = ?',
      [costUzs, costUsd, lineCur, fxRate, r.layer_id]
    );
    await pool.query(
      'UPDATE stock_movements SET line_total_uzs = ?, line_total_usd = ?, fx_uzs_per_usd = ?, input_currency = ? WHERE id = ?',
      [totalUzs || 0, totalUsd || null, fxRate, lineCur, r.movement_id]
    );
  }
}

function derivePricingStatusForItem(row) {
  const up = row && row.unit_price;
  if (up == null || up === '') return 'unpriced';
  const price = Number(up);
  if (!Number.isFinite(price)) return 'unpriced';
  if (price <= 0) return 'unpriced';
  const cur = normalizePricingCurrency((row && row.currency) || 'UZS');
  if (!isSupportedPricingCurrency(cur)) return 'unpriced';
  const fx = row && row.fx_rate != null && row.fx_rate !== '' ? Number(row.fx_rate) : null;
  if (!Number.isFinite(fx) || fx <= 0) {
    return 'unpriced';
  }
  return 'priced';
}

async function recalculatePricingStatusesForOrder(conn, orderId) {
  const hasItemPricingStatus = await hasCol(conn, 'purchase_order_items', 'pricing_status');
  const hasOrderPricingStatus = await hasCol(conn, 'purchase_orders', 'pricing_status');
  const hasLineStatus = await hasCol(conn, 'purchase_order_items', 'line_status');
  const sel = hasLineStatus
    ? 'SELECT id, unit_price, currency, fx_rate, line_status FROM purchase_order_items WHERE order_id = ?'
    : 'SELECT id, unit_price, currency, fx_rate FROM purchase_order_items WHERE order_id = ?';
  const [rows] = await conn.query(sel, [orderId]);
  const activeRows = hasLineStatus ? rows.filter((row) => !isPurchaseOrderLineCancelled(row)) : rows;
  let pricedCount = 0;
  for (const row of rows) {
    if (hasLineStatus && isPurchaseOrderLineCancelled(row)) {
      if (hasItemPricingStatus) {
        await conn.query('UPDATE purchase_order_items SET pricing_status = ? WHERE id = ?', ['unpriced', row.id]);
      }
      // eslint-disable-next-line no-continue
      continue;
    }
    const pricingStatus = derivePricingStatusForItem(row);
    if (hasItemPricingStatus) {
      await conn.query('UPDATE purchase_order_items SET pricing_status = ? WHERE id = ?', [pricingStatus, row.id]);
    }
    if (pricingStatus === 'priced') pricedCount += 1;
  }
  let orderPricingStatus = 'unpriced';
  if (activeRows.length && pricedCount === activeRows.length) orderPricingStatus = 'priced';
  else if (pricedCount > 0) orderPricingStatus = 'partially_priced';
  else if (!activeRows.length && rows.length) orderPricingStatus = 'priced';
  if (hasOrderPricingStatus) {
    await conn.query('UPDATE purchase_orders SET pricing_status = ? WHERE id = ?', [orderPricingStatus, orderId]);
  }
  return { orderPricingStatus };
}

async function updatePurchaseOrder({ id, supplierId, orderDate, deliveryDate, currency, note, lines }) {
  const oid = parseInt(String(id), 10);
  if (!Number.isFinite(oid) || oid < 1) {
    return err('Geçersiz sipariş', 'api.pur.id_invalid');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[por]] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [oid]);
    if (!por) {
      await conn.rollback();
      return err('Sipariş yok', 'api.pur.order_not_found');
    }
    if (isOrderReadonlyForPricing(por)) {
      await conn.rollback();
      return err('Bu durumdaki sipariş güncellenemez', 'api.pur.order_readonly');
    }
    const hasPoiSup = await hasCol('purchase_order_items', 'supplier_id');
    const hasLineSt = await hasCol(conn, 'purchase_order_items', 'line_status');
    const cur = String(currency != null && currency !== '' ? currency : por.currency)
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 3) || 'UZS';
    const odate = orderDate != null && orderDate !== '' ? orderDate : por.order_date;
    const ddate =
      deliveryDate === undefined ? por.delivery_date : String(deliveryDate).trim() === '' ? null : deliveryDate;
    const n = note !== undefined ? optionalNoteUpperTr(note) : por.note;
    await conn.query('UPDATE purchase_orders SET order_date = ?, delivery_date = ?, currency = ?, note = ? WHERE id = ?', [
      odate,
      ddate || null,
      cur,
      n || null,
      oid,
    ]);
    const lineChanges = [];
    if (Array.isArray(lines) && lines.length) {
      for (const ln of lines) {
        const oiId = parseInt(String(ln.orderItemId), 10);
        if (!Number.isFinite(oiId) || oiId < 1) {
          // eslint-disable-next-line no-continue
          continue;
        }
        const up = Number(ln.unitPrice);
        const lineCur = ln.currency != null && String(ln.currency).trim() !== ''
          ? String(ln.currency).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || cur
          : cur;
        if (!Number.isFinite(up) || up < 0) {
          await conn.rollback();
          return err('Geçerli birim fiyat gerekli', 'api.pur.line_price_required');
        }
        const [[row]] = await conn.query(
          hasLineSt
            ? 'SELECT id, line_status FROM purchase_order_items WHERE id = ? AND order_id = ?'
            : 'SELECT id, NULL AS line_status FROM purchase_order_items WHERE id = ? AND order_id = ?',
          [oiId, oid]
        );
        if (!row) {
          // eslint-disable-next-line no-continue
          continue;
        }
        if (hasLineSt && isPurchaseOrderLineCancelled(row)) {
          await conn.rollback();
          return err('İptal edilmiş sipariş kalemi güncellenemez', 'api.pur.line_cancelled');
        }
        if (hasPoiSup) {
          const supL = ln.supplierId != null && ln.supplierId !== '' ? parseInt(String(ln.supplierId), 10) : null;
          if (Number.isFinite(supL) && supL > 0) {
            const [[srow]] = await conn.query('SELECT id FROM suppliers WHERE id = ?', [supL]);
            if (srow) {
              await conn.query('UPDATE purchase_order_items SET unit_price = ?, currency = ?, supplier_id = ? WHERE id = ?', [
                up,
                lineCur,
                supL,
                oiId,
              ]);
            } else {
              await conn.query('UPDATE purchase_order_items SET unit_price = ?, currency = ?, supplier_id = NULL WHERE id = ?', [
                up,
                lineCur,
                oiId,
              ]);
            }
          } else {
            await conn.query('UPDATE purchase_order_items SET unit_price = ?, currency = ?, supplier_id = NULL WHERE id = ?', [
              up,
              lineCur,
              oiId,
            ]);
          }
        } else {
          await conn.query('UPDATE purchase_order_items SET unit_price = ?, currency = ? WHERE id = ?', [up, lineCur, oiId]);
        }
      }
    }
    const supActiveSql = hasLineSt
      ? 'SELECT supplier_id AS sid FROM purchase_order_items WHERE order_id = ? AND supplier_id IS NOT NULL AND (line_status IS NULL OR line_status <> ?) ORDER BY id ASC LIMIT 1'
      : 'SELECT supplier_id AS sid FROM purchase_order_items WHERE order_id = ? AND supplier_id IS NOT NULL ORDER BY id ASC LIMIT 1';
    const [[h]] = hasLineSt
      ? await conn.query(supActiveSql, [oid, 'cancelled'])
      : await conn.query(supActiveSql, [oid]);
    let newSid = h && h.sid != null ? parseInt(String(h.sid), 10) : null;
    if (newSid == null || !Number.isFinite(newSid)) {
      if (supplierId != null && supplierId !== '') {
        newSid = parseInt(String(supplierId), 10);
      }
    }
    if (newSid == null || !Number.isFinite(newSid) || newSid < 1) {
      newSid = parseInt(String(por.supplier_id), 10);
    }
    const [[sup]] = await conn.query('SELECT id FROM suppliers WHERE id = ?', [newSid]);
    if (!sup) {
      await conn.rollback();
      return err('Tedarikçi bulunamadı', 'api.pur.supplier_not_found');
    }
    await conn.query('UPDATE purchase_orders SET supplier_id = ? WHERE id = ?', [newSid, oid]);
    await conn.commit();
    try {
      await recalculateCostLayersForOrderId(oid);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[recalculateCostLayersForOrderId]', e);
    }
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updatePurchaseOrderPricing({ id, supplierId, orderDate, deliveryDate, currency, note, lines, userId }) {
  const oid = parseInt(String(id), 10);
  if (!Number.isFinite(oid) || oid < 1) {
    return err('Geçersiz sipariş', 'api.pur.id_invalid');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const lineChanges = [];
    const [[por]] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [oid]);
    if (!por) {
      await conn.rollback();
      return err('Sipariş yok', 'api.pur.order_not_found');
    }
    if (isOrderReadonlyForPricing(por)) {
      await conn.rollback();
      return err('Bu durumdaki sipariş güncellenemez', 'api.pur.order_readonly');
    }
    const hasPoiSup = await hasCol(conn, 'purchase_order_items', 'supplier_id');
    const hasFxRate = await hasCol(conn, 'purchase_order_items', 'fx_rate');
    const hasPricedAt = await hasCol(conn, 'purchase_order_items', 'priced_at');
    const hasPricedBy = await hasCol(conn, 'purchase_order_items', 'priced_by');
    const hasLineSt = await hasCol(conn, 'purchase_order_items', 'line_status');
    const cur = String(currency != null && currency !== '' ? currency : por.currency)
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 3) || 'UZS';
    const odate = orderDate != null && orderDate !== '' ? orderDate : por.order_date;
    const ddate =
      deliveryDate === undefined ? por.delivery_date : String(deliveryDate).trim() === '' ? null : deliveryDate;
    const n = note !== undefined ? optionalNoteUpperTr(note) : por.note;
    await conn.query('UPDATE purchase_orders SET order_date = ?, delivery_date = ?, currency = ?, note = ? WHERE id = ?', [
      odate,
      ddate || null,
      cur,
      n || null,
      oid,
    ]);
    if (Array.isArray(lines) && lines.length) {
      for (const ln of lines) {
        const oiId = parseInt(String(ln.orderItemId), 10);
        if (!Number.isFinite(oiId) || oiId < 1) continue;
        const up = Number(ln.unitPrice);
        const lineCurRaw =
          ln.currency != null && String(ln.currency).trim() !== ''
            ? String(ln.currency).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || cur
            : cur;
        const lineCur = normalizePricingCurrency(lineCurRaw);
        const fxRate = ln.fxRate != null && ln.fxRate !== '' ? Number(ln.fxRate) : null;
        if (!Number.isFinite(up) || up < 0) {
          await conn.rollback();
          return err('Geçerli birim fiyat gerekli', 'api.pur.line_price_required');
        }
        if (!isSupportedPricingCurrency(lineCur)) {
          await conn.rollback();
          return err('Bu para birimi için maliyet dönüşümü henüz desteklenmiyor', 'api.pur.currency_not_supported');
        }
        if (!Number.isFinite(fxRate) || fxRate <= 0) {
          await conn.rollback();
          return err('Geçerli kur gerekli (1 USD = ? UZS)', 'api.pur.fx_required');
        }
        const [[row]] = await conn.query(
          hasLineSt
            ? 'SELECT id, unit_price, currency, fx_rate, supplier_id, line_status FROM purchase_order_items WHERE id = ? AND order_id = ?'
            : 'SELECT id, unit_price, currency, fx_rate, supplier_id, NULL AS line_status FROM purchase_order_items WHERE id = ? AND order_id = ?',
          [oiId, oid]
        );
        if (!row) continue;
        if (hasLineSt && isPurchaseOrderLineCancelled(row)) {
          await conn.rollback();
          return err('İptal edilmiş sipariş kalemi güncellenemez', 'api.pur.line_cancelled');
        }
        const updates = ['unit_price = ?', 'currency = ?'];
        const values = [up, lineCur];
        if (hasFxRate) {
          updates.push('fx_rate = ?');
          values.push(Number.isFinite(fxRate) ? fxRate : null);
        }
        if (hasPricedAt) {
          updates.push('priced_at = NOW()');
        }
        if (hasPricedBy) {
          updates.push('priced_by = ?');
          values.push(userId || null);
        }
        if (hasPoiSup) {
          const supL = ln.supplierId != null && ln.supplierId !== '' ? parseInt(String(ln.supplierId), 10) : null;
          if (Number.isFinite(supL) && supL > 0) {
            const [[srow]] = await conn.query('SELECT id FROM suppliers WHERE id = ?', [supL]);
            updates.push('supplier_id = ?');
            values.push(srow ? supL : null);
          } else {
            updates.push('supplier_id = NULL');
          }
        }
        values.push(oiId);
        await conn.query(`UPDATE purchase_order_items SET ${updates.join(', ')} WHERE id = ?`, values);
        lineChanges.push({
          orderItemId: oiId,
          oldUnitPrice: row.unit_price,
          newUnitPrice: up,
          oldCurrency: row.currency,
          newCurrency: lineCur,
          oldFxRate: row.fx_rate,
          newFxRate: Number.isFinite(fxRate) ? fxRate : null,
          oldSupplierId: row.supplier_id,
          newSupplierId:
            ln.supplierId != null && ln.supplierId !== '' && Number.isFinite(parseInt(String(ln.supplierId), 10))
              ? parseInt(String(ln.supplierId), 10)
              : null,
        });
      }
    }
    if (await hasCol(conn, 'purchase_order_items', 'supplier_id')) {
      const supActiveSql = hasLineSt
        ? 'SELECT supplier_id AS sid FROM purchase_order_items WHERE order_id = ? AND supplier_id IS NOT NULL AND (line_status IS NULL OR line_status <> ?) ORDER BY id ASC LIMIT 1'
        : 'SELECT supplier_id AS sid FROM purchase_order_items WHERE order_id = ? AND supplier_id IS NOT NULL ORDER BY id ASC LIMIT 1';
      const [[h]] = hasLineSt
        ? await conn.query(supActiveSql, [oid, 'cancelled'])
        : await conn.query(supActiveSql, [oid]);
      let newSid = h && h.sid != null ? parseInt(String(h.sid), 10) : null;
      if (newSid == null || !Number.isFinite(newSid)) {
        if (supplierId != null && supplierId !== '') {
          newSid = parseInt(String(supplierId), 10);
        }
      }
      if (newSid == null || !Number.isFinite(newSid) || newSid < 1) {
        newSid = parseInt(String(por.supplier_id), 10);
      }
      const [[sup]] = await conn.query('SELECT id FROM suppliers WHERE id = ?', [newSid]);
      if (!sup) {
        await conn.rollback();
        return err('Tedarikçi bulunamadı', 'api.pur.supplier_not_found');
      }
      await conn.query('UPDATE purchase_orders SET supplier_id = ? WHERE id = ?', [newSid, oid]);
    }
    const pricingOut = await recalculatePricingStatusesForOrder(conn, oid);
    if (await hasCol(conn, 'purchase_orders', 'buyer_state')) {
      await conn.query(
        `UPDATE purchase_orders
         SET buyer_state = CASE
           WHEN buyer_state IS NULL OR buyer_state = '' OR buyer_state IN ('draft', 'in_progress', 'prices_saved')
             THEN 'prices_saved'
           ELSE buyer_state
         END
         WHERE id = ?`,
        [oid]
      );
    }
    await conn.commit();
    try {
      await recalculateCostLayersForOrderId(oid);
    } catch (e) {
      console.error('[recalculateCostLayersForOrderId]', e);
    }
    return { ok: true, pricingStatus: pricingOut.orderPricingStatus, lineChanges };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function setProcurementStateForOrderStart(orderId) {
  const oid = parseInt(String(orderId), 10);
  if (!Number.isFinite(oid) || oid < 1) {
    return err('Geçersiz sipariş', 'api.pur.id_invalid');
  }
  if (!(await hasCol('purchase_requests', 'procurement_state'))) {
    return { ok: true, skipped: true };
  }
  const [[r]] = await pool.query('SELECT id, status FROM purchase_orders WHERE id = ?', [oid]);
  if (!r) {
    return err('Sipariş yok', 'api.pur.order_not_found');
  }
  if (String(r.status) === 'cancelled') {
    return err('İptal siparişte işlem yapılamaz', 'api.pur.order_readonly');
  }
  await pool.query(
    `UPDATE purchase_requests pr
     INNER JOIN (
       SELECT DISTINCT pri.request_id AS rid
       FROM purchase_order_items poi
       INNER JOIN purchase_request_items pri ON pri.id = poi.request_item_id
       WHERE poi.order_id = ?
     ) t ON pr.id = t.rid
     SET pr.procurement_state = IF(pr.procurement_state IS NULL, 'started', 'ongoing')`,
    [oid]
  );
  return { ok: true };
}

async function runRequestBuyerAction({ userId, id, action, lines, orderDate, deliveryDate, note, currency }) {
  const a = String(action || '').trim().toLowerCase();
  if (!['process', 'complete'].includes(a)) {
    return err('Geçersiz işlem', 'api.pur.action_invalid');
  }
  const rid = parseInt(String(id), 10);
  if (!Number.isFinite(rid) || rid < 1) {
    return err('Geçersiz talep', 'api.pur.id_invalid');
  }
  const [[pr]] = await pool.query('SELECT id, pr_status FROM purchase_requests WHERE id = ?', [rid]);
  if (!pr) {
    return err('Talep yok', 'api.pur.request_not_found');
  }
  const prs = String(pr.pr_status);
  if (!['approved', 'partial'].includes(prs)) {
    return err('Bu talep onaylı / kısmi değil', 'api.pur.request_not_approved');
  }
  if (a === 'process') {
    if (await hasCol('purchase_requests', 'procurement_state')) {
      await pool.query(
        "UPDATE purchase_requests SET procurement_state = IF(procurement_state IS NULL OR procurement_state = '', 'started', 'ongoing') WHERE id = ?",
        [rid]
      );
    }
    return { ok: true, procurementState: 'ongoing' };
  }
  if (!Array.isArray(lines) || !lines.length) {
    return err('En az bir satır için tedarikçi ve fiyat girin', 'api.pur.order_lines_required');
  }
  const groups = new Map();
  for (const ln of lines) {
    const riId = parseInt(String(ln && ln.requestItemId), 10);
    const sid = parseInt(String(ln && ln.supplierId), 10);
    const up = Number(ln && ln.unitPrice);
    const cur = (ln && ln.currency) || currency;
    if (!Number.isFinite(riId) || riId < 1) continue;
    if (!Number.isFinite(sid) || sid < 1) continue;
    if (!Number.isFinite(up) || up < 0) continue;
    const k = String(sid);
    if (!groups.has(k)) {
      groups.set(k, { supplierId: sid, currency: cur, lines: [] });
    }
    groups.get(k).lines.push({ requestItemId: riId, unitPrice: up });
  }
  if (!groups.size) {
    return err('En az bir satır için tedarikçi ve fiyat girin', 'api.pur.order_lines_required');
  }
  const orderIds = [];
  for (const g of groups.values()) {
    const out = await createPurchaseOrder({
      userId,
      supplierId: g.supplierId,
      orderDate,
      deliveryDate,
      currency: g.currency,
      note,
      lines: g.lines,
    });
    if (out && out.error) {
      return out;
    }
    orderIds.push(out.orderId);
  }
  if (await hasCol('purchase_requests', 'procurement_state')) {
    await pool.query(
      "UPDATE purchase_requests SET procurement_state = 'ongoing' WHERE id = ?",
      [rid]
    );
  }
  return { ok: true, orderIds };
}

async function runOrderBuyerAction({ id, action }) {
  const a = String(action || '')
    .trim()
    .toLowerCase();
  if (!['process', 'ready', 'complete', 'revise'].includes(a)) {
    return err('Geçersiz işlem', 'api.pur.action_invalid');
  }
  const oid = parseInt(String(id), 10);
  if (!Number.isFinite(oid) || oid < 1) {
    return err('Geçersiz sipariş', 'api.pur.id_invalid');
  }
  const [[por]] = await pool.query('SELECT id, status FROM purchase_orders WHERE id = ?', [oid]);
  if (!por) {
    return err('Sipariş yok', 'api.pur.order_not_found');
  }
  if (String(por.status) === 'cancelled') {
    return err('İptal siparişte işlem yapılamaz', 'api.pur.order_readonly');
  }
  if (String(por.status) === 'completed') {
    return err('Tamamlanmış sipariş', 'api.pur.order_readonly');
  }
  const hasBuyerState = await hasCol('purchase_orders', 'buyer_state');
  if (a === 'process') {
    if (hasBuyerState) {
      await pool.query("UPDATE purchase_orders SET buyer_state = 'in_progress' WHERE id = ?", [oid]);
    }
    return setProcurementStateForOrderStart(oid);
  }
  if (a === 'ready') {
    return { ok: true };
  }
  if (a === 'complete') {
    if (hasBuyerState) {
      await pool.query("UPDATE purchase_orders SET buyer_state = 'completed' WHERE id = ?", [oid]);
    }
    return { ok: true, buyerStatus: 'completed' };
  }
  if (a === 'revise') {
    if (hasBuyerState) {
      await pool.query("UPDATE purchase_orders SET buyer_state = 'revision_requested' WHERE id = ?", [oid]);
    }
    return { ok: true, buyerStatus: 'revision_requested' };
  }
  return err('Geçersiz işlem', 'api.pur.action_invalid');
}

async function countPendingRequests() {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return 0;
  }
  const [r] = await pool.query("SELECT COUNT(*) AS c FROM purchase_requests WHERE pr_status = 'pending'");
  return r[0].c;
}

/**
 * Sipariş kalemi iptali (talep tarafına otomatik dönüş yok). qty_received > 0 ise yasak.
 */
async function cancelPurchaseOrderLine({ orderId, orderItemId, reason, userId }) {
  const oid = parseInt(String(orderId), 10);
  const oiid = parseInt(String(orderItemId), 10);
  if (!Number.isFinite(oid) || oid < 1 || !Number.isFinite(oiid) || oiid < 1) {
    return err('Geçersiz kayıt', 'api.pur.id_invalid');
  }
  const raw = String(reason || '').trim();
  if (!raw) {
    return err('İptal açıklaması zorunludur', 'api.pur.cancel_reason_required');
  }
  const reasonNorm = toUpperTr(raw);
  if (!reasonNorm) {
    return err('İptal açıklaması zorunludur', 'api.pur.cancel_reason_required');
  }
  if (!(await hasCol('purchase_order_items', 'line_status'))) {
    return err('Veritabanı güncellemesi gerekli (sipariş satırı iptali)', 'api.pur.migration_line_cancel');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[por]] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? FOR UPDATE', [oid]);
    if (!por) {
      await conn.rollback();
      return err('Sipariş yok', 'api.pur.order_not_found');
    }
    if (String(por.status) === 'cancelled') {
      await conn.rollback();
      return err('İptal siparişte işlem yapılamaz', 'api.pur.order_readonly');
    }
    const [[oi]] = await conn.query(
      'SELECT id, order_id, qty_received, line_status FROM purchase_order_items WHERE id = ? AND order_id = ? FOR UPDATE',
      [oiid, oid]
    );
    if (!oi) {
      await conn.rollback();
      return err('Sipariş satırı yok', 'api.pur.oi_not_found');
    }
    if (isPurchaseOrderLineCancelled(oi)) {
      await conn.rollback();
      return err('Satır zaten iptal edilmiş', 'api.pur.line_already_cancelled');
    }
    if (Number(oi.qty_received) > 0.0001) {
      await conn.rollback();
      return err(
        'Mal kabulü yapılmış sipariş kalemi iptal edilemez. Bu işlem iade veya stok düzeltme sürecidir.',
        'api.pur.line_cancel_forbidden_received'
      );
    }
    await conn.query(
      `UPDATE purchase_order_items
       SET line_status = 'cancelled', cancel_reason = ?, cancelled_at = NOW(), cancelled_by = ?
       WHERE id = ?`,
      [reasonNorm, userId || null, oiid]
    );
    await recalculateReceiptStatusesForOrder(conn, oid);
    await recalculatePricingStatusesForOrder(conn, oid);
    await conn.commit();
    return { ok: true, orderItemId: oiid, cancelReason: reasonNorm };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
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
  cancelPurchaseOrderLine,
  setProcurementStateForOrderStart,
  runOrderBuyerAction,
  runRequestBuyerAction,
  countPendingRequests,
  loadProductForPurchasing,
  stripOrderForWarehouse,
  hasCol,
};
