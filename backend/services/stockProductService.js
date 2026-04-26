const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { nextProductCodeFromDb } = require('../utils/productCode');
const { toUpperTr } = require('../utils/textNormalize');

let _unbrandedId;
async function getUnbrandedId() {
  if (_unbrandedId) {
    return _unbrandedId;
  }
  const [[b]] = await pool.query("SELECT id FROM brands WHERE slug = 'unbranded' LIMIT 1");
  if (!b) {
    const [r] = await pool.query('INSERT INTO brands (name, slug) VALUES (?, ?)', [toUpperTr('Markasız'), 'unbranded']);
    _unbrandedId = r.insertId;
  } else {
    _unbrandedId = b.id;
  }
  return _unbrandedId;
}

/**
 * Markalı: "Marka — malzeme – en×boy×derinlik" | markasız: "malzeme – en×boy×derinlik"
 * Aynı isimle ikinci ürün yasak: name tekilleştirme.
 */
function buildProductName({ materialLabel, widthMm, heightMm, depthMm, brandName, isUnbranded }) {
  const label = toUpperTr(materialLabel);
  if (!label) {
    return '';
  }
  const w = parseInt(String(widthMm), 10) || 0;
  const h = parseInt(String(heightMm), 10) || 0;
  const d = parseInt(String(depthMm), 10) || 0;
  let dim = '';
  if (w > 0 && h > 0) {
    dim = d > 0 ? `${w}x${h}x${d}` : `${w}x${h}`;
  }
  const tail = dim ? ` – ${dim}` : '';
  if (!isUnbranded && brandName) {
    return `${toUpperTr(brandName)} — ${label}${tail}`.trim();
  }
  return `${label}${tail}`.trim();
}

function computeM2PerPiece(widthMm, heightMm) {
  const w = parseInt(String(widthMm), 10) || 0;
  const h = parseInt(String(heightMm), 10) || 0;
  if (w > 0 && h > 0) {
    return (w * h) / 1_000_000;
  }
  return 1;
}

/** m3 / parça: en×boy×yükseklik (mm) */
function computeM3PerPiece(widthMm, heightMm, depthMm) {
  const w = parseInt(String(widthMm), 10) || 0;
  const h = parseInt(String(heightMm), 10) || 0;
  const d = parseInt(String(depthMm), 10) || 0;
  if (w > 0 && h > 0 && d > 0) {
    return (w * h * d) / 1_000_000_000;
  }
  if (w > 0 && h > 0) {
    return (w * h) / 1_000_000;
  }
  return 0;
}

function m3FromStockM2AndDepth(stockM2, depthMm) {
  const d = Number(depthMm) || 0;
  if (d <= 0) {
    return 0;
  }
  return Number(stockM2) * (d / 1000);
}

async function listProducts({ brandId, q, warehouseId, warehouseSubcategoryId } = {}) {
  let where = '1=1';
  const p = [];
  const hasMaterialLabel = await hasCol('products', 'material_label');
  const hasWidth = await hasCol('products', 'width_mm');
  const hasHeight = await hasCol('products', 'height_mm');
  const hasM2PerPiece = await hasCol('products', 'm2_per_piece');
  const hasStockPieces = await hasCol('products', 'stock_pieces');
  const hasStockM2 = await hasCol('products', 'stock_m2');
  const hasStockQty = await hasCol('products', 'stock_qty');
  const hasW = await hasCol('products', 'warehouse_id');
  const hasD = await hasCol('products', 'depth_mm');
  const hasFx = await hasCol('products', 'list_fx_uzs_per_usd');
  const hasM3 = await hasCol('products', 'stock_m3');

  if (brandId) {
    where += ' AND p.brand_id = ?';
    p.push(parseInt(String(brandId), 10));
  }
  if (warehouseId) {
    if (hasW) {
      where += ' AND p.warehouse_id = ?';
      p.push(parseInt(String(warehouseId), 10));
    }
  }
  if (warehouseSubcategoryId) {
    const wscCol = hasW && (await hasCol('products', 'warehouse_subcategory_id'));
    if (wscCol) {
      where += ' AND p.warehouse_subcategory_id = ?';
      p.push(parseInt(String(warehouseSubcategoryId), 10));
    }
  }
  if (q) {
    const s = `%${q}%`;
    if (hasMaterialLabel) {
      where += ' AND (p.name LIKE ? OR p.product_code LIKE ? OR p.material_label LIKE ?)';
      p.push(s, s, s);
    } else {
      where += ' AND (p.name LIKE ? OR p.product_code LIKE ?)';
      p.push(s, s);
    }
  }
  const wJoin = hasW
    ? 'LEFT JOIN warehouses wh ON wh.id = p.warehouse_id LEFT JOIN warehouse_subcategories wsc ON wsc.id = p.warehouse_subcategory_id'
    : '';
  const wSel = hasW
    ? ', wh.name AS warehouse_name, wsc.name AS subcategory_name, p.warehouse_id, p.warehouse_subcategory_id'
    : ", '' AS warehouse_name, '' AS subcategory_name, NULL AS warehouse_id, NULL AS warehouse_subcategory_id";
  const dSel = hasD ? 'p.depth_mm' : 'NULL AS depth_mm';
  const pFx = hasFx ? 'p.list_fx_uzs_per_usd' : 'NULL AS list_fx_uzs_per_usd';
  const pUsd = hasFx ? 'p.unit_price_usd' : 'NULL AS unit_price_usd';
  const pM3 = hasM3 ? 'p.stock_m3' : '0 AS stock_m3';
  const materialSel = hasMaterialLabel ? 'p.material_label' : 'NULL AS material_label';
  const widthSel = hasWidth ? 'p.width_mm' : 'NULL AS width_mm';
  const heightSel = hasHeight ? 'p.height_mm' : 'NULL AS height_mm';
  const m2PerPieceSel = hasM2PerPiece ? 'p.m2_per_piece' : '0 AS m2_per_piece';
  const stockQtySel = hasStockQty ? 'p.stock_qty' : '0 AS stock_qty';
  const stockM2Sel = hasStockM2 ? 'p.stock_m2' : stockQtySel;
  const stockPiecesSel = hasStockPieces ? 'p.stock_pieces' : '0 AS stock_pieces';

  const [rows] = await pool.query(
    `SELECT p.id, p.product_code, p.name, ${materialSel}, ${widthSel}, ${heightSel}, ${dSel}, ${m2PerPieceSel},
            p.brand_id, p.unit_id, p.unit_price, ${pFx}, ${pUsd}, ${stockQtySel} AS stock_qty,
            COALESCE(${stockM2Sel}, ${stockQtySel}) AS stock_m2, ${stockPiecesSel}, ${pM3},
            p.unit AS unit_legacy, u.code AS unit_code,
            b.name AS brand_name
            ${wSel}
     FROM products p
     LEFT JOIN units u ON u.id = p.unit_id
     INNER JOIN brands b ON b.id = p.brand_id
     ${wJoin}
     WHERE ${where}
     ORDER BY p.id DESC`,
    p
  );
  return rows;
}

async function hasCol(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col]
  );
  return r[0].c > 0;
}

async function createProduct({
  materialLabel,
  widthMm,
  heightMm,
  depthMm,
  unitId,
  brandId,
  unitPrice = 0,
  fxUzsPerUsd,
  warehouseId,
  warehouseSubcategoryId,
}) {
  const label = toUpperTr(materialLabel);
  if (!label) {
    return err('Malzeme / ürün tanımı gerekli', 'api.stock.material_required');
  }
  /* Liste fiyatı + kur: stok girişinde girilir; ürün kartında 0 + referans kur 1 */
  const fxIn = Number(fxUzsPerUsd);
  const fx = Number.isFinite(fxIn) && fxIn > 0 ? fxIn : 1;

  const uid = parseInt(String(unitId), 10) || 0;
  if (uid < 1) {
    return err('Birim seçin', 'api.stock.unit_required');
  }
  const [[urow]] = await pool.query('SELECT id FROM units WHERE id = ?', [uid]);
  if (!urow) {
    return err('Geçersiz birim', 'api.stock.unit_invalid');
  }

  const wid = parseInt(String(warehouseId), 10) || 0;
  const sid = parseInt(String(warehouseSubcategoryId), 10) || 0;
  if (wid < 1 || sid < 1) {
    return err('Depo ve alt kategori zorunludur', 'api.warehouse.required');
  }
  let sc;
  try {
    const [[row]] = await pool.query('SELECT id, warehouse_id FROM warehouse_subcategories WHERE id = ?', [sid]);
    sc = row;
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return err('Depo tabloları yok: npm run db:patch-5', 'api.warehouse.migration');
    }
    throw e;
  }
  if (!sc || Number(sc.warehouse_id) !== wid) {
    return err('Alt kategori seçilen depoya ait değil', 'api.warehouse.sub_mismatch');
  }

  let bid = brandId == null || brandId === '' ? 0 : parseInt(String(brandId), 10);
  if (!Number.isFinite(bid) || bid < 1) {
    bid = await getUnbrandedId();
  } else {
    const [[br]] = await pool.query('SELECT id, name FROM brands WHERE id = ?', [bid]);
    if (!br) {
      return err('Geçersiz marka', 'api.stock.brand_invalid');
    }
  }

  const ub = await getUnbrandedId();
  const isUnbranded = bid === ub;
  let brandDisplayName = '';
  if (!isUnbranded) {
    const [[bb]] = await pool.query('SELECT name FROM brands WHERE id = ?', [bid]);
    brandDisplayName = bb?.name || '';
  }

  const w = parseInt(String(widthMm), 10) || 0;
  const h = parseInt(String(heightMm), 10) || 0;
  const d = parseInt(String(depthMm), 10) || 0;
  const m2p = computeM2PerPiece(w, h);
  const name = buildProductName({
    materialLabel: label,
    widthMm: w,
    heightMm: h,
    depthMm: d,
    brandName: brandDisplayName,
    isUnbranded,
  });

  const [dup] = await pool.query('SELECT id FROM products WHERE name = ?', [name]);
  if (dup.length) {
    return err('Bu sistem adında ürün zaten var', 'api.stock.name_exists');
  }

  const up = Math.max(0, Number(unitPrice) || 0);
  const usd = fx > 0 ? up / fx : 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const productCode = await nextProductCodeFromDb(pool);
    try {
      // eslint-disable-next-line no-await-in-loop
      const [ins] = await pool.query(
        `INSERT INTO products (product_code, name, material_label, unit_id, width_mm, height_mm, depth_mm, m2_per_piece,
         brand_id, unit_price, unit, stock_qty, stock_m2, stock_pieces, stock_m3,
         list_fx_uzs_per_usd, unit_price_usd, warehouse_id, warehouse_subcategory_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,'m2',0,0,0,0,?,?,?,?)`,
        [productCode, name, label, uid, w || null, h || null, d || null, m2p, bid, up, fx, usd, wid, sid]
      );
      return { id: ins.insertId, productCode, name, m2PerPiece: m2p };
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY' && String(e.message).includes('product_code')) {
        // eslint-disable-next-line no-continue
        continue;
      }
      if (e.code === 'ER_BAD_FIELD_ERROR' || e.code === 'ER_NO_SUCH_TABLE') {
        // eslint-disable-next-line no-await-in-loop
        const [ins2] = await pool.query(
          `INSERT INTO products (product_code, name, brand_id, unit_price, unit) VALUES (?,?,?,?, 'm2')`,
          [productCode, name, bid, up]
        );
        return {
          id: ins2.insertId,
          productCode,
          name,
          m2PerPiece: m2p,
          warn: 'DB patch-005 ve patch-004 gerekli',
          warnKey: 'api.stock.warn_patch',
        };
      }
      if (e.code === 'ER_DUP_ENTRY') {
        return err('Bu sistem adında ürün zaten var', 'api.stock.name_exists');
      }
      throw e;
    }
  }
  return err('Ürün kodu üretilemedi', 'api.stock.code_failed');
}

async function getProductById(id) {
  const [rows] = await pool.query(
    `SELECT p.*, b.name AS brand_name, u.code AS unit_code
     FROM products p
     INNER JOIN brands b ON b.id = p.brand_id
     LEFT JOIN units u ON u.id = p.unit_id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function updateProduct(
  id,
  {
    materialLabel,
    widthMm,
    heightMm,
    depthMm,
    unitPrice,
    unitId,
    fxUzsPerUsd,
    brandId,
    warehouseId,
    warehouseSubcategoryId,
  } = {}
) {
  const p = await getProductById(id);
  if (!p) {
    return err('Ürün yok', 'api.stock.product_not_found');
  }
  const label =
    materialLabel != null ? toUpperTr(materialLabel) : toUpperTr(p.material_label != null && p.material_label !== '' ? p.material_label : p.name);
  if (!label) {
    return err('Malzeme / ürün tanımı gerekli', 'api.stock.material_required');
  }
  const w = widthMm != null ? parseInt(String(widthMm), 10) : p.width_mm || 0;
  const h = heightMm != null ? parseInt(String(heightMm), 10) : p.height_mm || 0;
  const d = depthMm != null ? parseInt(String(depthMm), 10) : p.depth_mm || 0;
  const m2p = computeM2PerPiece(w, h);
  const ub = await getUnbrandedId();
  let bidResolved = p.brand_id;
  if (brandId !== undefined) {
    if (brandId == null || brandId === '') {
      bidResolved = ub;
    } else {
      const t = parseInt(String(brandId), 10);
      if (Number.isFinite(t) && t > 0) {
        const [[br]] = await pool.query('SELECT id FROM brands WHERE id = ?', [t]);
        if (!br) {
          return err('Geçersiz marka', 'api.stock.brand_invalid');
        }
        bidResolved = t;
      } else {
        bidResolved = ub;
      }
    }
  }
  const isUnbranded = bidResolved === ub;
  let brandDisplayName = '';
  if (!isUnbranded) {
    const [[br]] = await pool.query('SELECT name FROM brands WHERE id = ?', [bidResolved]);
    brandDisplayName = br?.name || '';
  }
  const name = buildProductName({
    materialLabel: label,
    widthMm: w,
    heightMm: h,
    depthMm: d,
    brandName: brandDisplayName,
    isUnbranded,
  });
  const uid = unitId != null ? parseInt(String(unitId), 10) : p.unit_id;
  if (uid < 1) {
    return err('Birim gerekli', 'api.stock.unit_required');
  }
  const [[urow]] = await pool.query('SELECT id FROM units WHERE id = ?', [uid]);
  if (!urow) {
    return err('Geçersiz birim', 'api.stock.unit_invalid');
  }

  const [dup] = await pool.query('SELECT id FROM products WHERE name = ? AND id <> ?', [name, id]);
  if (dup.length) {
    return err('Bu sistem adında ürün zaten var', 'api.stock.name_exists');
  }

  const up = unitPrice != null ? Math.max(0, Number(unitPrice) || 0) : p.unit_price;
  let rawFx = fxUzsPerUsd != null && fxUzsPerUsd !== '' ? Number(fxUzsPerUsd) : p.list_fx_uzs_per_usd;
  const fx = Number.isFinite(rawFx) && rawFx > 0 ? rawFx : 1;
  const usd = fx > 0 ? up / fx : 0;

  const hasWh = await hasCol('products', 'warehouse_id');
  const defW = p.warehouse_id != null ? +p.warehouse_id : 0;
  const defS = p.warehouse_subcategory_id != null ? +p.warehouse_subcategory_id : 0;
  let whWid = defW;
  let whSid = defS;
  if (hasWh) {
    whWid = warehouseId !== undefined ? parseInt(String(warehouseId), 10) : defW;
    whSid = warehouseSubcategoryId !== undefined ? parseInt(String(warehouseSubcategoryId), 10) : defS;
    if (whWid < 1 || whSid < 1) {
      return err('Depo ve alt kategori zorunludur', 'api.warehouse.required');
    }
    let sc;
    try {
      const [[row]] = await pool.query('SELECT id, warehouse_id FROM warehouse_subcategories WHERE id = ?', [whSid]);
      sc = row;
    } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') {
        return err('Depo tabloları yok: npm run db:patch-5', 'api.warehouse.migration');
      }
      throw e;
    }
    if (!sc || Number(sc.warehouse_id) !== whWid) {
      return err('Alt kategori seçilen depoya ait değil', 'api.warehouse.sub_mismatch');
    }
  }

  if (await hasCol('products', 'depth_mm')) {
    const sm2 = Number(p.stock_m2) || Number(p.stock_qty) || 0;
    const sm3 = m3FromStockM2AndDepth(sm2, d);
    if (hasWh) {
      await pool.query(
        `UPDATE products SET
         name = :name, material_label = :ml, width_mm = :w, height_mm = :h, depth_mm = :d, m2_per_piece = :m2p,
         unit_id = :uid, unit_price = :up, list_fx_uzs_per_usd = :fx, unit_price_usd = :usd, stock_m3 = :sm3,
         brand_id = :bid, warehouse_id = :whid, warehouse_subcategory_id = :wsc
       WHERE id = :id`,
        {
          name,
          ml: label,
          w: w || null,
          h: h || null,
          d: d || null,
          m2p,
          uid,
          up,
          fx,
          usd,
          sm3,
          bid: bidResolved,
          whid: whWid,
          wsc: whSid,
          id,
        }
      );
    } else {
      await pool.query(
        `UPDATE products SET
         name = :name, material_label = :ml, width_mm = :w, height_mm = :h, depth_mm = :d, m2_per_piece = :m2p,
         unit_id = :uid, unit_price = :up, list_fx_uzs_per_usd = :fx, unit_price_usd = :usd, stock_m3 = :sm3, brand_id = :bid
       WHERE id = :id`,
        {
          name,
          ml: label,
          w: w || null,
          h: h || null,
          d: d || null,
          m2p,
          uid,
          up,
          fx,
          usd,
          sm3,
          bid: bidResolved,
          id,
        }
      );
    }
  } else if (hasWh) {
    await pool.query(
      `UPDATE products SET
         name = :name, material_label = :ml, width_mm = :w, height_mm = :h, m2_per_piece = :m2p, unit_id = :uid, unit_price = :up,
         brand_id = :bid, warehouse_id = :whid, warehouse_subcategory_id = :wsc
       WHERE id = :id`,
      {
        name,
        ml: label,
        w: w || null,
        h: h || null,
        m2p,
        uid,
        up,
        bid: bidResolved,
        whid: whWid,
        wsc: whSid,
        id,
      }
    );
  } else {
    await pool.query(
      `UPDATE products SET
         name = :name, material_label = :ml, width_mm = :w, height_mm = :h, m2_per_piece = :m2p, unit_id = :uid, unit_price = :up, brand_id = :bid
       WHERE id = :id`,
      { name, ml: label, w: w || null, h: h || null, m2p, uid, up, bid: bidResolved, id }
    );
  }
  return { ok: true, name, m2PerPiece: m2p };
}

async function deleteProduct(id) {
  const idNum = parseInt(String(id), 10);
  if (!Number.isFinite(idNum) || idNum < 1) {
    return err('Geçersiz ürün', 'api.stock.product_invalid');
  }
  const p = await getProductById(idNum);
  if (!p) {
    return err('Ürün yok', 'api.stock.product_not_found');
  }
  let mCount = 0;
  try {
    const [[c]] = await pool.query('SELECT COUNT(*) AS c FROM stock_movements WHERE product_id = ?', [idNum]);
    mCount = Number(c.c) || 0;
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      mCount = 0;
    } else {
      throw e;
    }
  }
  if (mCount > 0) {
    return err('Bu ürüne ait stok hareketi varken silinemez', 'api.stock.product_has_movements');
  }
  const sp = Number(p.stock_pieces) || 0;
  const sm2 = Number(p.stock_m2 != null ? p.stock_m2 : p.stock_qty) || 0;
  const sm3 = Number(p.stock_m3) || 0;
  if (sp > 0.0001 || sm2 > 0.0001 || sm3 > 0.0001) {
    return err('Stokta ürün varken silinemez', 'api.stock.product_has_stock');
  }
  await pool.query('DELETE FROM products WHERE id = ?', [idNum]);
  return { ok: true };
}

module.exports = {
  listProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  getUnbrandedId,
  buildProductName,
  computeM2PerPiece,
  computeM3PerPiece,
  m3FromStockM2AndDepth,
  hasCol,
};
