const XLSX = require('xlsx');
const { pool } = require('../config/database');
const { createProduct } = require('./stockProductService');

const MAX_DATA_ROWS = 500;

const FIELD_ALIASES = {
  material: [
    'malzeme',
    'material',
    'materyal',
    'aciklama',
    'açıklama',
    'urun',
  ],
  width_mm: ['en_mm', 'en', 'width', 'width_mm', 'genislik', 'genişlik'],
  height_mm: ['boy_mm', 'boy', 'height', 'height_mm', 'yukseklik'],
  depth_mm: ['derinlik_mm', 'derinlik', 'depth', 'depth_mm', 'kalinlik', 'kalınlık', 'd'],
  unit: ['birim', 'unit', 'unite', 'miktarbirimi', 'miktar birimi'],
  brand: ['marka', 'brand'],
  warehouse: ['depo', 'warehouse', 'deponame'],
  subcategory: ['alt_kategori', 'altkategori', 'subcategory', 'alt kategori', 'bolum', 'bölüm', 'kategori'],
};

function normKey(s) {
  return String(s ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/mm/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

function mapHeaders(headerRow) {
  const byField = {};
  (headerRow || []).forEach((raw, colIdx) => {
    const nk = normKey(raw);
    if (!nk) {
      return;
    }
    const compact = nk.replace(/\s/g, '');
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      const all = [field, ...aliases]
        .map((a) => normKey(a))
        .flatMap((a) => [a, a.replace(/\s/g, '')]);
      if (all.includes(nk) || all.includes(compact)) {
        if (byField[field] === undefined) {
          byField[field] = colIdx;
        }
        return;
      }
    }
  });
  return {
    material: byField.material,
    width_mm: byField.width_mm,
    height_mm: byField.height_mm,
    depth_mm: byField.depth_mm,
    unit: byField.unit,
    brand: byField.brand,
    warehouse: byField.warehouse,
    subcategory: byField.subcategory,
  };
}

function cell(row, colIdx) {
  if (colIdx === undefined || colIdx < 0) {
    return '';
  }
  const v = row[colIdx];
  if (v == null) {
    return '';
  }
  if (typeof v === 'number') {
    return String(v);
  }
  return String(v).trim();
}

function parseNum(s) {
  if (s == null || s === '') {
    return null;
  }
  const n = parseInt(String(s).replace(/[^\d-]/g, ''), 10);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

async function resolveUnitId(codeRaw) {
  const c = String(codeRaw || '')
    .trim()
    .toLowerCase();
  if (!c) {
    return { error: 'Birim kodu gerekli', messageKey: 'api.stock.unit_required' };
  }
  const [[u]] = await pool.query('SELECT id FROM units WHERE LOWER(code) = ?', [c]);
  if (!u) {
    return { error: 'Birim bulunamadı: ' + c, messageKey: 'api.stock.unit_not_found' };
  }
  return { id: u.id };
}

async function resolveBrandId(brandRaw) {
  const s = String(brandRaw ?? '').trim();
  if (!s || s === '—' || s === '-' || /^marka?siz$/i.test(s) || /^yok$/i.test(s)) {
    return { id: null };
  }
  const [[b]] = await pool.query('SELECT id, slug FROM brands WHERE LOWER(TRIM(name)) = LOWER(?)', [s]);
  if (!b) {
    return { error: 'Marka bulunamadı: ' + s, messageKey: 'api.stock.import_brand_not_found' };
  }
  if (b.slug === 'unbranded') {
    return { id: null };
  }
  return { id: b.id };
}

async function resolveWarehouseAndSub(whName, subName) {
  const wn = String(whName || '').trim();
  const sn = String(subName || '').trim();
  if (!wn) {
    return { error: 'Depo adı gerekli', messageKey: 'api.stock.import_warehouse_required' };
  }
  if (!sn) {
    return { error: 'Alt kategori gerekli', messageKey: 'api.stock.import_subcategory_required' };
  }
  try {
    const [[wh]] = await pool.query('SELECT id FROM warehouses WHERE LOWER(TRIM(name)) = LOWER(?)', [wn]);
    if (!wh) {
      return { error: 'Depo bulunamadı: ' + wn, messageKey: 'api.stock.import_warehouse_not_found' };
    }
    const [[sc]] = await pool.query(
      'SELECT id FROM warehouse_subcategories WHERE warehouse_id = ? AND LOWER(TRIM(name)) = LOWER(?)',
      [wh.id, sn]
    );
    if (!sc) {
      return { error: 'Alt kategori bu depoda bulunamadı: ' + sn, messageKey: 'api.stock.import_sub_not_found' };
    }
    return { warehouseId: wh.id, warehouseSubcategoryId: sc.id };
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return { error: 'Depo tabloları yok: npm run db:patch-5', messageKey: 'api.warehouse.migration' };
    }
    throw e;
  }
}

function isRowEmpty(row, colMap) {
  const keys = ['material', 'width_mm', 'height_mm', 'depth_mm', 'unit', 'brand', 'warehouse', 'subcategory'];
  return keys.every((k) => !String(cell(row, colMap[k])).trim());
}

/**
 * @returns {Buffer} xlsx
 */
function buildTemplateBuffer() {
  const aoa = [
    ['malzeme', 'en_mm', 'boy_mm', 'derinlik_mm', 'birim', 'marka', 'depo', 'alt_kategori'],
    ['Örnek MDF 18mm', 2100, 2800, 18, 'm2', 'Blum', 'Ana depo', 'A raflar'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'urunler');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * @param {Buffer} fileBuffer
 */
async function importProductsFromExcelBuffer(fileBuffer) {
  let wb;
  try {
    wb = XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (e) {
    return { error: 'Dosya okunamadı (xlsx/csv).', messageKey: 'api.stock.import_file_invalid' };
  }
  const name = wb.SheetNames[0];
  if (!name) {
    return { error: 'Sayfa yok', messageKey: 'api.stock.import_no_sheet' };
  }
  const sheet = wb.Sheets[name];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!aoa || aoa.length < 2) {
    return { error: 'En az üst satır (başlık) + bir veri satırı gerekli', messageKey: 'api.stock.import_too_few_rows' };
  }
  const headerRow = aoa[0] || [];
  const colMap = mapHeaders(headerRow);
  if (colMap.material === undefined || colMap.unit === undefined) {
    return { error: 'Sütunlar: malzeme ve birim zorunlu (ör. malzeme, en_mm, boy_mm, derinlik_mm, birim, marka, depo, alt_kategori)', messageKey: 'api.stock.import_columns' };
  }
  if (colMap.warehouse === undefined || colMap.subcategory === undefined) {
    return { error: 'Sütunlar: depo ve alt_kategori zorunludur', messageKey: 'api.stock.import_columns' };
  }

  const created = [];
  const errors = [];
  let processed = 0;

  for (let r = 1; r < aoa.length; r += 1) {
    const row = aoa[r];
    if (!row || isRowEmpty(row, colMap)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (processed >= MAX_DATA_ROWS) {
      errors.push({ row: r + 1, error: 'Satır limiti: ' + MAX_DATA_ROWS, messageKey: 'api.stock.import_row_limit' });
      break;
    }
    processed += 1;
    const excelRow = r + 1;
    const materialLabel = cell(row, colMap.material);
    if (!materialLabel) {
      errors.push({ row: excelRow, error: 'Malzeme boş', messageKey: 'api.stock.material_required' });
      // eslint-disable-next-line no-continue
      continue;
    }
    const wMm = parseNum(cell(row, colMap.width_mm));
    const hMm = parseNum(cell(row, colMap.height_mm));
    const dMm = parseNum(cell(row, colMap.depth_mm));
    const unitCode = cell(row, colMap.unit);

    const uRes = await resolveUnitId(unitCode);
    if (uRes.error) {
      errors.push({ row: excelRow, error: uRes.error, messageKey: uRes.messageKey });
      // eslint-disable-next-line no-continue
      continue;
    }
    const bRes = await resolveBrandId(cell(row, colMap.brand));
    if (bRes.error) {
      errors.push({ row: excelRow, error: bRes.error, messageKey: bRes.messageKey });
      // eslint-disable-next-line no-continue
      continue;
    }
    const whRes = await resolveWarehouseAndSub(cell(row, colMap.warehouse), cell(row, colMap.subcategory));
    if (whRes.error) {
      errors.push({ row: excelRow, error: whRes.error, messageKey: whRes.messageKey });
      // eslint-disable-next-line no-continue
      continue;
    }

    const out = await createProduct({
      materialLabel,
      widthMm: wMm != null ? wMm : '',
      heightMm: hMm != null ? hMm : '',
      depthMm: dMm != null ? dMm : '',
      unitId: uRes.id,
      brandId: bRes.id,
      warehouseId: whRes.warehouseId,
      warehouseSubcategoryId: whRes.warehouseSubcategoryId,
    });
    if (out.error) {
      errors.push({ row: excelRow, error: out.error, messageKey: out.messageKey || null });
    } else {
      created.push({
        row: excelRow,
        id: out.id,
        productCode: out.productCode,
        name: out.name,
        warnKey: out.warnKey || null,
      });
    }
  }

  if (processed === 0) {
    return { error: 'Veri satırı yok (sadece başlık veya boş satırlar)', messageKey: 'api.stock.import_no_data' };
  }

  return {
    createdCount: created.length,
    failedCount: errors.length,
    created,
    errors,
  };
}

module.exports = {
  buildTemplateBuffer,
  importProductsFromExcelBuffer,
  MAX_DATA_ROWS,
};
