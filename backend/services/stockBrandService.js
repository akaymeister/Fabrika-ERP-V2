const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { toUpperTr } = require('../utils/textNormalize');

async function listBrands() {
  try {
    const [rows] = await pool.query('SELECT id, name, created_at, slug FROM brands ORDER BY name ASC');
    return rows;
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await pool.query('SELECT id, name, created_at, NULL AS slug FROM brands ORDER BY name ASC');
      return rows;
    }
    throw e;
  }
}

let _unbrandedId;
async function getUnbrandedIdCached() {
  if (_unbrandedId) {
    return _unbrandedId;
  }
  try {
    const [[b]] = await pool.query("SELECT id FROM brands WHERE slug = 'unbranded' LIMIT 1");
    if (b) {
      _unbrandedId = b.id;
    }
  } catch (e) {
    if (e.code !== 'ER_BAD_FIELD_ERROR') {
      throw e;
    }
  }
  return _unbrandedId;
}

async function createBrand(name) {
  const n = toUpperTr(name);
  if (!n) {
    return err('Marka adı gerekli', 'api.stock.brand_name_required');
  }
  const [dup] = await pool.query('SELECT id FROM brands WHERE LOWER(name) = LOWER(?) LIMIT 1', [n]);
  if (dup.length) {
    return err('Bu marka zaten var (büyük/küçük harf fark etmez)', 'api.stock.brand_exists');
  }
  try {
    const [r] = await pool.query('INSERT INTO brands (name) VALUES (?)', [n]);
    return { id: r.insertId };
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return err('Bu marka zaten var (büyük/küçük harf fark etmez)', 'api.stock.brand_exists');
    }
    throw e;
  }
}

async function updateBrand(id, name) {
  const n = toUpperTr(name);
  if (!n) {
    return err('Marka adı gerekli', 'api.stock.brand_name_required');
  }
  const idNum = parseInt(String(id), 10);
  if (!Number.isFinite(idNum) || idNum < 1) {
    return err('Geçersiz marka', 'api.stock.brand_invalid');
  }
  let row;
  try {
    const [rows] = await pool.query('SELECT id, slug FROM brands WHERE id = ?', [idNum]);
    row = rows[0];
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await pool.query('SELECT id FROM brands WHERE id = ?', [idNum]);
      row = rows[0];
    } else {
      throw e;
    }
  }
  if (!row) {
    return err('Marka yok', 'api.stock.brand_not_found');
  }
  const [dup] = await pool.query('SELECT id FROM brands WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1', [n, idNum]);
  if (dup.length) {
    return err('Bu marka zaten var (büyük/küçük harf fark etmez)', 'api.stock.brand_exists');
  }
  try {
    await pool.query('UPDATE brands SET name = ? WHERE id = ?', [n, idNum]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return err('Bu marka zaten var (büyük/küçük harf fark etmez)', 'api.stock.brand_exists');
    }
    throw e;
  }
  return { ok: true };
}

async function deleteBrand(id) {
  const idNum = parseInt(String(id), 10);
  if (!Number.isFinite(idNum) || idNum < 1) {
    return err('Geçersiz marka', 'api.stock.brand_invalid');
  }
  let row;
  try {
    const [rows] = await pool.query('SELECT id, slug FROM brands WHERE id = ?', [idNum]);
    row = rows[0];
  } catch (e) {
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await pool.query('SELECT id FROM brands WHERE id = ?', [idNum]);
      row = rows[0];
    } else {
      throw e;
    }
  }
  if (!row) {
    return err('Marka yok', 'api.stock.brand_not_found');
  }
  if (row.slug === 'unbranded') {
    return err('Sistem markası silinemez', 'api.stock.brand_system_cannot_delete');
  }
  const ub = await getUnbrandedIdCached();
  if (ub && idNum === ub) {
    return err('Sistem markası silinemez', 'api.stock.brand_system_cannot_delete');
  }
  let cnt = 0;
  try {
    const [[c]] = await pool.query('SELECT COUNT(*) AS c FROM products WHERE brand_id = ?', [idNum]);
    cnt = Number(c.c) || 0;
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      cnt = 0;
    } else {
      throw e;
    }
  }
  if (cnt > 0) {
    return err('Bu markaya bağlı ürün var; önce ürünlerin markasını değiştirin', 'api.stock.brand_in_use');
  }
  await pool.query('DELETE FROM brands WHERE id = ?', [idNum]);
  return { ok: true };
}

module.exports = { listBrands, createBrand, updateBrand, deleteBrand };
