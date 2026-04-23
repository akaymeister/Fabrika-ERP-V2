const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { toUpperTr, optionalNoteUpperTr } = require('../utils/textNormalize');
const { recordMovementIn } = require('./stockMovementService');
const { listProducts } = require('./stockProductService');

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

async function hasCol(t, c) {
  const [r] = await pool.query(
    'SELECT COUNT(*) AS a FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [t, c]
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

async function listSuppliers() {
  const [rows] = await pool.query('SELECT id, name, contact, tax_id, created_at FROM suppliers ORDER BY name');
  return rows;
}

async function createSupplier({ name, contact, taxId }) {
  const n = toUpperTr(String(name || '').trim());
  if (!n) {
    return err('Tedarikçi adı gerekli', 'api.pur.supplier_name_required');
  }
  const [r] = await pool.query('INSERT INTO suppliers (name, contact, tax_id) VALUES (?,?,?)', [n, contact || null, taxId || null]);
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
  const [rows] = await pool.query(
    `SELECT p.*, u.code AS unit_code, u.code AS u_code
     FROM products p
     LEFT JOIN units u ON u.id = p.unit_id
     WHERE p.id = ?
     LIMIT 1`,
    [productId]
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
async function listPurchaseRequests({ status, projectId, requestId } = {}) {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: npm run db:patch-6b (purchase_requests sütunları)', 'api.pur.migration_006b');
  }
  let where = '1=1';
  const p = [];
  if (requestId != null && requestId !== '') {
    where += ' AND pr.id = ?';
    p.push(parseInt(String(requestId), 10));
  }
  if (status) {
    where += ' AND pr.pr_status = ?';
    p.push(String(status));
  }
  if (projectId) {
    where += ' AND pr.project_id = ?';
    p.push(parseInt(String(projectId), 10));
  }
  const exSm = await hasCol('purchase_requests', 'status_message');
  const extraSel = exSm
    ? ', pr.status_message, pr.decided_by, pr.decided_at, COALESCE(NULLIF(TRIM(ua.full_name), \'\'), ua.username) AS approver_name'
    : '';
  const extraJoin = exSm ? 'LEFT JOIN users ua ON ua.id = pr.decided_by' : '';
  const [list] = await pool.query(
    `SELECT pr.id, pr.request_code, pr.title, pr.pr_status, pr.project_id, pr.requester_id, pr.created_at, pr.note,
            prj.project_code, prj.name AS project_name,
            COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS requester_name
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
  const [[row]] = await pool.query("SELECT pr_status, id FROM purchase_requests WHERE id = ?", [mid]);
  if (!row) {
    return err('Talep yok', 'api.pur.request_not_found');
  }
  if (String(row.pr_status) !== 'pending') {
    return err('Sadece onay bekleyen talep güncellenebilir', 'api.pur.request_not_pending');
  }
  let legacy = s === 'approved' ? 'approved' : 'rejected';
  if (s === 'revision_requested') {
    legacy = 'submitted';
  }
  const n = note && String(note).trim() ? String(note).trim().slice(0, 2000) : null;
  const hasDecided = await hasCol('purchase_requests', 'decided_by');
  if (hasDecided) {
    await pool.query(
      'UPDATE purchase_requests SET pr_status = ?, `status` = ?, decided_by = ?, decided_at = NOW(), status_message = ? WHERE id = ? AND pr_status = ?',
      [s, legacy, uid, n, mid, 'pending']
    );
  } else {
    await pool.query("UPDATE purchase_requests SET pr_status = ?, `status` = ? WHERE id = ? AND pr_status = 'pending'", [s, legacy, mid]);
  }
  return { ok: true };
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

async function createPurchaseOrder({ userId, supplierId, orderDate, deliveryDate, paymentTerms, currency, note, lines }) {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return err('DB: npm run db:patch-6b', 'api.pur.migration_006b');
  }
  const sid = parseInt(String(supplierId), 10);
  if (!Number.isFinite(sid) || sid < 1) {
    return err('Tedarikçi gerekli', 'api.pur.supplier_required');
  }
  const [[sup]] = await pool.query('SELECT id FROM suppliers WHERE id = ?', [sid]);
  if (!sup) {
    return err('Tedarikçi bulunamadı', 'api.pur.supplier_not_found');
  }
  if (!Array.isArray(lines) || !lines.length) {
    return err('Sipariş satırları gerekli', 'api.pur.order_lines_required');
  }
  const cur = String(currency || 'UZS')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3) || 'UZS';
  const odate = orderDate || new Date().toISOString().slice(0, 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let projectId = null;
    const oiIns = [];
    for (const ln of lines) {
      const riId = parseInt(String(ln.requestItemId), 10);
      const up = Number(ln.unitPrice);
      if (!Number.isFinite(riId) || riId < 1 || !Number.isFinite(up) || up < 0) {
        await conn.rollback();
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
        await conn.rollback();
        return err('Talep satırı yok', 'api.pur.request_item_not_found');
      }
      const prs = String(pri.pr_status);
      if (!['approved', 'partial'].includes(prs)) {
        await conn.rollback();
        return err('Sadece onaylı veya kısmi talep satırları siparişe bağlanabilir', 'api.pur.request_item_not_approved');
      }
      const [[ex]] = await conn.query('SELECT id FROM purchase_order_items WHERE request_item_id = ? LIMIT 1', [riId]);
      if (ex) {
        await conn.rollback();
        return err('Bu talep satırı zaten siparişe bağlı', 'api.pur.request_item_used');
      }
      if (projectId == null) {
        projectId = pri.project_id;
      } else if (Number(pri.project_id) !== Number(projectId)) {
        await conn.rollback();
        return err('Aynı siparişte aynı projeye ait satırlar olmalı', 'api.pur.project_mismatch');
      }
      const P = await loadProductForPurchasing(pri.product_id);
      const m2o = qtyToSystemM2(pri.quantity, pri.unit_code, P.m2_per_piece);
      oiIns.push({ pri, up, m2o, product: P, riId });
    }
    if (projectId == null) {
      await conn.rollback();
      return err('Sipariş için talep satırında proje gerekli (006b / project_id)', 'api.pur.po_project_required');
    }
    const [oins] = await conn.query(
      'INSERT INTO purchase_orders (order_code, supplier_id, project_id, order_date, delivery_date, payment_terms, currency, status, note, created_by) VALUES (NULL,?,?,?,?,?,?,\'ordered\',?,?)',
      [sid, projectId, odate, deliveryDate || null, paymentTerms || null, cur, optionalNoteUpperTr(note) || null, userId]
    );
    const oid = oins.insertId;
    await conn.query('UPDATE purchase_orders SET order_code = CONCAT(\'SIP-\', DATE_FORMAT(created_at, \'%Y\'), \'-\', LPAD(?, 5, \'0\')) WHERE id = ?', [oid, oid]);
    for (const row of oiIns) {
      await conn.query(
        'INSERT INTO purchase_order_items (order_id, request_item_id, product_id, qty_ordered, unit_price, currency, qty_received) VALUES (?,?,?,?,?,?,0)',
        [oid, row.riId, row.pri.product_id, row.m2o, row.up, cur]
      );
    }
    const rids = oiIns.map((r) => r.pri.request_id).filter((x) => x != null);
    await recomputeRequestStatusAfterPoLines(conn, rids);
    await conn.commit();
    return { orderId: oid };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

function stripOrderForWarehouse(row) {
  if (!row) return row;
  const o = { ...row };
  delete o.line_total;
  if (o.items) {
    o.items = o.items.map((it) => {
      const x = { ...it };
      delete x.unit_price;
      delete x.currency;
      delete x.line_total;
      return x;
    });
  }
  return o;
}

async function getPurchaseOrderById(id, { hidePrice } = {}) {
  const [ords] = await pool.query(
    `SELECT po.*, s.name AS supplier_name,
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
  const [items] = await pool.query(
    `SELECT poi.*, p.product_code, p.name AS product_name, pri.id AS request_item_id,
            pr.request_code, pr.id AS purchase_request_id,
            pri.quantity AS request_qty, pri.unit_code AS request_unit,
            pri.line_image_path AS request_line_image_path, pri.line_pdf_path AS request_line_pdf_path
     FROM purchase_order_items poi
     INNER JOIN products p ON p.id = poi.product_id
     LEFT JOIN purchase_request_items pri ON pri.id = poi.request_item_id
     LEFT JOIN purchase_requests pr ON pr.id = pri.request_id
     WHERE poi.order_id = ?`,
    [id]
  );
  for (const it of items) {
    it.qty_remaining = Math.max(0, Number(it.qty_ordered) - Number(it.qty_received || 0));
    it.line_total = Number(it.unit_price) * Number(it.qty_ordered);
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

async function listPurchaseOrders({ status, hidePrice } = {}) {
  let where = '1=1';
  const p = [];
  if (status) {
    where += ' AND po.status = ?';
    p.push(String(status));
  }
  const [list] = await pool.query(
    `SELECT po.id, po.order_code, po.supplier_id, po.project_id, po.order_date, po.delivery_date, po.status, po.currency, po.created_at,
            s.name AS supplier_name, prj.project_code
     FROM purchase_orders po
     INNER JOIN suppliers s ON s.id = po.supplier_id
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
  return { orders: list };
}

async function createGoodsReceipt({ userId, orderId, warehouseId, waybillNumber, note, lines }) {
  if (!(await tableExists('warehouses'))) {
    return err('Depo tablosu yok (patch-5)', 'api.warehouse.migration');
  }
  if (!(await hasCol('goods_receipts', 'id'))) {
    return err('Mal kabul tabloları yok (migrasyon 006)', 'api.pur.migration_006');
  }
  const wid = parseInt(String(warehouseId), 10);
  const [[wh]] = await pool.query('SELECT id FROM warehouses WHERE id = ?', [wid]);
  if (!wh) {
    return err('Depo bulunamadı', 'api.pur.warehouse_not_found');
  }
  const oid = parseInt(String(orderId), 10);
  if (!Array.isArray(lines) || !lines.length) {
    return err('Kabul satırları gerekli', 'api.pur.gr_lines_required');
  }
  const conn = await pool.getConnection();
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
      [oid, wid, waybillNumber || null, userId, optionalNoteUpperTr(note) || null]
    );
    const grid = grIns.insertId;
    await conn.query('UPDATE goods_receipts SET receipt_code = CONCAT(\'MKB-\', DATE_FORMAT(created_at, \'%Y\'), \'-\', LPAD(?, 5, \'0\')) WHERE id = ?', [grid, grid]);
    const [[grRow]] = await conn.query('SELECT receipt_code FROM goods_receipts WHERE id = ?', [grid]);
    const rcode = (grRow && grRow.receipt_code) || `MKB-${grid}`;

    for (const ln of lines) {
      const oiId = parseInt(String(ln.orderItemId), 10);
      const qa = Number(ln.qtyAccepted) || 0;
      const qr = Number(ln.qtyRejected) || 0;
      const qd = Number(ln.qtyDamaged) || 0;
      const qw = ln.qtyWaybill != null && ln.qtyWaybill !== '' ? Number(ln.qtyWaybill) : null;
      if (!Number.isFinite(oiId) || oiId < 1) {
        await conn.rollback();
        return err('Sipariş satır id gerekli', 'api.pur.oi_required');
      }
      const [[oi]] = await conn.query('SELECT * FROM purchase_order_items WHERE id = ? AND order_id = ? FOR UPDATE', [oiId, oid]);
      if (!oi) {
        await conn.rollback();
        return err('Sipariş satırı yok', 'api.pur.oi_not_found');
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
      const P = await loadProductForPurchasing(oi.product_id);
      if (!P) {
        await conn.rollback();
        return err('Ürün yok', 'api.stock.product_not_found');
      }
      if (P.warehouse_id && Number(P.warehouse_id) !== wid) {
        await conn.rollback();
        return err('Ürün bu depoda değil; depo/ürün eşleşmesi hatalı', 'api.pur.warehouse_product_mismatch');
      }
      const m2p = Number(P.m2_per_piece) || 0;
      if (m2p <= 0) {
        await conn.rollback();
        return err('Ürün m²/parça tanımlı değil; önce stokta ürünü güncelleyin', 'api.pur.m2p_required');
      }
      const totUzs = Math.max(0.01, Number(oi.unit_price) * Number(qa));
      const m2In = Number(qa);
      let qPieces = null;
      let qM2 = null;
      if (isM2ByProductRow(P)) {
        qM2 = m2In;
      } else {
        qPieces = m2In / m2p;
      }
      const mIn = await recordMovementIn({
        productId: oi.product_id,
        userId,
        note: toUpperTr(`${rcode} — SİP#${oid}`).slice(0, 400),
        qtyPieces: qPieces,
        qtyM2: qM2,
        projectId: por.project_id,
        inputCurrency: 'UZS',
        lineTotalUzs: totUzs,
        lineTotalUsd: 0,
        fxUzsPerUsd: 1,
        _useConn: conn,
      });
      if (mIn && mIn.error) {
        await conn.rollback();
        return mIn;
      }
      const smid = mIn?.movementId;
      await conn.query(
        'INSERT INTO goods_receipt_items (goods_receipt_id, order_item_id, qty_waybill, qty_accepted, qty_rejected, qty_damaged, line_note, stock_movement_id) VALUES (?,?,?,?,?,?,?,?)',
        [grid, oiId, qw, qa, qr, qd, optionalNoteUpperTr(ln.lineNote) || null, smid || null]
      );
      const nrec = Number(oi.qty_received) + qa;
      await conn.query('UPDATE purchase_order_items SET qty_received = ? WHERE id = ?', [nrec, oiId]);
    }
    const [sum] = await conn.query(
      'SELECT COALESCE(SUM(qty_ordered),0) AS qo, COALESCE(SUM(qty_received),0) AS qr FROM purchase_order_items WHERE order_id = ?',
      [oid]
    );
    const qo = Number(sum[0].qo);
    const qr = Number(sum[0].qr);
    let st = 'ordered';
    if (qr + 0.0001 >= qo) st = 'completed';
    else if (qr > 0) st = 'partial';
    await conn.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [st, oid]);
    await conn.commit();
    return { goodsReceiptId: grid, orderStatus: st };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function countPendingRequests() {
  if (!(await hasCol('purchase_requests', 'pr_status'))) {
    return 0;
  }
  const [r] = await pool.query("SELECT COUNT(*) AS c FROM purchase_requests WHERE pr_status = 'pending'");
  return r[0].c;
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
  getPurchaseOrderById,
  createGoodsReceipt,
  countPendingRequests,
  loadProductForPurchasing,
  stripOrderForWarehouse,
  hasCol,
};
