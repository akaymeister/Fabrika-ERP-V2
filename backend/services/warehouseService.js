const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { toUpperTr } = require('../utils/textNormalize');

async function tableExists(name) {
  const [r] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name]
  );
  return r[0].c > 0;
}

async function hasCol(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col]
  );
  return r[0].c > 0;
}

async function listWarehouses() {
  if (!(await tableExists('warehouses'))) {
    return [];
  }
  const [w] = await pool.query('SELECT id, name, sort_order, created_at FROM warehouses ORDER BY sort_order, name');
  const [s] = await pool.query(
    'SELECT id, warehouse_id, name, sort_order, created_at FROM warehouse_subcategories ORDER BY warehouse_id, sort_order, name'
  );
  const bySub = new Map();
  if (await hasCol('products', 'warehouse_subcategory_id')) {
    const [pc] = await pool.query(
      'SELECT warehouse_subcategory_id AS wid, COUNT(*) AS c FROM products WHERE warehouse_subcategory_id IS NOT NULL GROUP BY warehouse_subcategory_id'
    );
    for (const r of pc) {
      if (r.wid) {
        bySub.set(r.wid, r.c);
      }
    }
  }
  const byWh = new Map();
  for (const row of s) {
    if (!byWh.has(row.warehouse_id)) {
      byWh.set(row.warehouse_id, []);
    }
    const n = bySub.get(row.id) || 0;
    byWh.get(row.warehouse_id).push({
      ...row,
      productCount: n,
      deletable: n === 0,
    });
  }
  return w.map((x) => ({ ...x, subcategories: byWh.get(x.id) || [] }));
}

async function createWarehouse(name) {
  if (!(await tableExists('warehouses'))) {
    return err('Depo tabloları yok: npm run db:migrate && node database/patch-005.js', 'api.warehouse.migration');
  }
  const n = toUpperTr(name);
  if (!n) {
    return err('Depo adı gerekli', 'api.warehouse.name_required');
  }
  const [[dupW]] = await pool.query('SELECT id FROM warehouses WHERE name = ? LIMIT 1', [n]);
  if (dupW) {
    return err('Bu isimde bir depo zaten var', 'api.warehouse.duplicate_name');
  }
  const [r] = await pool.query('INSERT INTO warehouses (name, sort_order) VALUES (?, 99)', [n]);
  return { id: r.insertId };
}

/**
 * @param {number|string} warehouseId
 * @param {string} name
 */
async function updateWarehouse(warehouseId, name) {
  if (!(await tableExists('warehouses'))) {
    return err('Depo tabloları yok: npm run db:migrate && node database/patch-005.js', 'api.warehouse.migration');
  }
  const id = parseInt(String(warehouseId), 10);
  if (!Number.isFinite(id) || id < 1) {
    return err('Geçersiz depo', 'api.warehouse.invalid');
  }
  const n = toUpperTr(name);
  if (!n) {
    return err('Depo adı gerekli', 'api.warehouse.name_required');
  }
  const [[w]] = await pool.query('SELECT id FROM warehouses WHERE id = ?', [id]);
  if (!w) {
    return err('Depo yok', 'api.warehouse.not_found');
  }
  const [[dupW]] = await pool.query('SELECT id FROM warehouses WHERE name = ? AND id <> ? LIMIT 1', [n, id]);
  if (dupW) {
    return err('Bu isimde başka bir depo var', 'api.warehouse.duplicate_name');
  }
  await pool.query('UPDATE warehouses SET name = ? WHERE id = ?', [n, id]);
  return { ok: true, name: n };
}

async function createSubcategory(warehouseId, name) {
  if (!(await tableExists('warehouse_subcategories'))) {
    return err('Depo tabloları yok: npm run db:migrate && node database/patch-005.js', 'api.warehouse.migration');
  }
  const wid = parseInt(String(warehouseId), 10);
  if (!Number.isFinite(wid) || wid < 1) {
    return err('Geçersiz depo', 'api.warehouse.invalid');
  }
  const n = toUpperTr(name);
  if (!n) {
    return err('Alt kategori adı gerekli', 'api.warehouse.sub_name_required');
  }
  const [[wh]] = await pool.query('SELECT id FROM warehouses WHERE id = ?', [wid]);
  if (!wh) {
    return err('Depo yok', 'api.warehouse.not_found');
  }
  const [[dupS]] = await pool.query('SELECT id FROM warehouse_subcategories WHERE warehouse_id = ? AND name = ? LIMIT 1', [wid, n]);
  if (dupS) {
    return err('Bu depoda aynı isimde alt kategori zaten var', 'api.warehouse.sub_duplicate_name');
  }
  const [r] = await pool.query('INSERT INTO warehouse_subcategories (warehouse_id, name, sort_order) VALUES (?,?,99)', [wid, n]);
  return { id: r.insertId };
}

/**
 * Aynı depo altındaki alt kategori adını günceller (kayıtta tr-TR büyük harf).
 * @param {number|string} warehouseId
 * @param {number|string} subcategoryId
 * @param {string} name
 */
async function updateSubcategory(warehouseId, subcategoryId, name) {
  if (!(await tableExists('warehouse_subcategories'))) {
    return err('Depo tabloları yok: npm run db:migrate && node database/patch-005.js', 'api.warehouse.migration');
  }
  const wid = parseInt(String(warehouseId), 10);
  const sid = parseInt(String(subcategoryId), 10);
  if (!Number.isFinite(wid) || wid < 1 || !Number.isFinite(sid) || sid < 1) {
    return err('Geçersiz depo veya alt kategori', 'api.warehouse.invalid');
  }
  const n = toUpperTr(name);
  if (!n) {
    return err('Alt kategori adı gerekli', 'api.warehouse.sub_name_required');
  }
  const [[row]] = await pool.query('SELECT id, warehouse_id FROM warehouse_subcategories WHERE id = ?', [sid]);
  if (!row) {
    return err('Alt kategori yok', 'api.warehouse.sub_not_found');
  }
  if (Number(row.warehouse_id) !== wid) {
    return err('Alt kategori bu depoya ait değil', 'api.warehouse.sub_mismatch');
  }
  const [[dupS]] = await pool.query(
    'SELECT id FROM warehouse_subcategories WHERE warehouse_id = ? AND name = ? AND id <> ? LIMIT 1',
    [wid, n, sid]
  );
  if (dupS) {
    return err('Bu depoda aynı isimde başka alt kategori var', 'api.warehouse.sub_duplicate_name');
  }
  await pool.query('UPDATE warehouse_subcategories SET name = ? WHERE id = ?', [n, sid]);
  return { ok: true, name: n };
}

/**
 * Alt kategori silinir yalnızca bu alt kategoride ürün yokken (ürünler başka yere taşınmış olmalı).
 * Bu alt kategorideki ürünlere ait stok hareketi, ürün hâlâ bu alt kategorideyse zaten aynı engeldir;
 * referans: products.warehouse_subcategory_id.
 * @param {number|string} warehouseId
 * @param {number|string} subcategoryId
 */
async function deleteSubcategory(warehouseId, subcategoryId) {
  if (!(await tableExists('warehouse_subcategories'))) {
    return err('Depo tabloları yok: npm run db:migrate && node database/patch-005.js', 'api.warehouse.migration');
  }
  const wid = parseInt(String(warehouseId), 10);
  const sid = parseInt(String(subcategoryId), 10);
  if (!Number.isFinite(wid) || wid < 1 || !Number.isFinite(sid) || sid < 1) {
    return err('Geçersiz depo veya alt kategori', 'api.warehouse.invalid');
  }
  const [[row]] = await pool.query('SELECT id, warehouse_id FROM warehouse_subcategories WHERE id = ?', [sid]);
  if (!row) {
    return err('Alt kategori yok', 'api.warehouse.sub_not_found');
  }
  if (Number(row.warehouse_id) !== wid) {
    return err('Alt kategori bu depoya ait değil', 'api.warehouse.sub_mismatch');
  }
  if (await hasCol('products', 'warehouse_subcategory_id')) {
    const [[p]] = await pool.query('SELECT COUNT(*) AS c FROM products WHERE warehouse_subcategory_id = ?', [sid]);
    if (p.c > 0) {
      return err(
        'Bu alt kategoride ürün varken silinemez. Ürünleri başka depo ve alt kategoriye taşıyın; bu alt kategoride stok hareketi bulunan ürünler varken de önce taşıma gerekir.',
        'api.warehouse.sub_delete_has_products'
      );
    }
  }
  const [r] = await pool.query('DELETE FROM warehouse_subcategories WHERE id = ? AND warehouse_id = ?', [sid, wid]);
  if (r.affectedRows < 1) {
    return err('Alt kategori yok', 'api.warehouse.sub_not_found');
  }
  return { ok: true };
}

module.exports = {
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
};
