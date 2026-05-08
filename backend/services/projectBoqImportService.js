const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { err } = require('../utils/serviceError');
const { UPLOADS_ROOT } = require('../utils/paths');

const MAX_ROWS = 5000;
const DEFAULT_DROPDOWN_OPTIONS = ['Bekliyor', 'Devam ediyor', 'Tamamlandı', 'İptal', 'Revizyon', 'Gecikti'];
const OPERATION_PHASE_KEYS = new Set(['roleve', 'cizim', 'malzeme_siparisi', 'uretim', 'boya', 'sevk', 'montaj']);

const PRICE_USD_KEYS = new Set([
  'birim_fiyat_usd',
  'birin_fiyat_usd',
  'nds_dahil_birim_usd',
  'nsd_dahil_birim_usd',
  'nsd_dahil_birim_fiyat_usd',
  'toplam_usd',
]);
const PRICE_UZS_KEYS = new Set([
  'birim_fiyat_uzs',
  'birin_fiyat_uzs',
  'nsd_dahil_birim_uzs',
  'nds_dahil_birim_uzs',
  'toplam_uzs',
]);

const CORE_FIELD_MAP = {
  sn: 'seq_no',
  kat: 'location_floor',
  oda_no: 'room_no',
  mahal: 'mahal',
  urun_adi: 'product_name',
  urun_miktar: 'quantity',
  birim: 'unit',
};
const IMAGE_COLUMN_KEYS = new Set(['urun_gorseli', 'gorsel', 'resim', 'image', 'foto']);
const IMAGE_UPLOAD_SUBDIR = ['project-control', 'boq-images'];

function normalizeHeader(text) {
  return String(text || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/^\uFEFF/, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/__+/g, '_');
}

function toNumOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return n;
}

function asText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function getCellHyperlinkTarget(ws, rowIndex, colIndex) {
  const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  const cell = ws[addr];
  if (!cell || !cell.l || !cell.l.Target) return null;
  return asText(cell.l.Target);
}

function extractImageValue(ws, rowIndex, colIndex, rawValue) {
  const textValue = asText(rawValue);
  if (textValue) return textValue;
  const linkTarget = getCellHyperlinkTarget(ws, rowIndex, colIndex);
  if (linkTarget) return linkTarget;
  return null;
}

function posixResolve(fromFile, target) {
  const base = path.posix.dirname(fromFile);
  const merged = path.posix.normalize(path.posix.join(base, target));
  return merged.replace(/^\/+/, '');
}

function extFromPath(p) {
  const ext = path.extname(String(p || '')).toLowerCase();
  if (ext && ext.length <= 8) return ext;
  return '.bin';
}

async function loadZipText(zip, filePath) {
  const f = zip.file(filePath);
  if (!f) return '';
  return f.async('string');
}

async function extractAnchoredImages(fileBuffer) {
  try {
    const zip = await JSZip.loadAsync(fileBuffer);
    const workbookXml = await loadZipText(zip, 'xl/workbook.xml');
    if (!workbookXml) return {};

    const firstSheetTag = workbookXml.match(/<sheet\b[^>]*r:id="([^"]+)"[^>]*>/i);
    if (!firstSheetTag) return {};
    const workbookRelId = firstSheetTag[1];

    const workbookRelsXml = await loadZipText(zip, 'xl/_rels/workbook.xml.rels');
    const wbRelRe = new RegExp(`<Relationship\\b[^>]*Id="${workbookRelId}"[^>]*Target="([^"]+)"[^>]*/?>`, 'i');
    const wbRel = workbookRelsXml.match(wbRelRe);
    if (!wbRel) return {};
    const sheetPath = posixResolve('xl/workbook.xml', wbRel[1]);

    const sheetXml = await loadZipText(zip, sheetPath);
    const drawingTag = sheetXml.match(/<drawing\b[^>]*r:id="([^"]+)"[^>]*>/i);
    if (!drawingTag) return {};
    const sheetDrawingRelId = drawingTag[1];

    const sheetRelsPath = path.posix.join(path.posix.dirname(sheetPath), '_rels', `${path.posix.basename(sheetPath)}.rels`);
    const sheetRelsXml = await loadZipText(zip, sheetRelsPath);
    const sheetRelRe = new RegExp(`<Relationship\\b[^>]*Id="${sheetDrawingRelId}"[^>]*Target="([^"]+)"[^>]*/?>`, 'i');
    const sheetRel = sheetRelsXml.match(sheetRelRe);
    if (!sheetRel) return {};
    const drawingPath = posixResolve(sheetPath, sheetRel[1]);

    const drawingXml = await loadZipText(zip, drawingPath);
    if (!drawingXml) return {};

    const drawingRelsPath = path.posix.join(path.posix.dirname(drawingPath), '_rels', `${path.posix.basename(drawingPath)}.rels`);
    const drawingRelsXml = await loadZipText(zip, drawingRelsPath);
    const relMap = {};
    const relRe = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*/gi;
    let relMatch;
    while ((relMatch = relRe.exec(drawingRelsXml))) {
      relMap[relMatch[1]] = relMatch[2];
    }

    const outputDir = path.join(UPLOADS_ROOT, ...IMAGE_UPLOAD_SUBDIR);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const imageByZeroBasedRow = {};
    const anchorRe = /<(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)>/gi;
    let anchorMatch;
    while ((anchorMatch = anchorRe.exec(drawingXml))) {
      const block = anchorMatch[0];
      const rowMatch = block.match(/<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>/i);
      const fromRowMatch = block.match(/<(?:xdr:)?from>[\s\S]*?<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>[\s\S]*?<\/(?:xdr:)?from>/i);
      const toRowMatch = block.match(/<(?:xdr:)?to>[\s\S]*?<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>[\s\S]*?<\/(?:xdr:)?to>/i);
      const embedMatch = block.match(/<(?:a:)?blip\b[^>]*(?:r:embed|embed)="([^"]+)"/i);
      if (!rowMatch || !embedMatch) continue;
      const rowIndex = Number.parseInt(rowMatch[1], 10);
      if (!Number.isFinite(rowIndex) || rowIndex < 0) continue;
      const embedRelId = embedMatch[1];
      const mediaTarget = relMap[embedRelId];
      if (!mediaTarget) continue;
      const mediaPath = posixResolve(drawingPath, mediaTarget);
      const mediaFile = zip.file(mediaPath);
      if (!mediaFile) continue;

      const buffer = await mediaFile.async('nodebuffer');
      const ext = extFromPath(mediaPath);
      const fileName = `boqimg-${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`;
      const absOut = path.join(outputDir, fileName);
      fs.writeFileSync(absOut, buffer);
      const publicPath = `/uploads/${IMAGE_UPLOAD_SUBDIR.join('/')}/${fileName}`;
      const candidateRows = new Set([rowIndex]);
      const fromRow = Number.parseInt(String(fromRowMatch?.[1] || ''), 10);
      const toRow = Number.parseInt(String(toRowMatch?.[1] || ''), 10);
      if (Number.isFinite(fromRow) && fromRow >= 0) candidateRows.add(fromRow);
      if (Number.isFinite(toRow) && toRow >= 0) candidateRows.add(toRow);
      if (Number.isFinite(fromRow) && Number.isFinite(toRow) && fromRow >= 0 && toRow >= 0) {
        candidateRows.add(Math.round((fromRow + toRow) / 2));
      }
      candidateRows.forEach((r) => {
        if (!Number.isFinite(r) || r < 0) return;
        if (!imageByZeroBasedRow[r]) imageByZeroBasedRow[r] = publicPath;
      });
    }

    return imageByZeroBasedRow;
  } catch {
    return {};
  }
}

function stableRowUid(projectId, boqDocumentId, rowData) {
  const payload = JSON.stringify({ projectId, boqDocumentId, rowData });
  return crypto.createHash('sha1').update(payload).digest('hex');
}

function detectType(value) {
  if (value == null || value === '') return 'text';
  if (typeof value === 'number') return 'number';
  if (value instanceof Date) return 'date';
  const s = String(value).trim();
  if (!s) return 'text';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'date';
  if (/^\d+([.,]\d+)?$/.test(s)) return 'number';
  return 'text';
}

function detectInputType(label, hint, columnKey) {
  const l = String(label || '').toLocaleLowerCase('tr-TR');
  const h = String(hint || '').toLocaleLowerCase('tr-TR');
  const haystack = `${l} ${h}`;
  if (/(acilir|açılır|secenek|seçenek|dropdown|secil|seçil|select)/.test(haystack)) return 'dropdown';
  if (/(toggle|evet\/hayir|evet\/hayır|tamamlandi|tamamlandı|isaretle|işaretle|checkbox)/.test(haystack)) return 'toggle';
  if (/(tarih|date)/.test(haystack)) return 'date';
  if (/(fiyat|usd|uzs|toplam|nsd|nds)/.test(haystack)) return 'currency';
  if (/(miktar|adet|m2|metrekare|qty|quantity)/.test(haystack)) return 'number';
  if (/(salt okunur|readonly|kilitli|duzenlenmez|düzenlenmez)/.test(haystack)) return 'readonly';
  if (OPERATION_PHASE_KEYS.has(columnKey)) return 'dropdown';
  return 'text';
}

function detectOptions(hint, inputType, columnKey) {
  if (inputType !== 'dropdown') return null;
  const phaseOptions = ['Bekliyor', 'Devam', 'Tamam', 'Gecikti', 'Revizyon'];
  if (OPERATION_PHASE_KEYS.has(columnKey)) return phaseOptions;
  const text = String(hint || '').trim();
  const split = text.split(/[|,;/]/).map((x) => x.trim()).filter(Boolean);
  if (split.length >= 2 && split.length <= 20) return split.slice(0, 20);
  return DEFAULT_DROPDOWN_OPTIONS;
}

async function parseWorkbook(fileBuffer) {
  let wb;
  try {
    wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  } catch (_e) {
    return err('Dosya okunamadi', 'api.project_control.import_invalid_file');
  }
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return err('Excel sayfasi bulunamadi', 'api.project_control.import_no_sheet');
  const ws = wb.Sheets[firstSheetName];
  const anchoredImagesByRow = {};
  let anchoredImageColumnKey = 'urun_gorseli';
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  if (!rows.length) return err('Excel bos', 'api.project_control.import_empty');
  if (rows.length > MAX_ROWS + 2) return err('Excel satir limiti asildi', 'api.project_control.import_row_limit');

  const headerRow = rows[0] || [];
  const hintRow = rows[1] || [];
  const columns = [];
  for (let i = 0; i < headerRow.length; i += 1) {
    const label = asText(headerRow[i]);
    if (!label) continue;
    let key = normalizeHeader(label);
    if (!key) key = `col_${i + 1}`;
    const t = detectType(rows[2] ? rows[2][i] : null);
    columns.push({
      index: i,
      column_key: key,
      column_label: label,
      column_hint: asText(hintRow[i]),
      input_type: detectInputType(label, hintRow[i], key),
      options_json: null,
      data_type: t,
      is_price_usd: PRICE_USD_KEYS.has(key) ? 1 : 0,
      is_price_uzs: PRICE_UZS_KEYS.has(key) ? 1 : 0,
      is_visible_default: 1,
    });
  }
  columns.forEach((col) => {
    col.options_json = detectOptions(col.column_hint, col.input_type, col.column_key);
  });
  const imageCol = columns.find((c) => IMAGE_COLUMN_KEYS.has(c.column_key));
  if (imageCol) anchoredImageColumnKey = imageCol.column_key;
  if (!columns.length) return err('Excel kolonlari bulunamadi', 'api.project_control.import_no_columns');

  const startRow = rows.length >= 2 ? 2 : 1;
  // Gömülü Excel görsellerini satır ankora göre çıkar (satır karışmasını önlemek için sadece anchor row eşleşir).
  const extracted = await extractAnchoredImages(fileBuffer);
  Object.assign(anchoredImagesByRow, extracted || {});
  const workRows = [];
  for (let r = startRow; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const hasValue = row.some((x) => asText(x) != null);
    if (!hasValue) continue;
    const dynamic = {};
    columns.forEach((c) => {
      const rawValue = row[c.index] ?? null;
      if (IMAGE_COLUMN_KEYS.has(c.column_key)) {
        dynamic[c.column_key] = extractImageValue(ws, r, c.index, rawValue);
        return;
      }
      dynamic[c.column_key] = rawValue;
    });
    const anchoredImage =
      anchoredImagesByRow[r]
      || anchoredImagesByRow[r - 1]
      || anchoredImagesByRow[r + 1]
      || null;
    if (!dynamic[anchoredImageColumnKey] && anchoredImage) {
      dynamic[anchoredImageColumnKey] = anchoredImage;
    }
    workRows.push({
      source_row_no: r + 1,
      dynamic,
      mapped: {
        seq_no: toNumOrNull(dynamic.sn),
        location_floor: asText(dynamic.kat),
        room_no: asText(dynamic.oda_no),
        mahal: asText(dynamic.mahal),
        product_name: asText(dynamic.urun_adi),
        quantity: toNumOrNull(dynamic.urun_miktar),
        unit: asText(dynamic.birim),
      },
    });
  }
  if (!workRows.length) return err('Aktarilacak satir bulunamadi', 'api.project_control.import_no_rows');
  return {
    sheetName: firstSheetName,
    columns,
    rows: workRows,
    columnHints: hintRow,
  };
}

function mergeCoreFromDynamic(dynamicData, input = {}) {
  const out = { ...input };
  Object.entries(CORE_FIELD_MAP).forEach(([dynKey, coreKey]) => {
    if (out[coreKey] != null && out[coreKey] !== '') return;
    if (dynamicData[dynKey] == null || dynamicData[dynKey] === '') return;
    if (coreKey === 'quantity' || coreKey === 'seq_no') {
      out[coreKey] = toNumOrNull(dynamicData[dynKey]);
    } else {
      out[coreKey] = asText(dynamicData[dynKey]);
    }
  });
  return out;
}

module.exports = {
  parseWorkbook,
  stableRowUid,
  mergeCoreFromDynamic,
  PRICE_USD_KEYS,
  PRICE_UZS_KEYS,
  detectInputType,
  detectOptions,
  OPERATION_PHASE_KEYS,
};
