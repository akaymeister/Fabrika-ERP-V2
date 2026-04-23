/**
 * Mevcut kayıtları uygulama ile aynı kurala getirir: tr-TR büyük harf (I/İ, ı, i).
 * Not alanları: boş/whitespace -> NULL (optionalNoteUpperTr).
 * Kullanıcı adı, e-posta, marka slug (ör. unbranded) değişmez.
 * İdempotent: ikinci kez çalıştırmak güvenlidir.
 *
 *   node database/bulk-uppercase-tr.js
 *   npm run db:bulk-uppercase-tr
 */
const path = require('path');
const mysql = require('mysql2/promise');
const { toUpperTr, optionalNoteUpperTr } = require('../backend/utils/textNormalize');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function hasTable(conn, table) {
  const [r] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return r[0].c > 0;
}

async function hasColumn(conn, table, col) {
  const [r] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col]
  );
  return r[0].c > 0;
}

/** Not alanı: NULL ve boş aynı kabul, diğer durumlarda eşitlik. */
function noteEquals(cur, next) {
  if (cur == null) {
    return next == null;
  }
  if (next == null) {
    return false;
  }
  return String(cur) === String(next);
}

/**
 * @param {import('mysql2/promise').Connection} conn
 * @param {string} table
 * @param {string} idCol
 * @param {string} col
 * @param {'text' | 'note'} kind
 * @param {string} logLabel
 */
async function patchColumn(conn, table, idCol, col, kind, logLabel) {
  if (!(await hasTable(conn, table)) || !(await hasColumn(conn, table, col))) {
    // eslint-disable-next-line no-console
    console.log(`[bulk-uppercase] atlandı: ${logLabel} (${table}.${col} yok)`);
    return 0;
  }
  const [rows] = await conn.query(
    `SELECT \`${idCol}\` AS id, \`${col}\` AS v FROM \`${table}\``,
    []
  );
  let updated = 0;
  for (const row of rows) {
    const id = row.id;
    const cur = row.v;
    if (kind === 'text' && cur == null) {
      // NULL metin: boş stringe çevirmeyi atla (ör. material_label)
      // eslint-disable-next-line no-continue
      continue;
    }
    const next = kind === 'note' ? optionalNoteUpperTr(cur) : toUpperTr(cur);
    if (kind === 'note') {
      if (noteEquals(cur, next)) {
        // eslint-disable-next-line no-continue
        continue;
      }
    } else if (String(cur ?? '') === next) {
      // eslint-disable-next-line no-continue
      continue;
    }
    await conn.query(`UPDATE \`${table}\` SET \`${col}\` = ? WHERE \`${idCol}\` = ?`, [next, id]);
    updated += 1;
  }
  if (updated > 0) {
    // eslint-disable-next-line no-console
    console.log(`[bulk-uppercase] ${logLabel}: ${updated} satır`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[bulk-uppercase] ${logLabel}: değişiklik yok`);
  }
  return updated;
}

/**
 * @param {import('mysql2/promise').Connection} conn
 */
async function patchUnits(conn) {
  if (!(await hasTable(conn, 'units')) || !(await hasColumn(conn, 'units', 'code'))) {
    // eslint-disable-next-line no-console
    console.log('[bulk-uppercase] atlandı: units (tablo/sütun yok)');
    return 0;
  }
  const [rows] = await conn.query('SELECT id, code FROM units ORDER BY id');
  let updated = 0;
  for (const r of rows) {
    const raw = r.code;
    const next = toUpperTr(raw);
    if (String(raw ?? '') === next) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const [[ex]] = await conn.query('SELECT id FROM units WHERE LOWER(code) = LOWER(?) AND id <> ?', [
      next,
      r.id,
    ]);
    if (ex) {
      // eslint-disable-next-line no-console
      console.error(
        `[bulk-uppercase] units: id=${r.id} "${raw}" -> "${next}" atlandı: aynı koda (küçük-büyük) başka satır var (id=${ex.id})`
      );
      // eslint-disable-next-line no-continue
      continue;
    }
    try {
      await conn.query('UPDATE units SET code = ? WHERE id = ?', [next, r.id]);
      updated += 1;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[bulk-uppercase] units id=${r.id}:`, e.message);
    }
  }
  if (updated > 0) {
    // eslint-disable-next-line no-console
    console.log(`[bulk-uppercase] units.code: ${updated} satır`);
  } else {
    // eslint-disable-next-line no-console
    console.log('[bulk-uppercase] units.code: değişiklik yok');
  }
  return updated;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  // eslint-disable-next-line no-console
  console.log('[bulk-uppercase] Başlıyor (DATABASE=' + (process.env.DB_NAME || '') + ')...');

  try {
    await conn.beginTransaction();

    await patchUnits(conn);

    await patchColumn(conn, 'brands', 'id', 'name', 'text', 'brands.name');
    await patchColumn(conn, 'warehouses', 'id', 'name', 'text', 'warehouses.name');
    await patchColumn(
      conn,
      'warehouse_subcategories',
      'id',
      'name',
      'text',
      'warehouse_subcategories.name'
    );
    await patchColumn(conn, 'products', 'id', 'name', 'text', 'products.name');
    await patchColumn(conn, 'products', 'id', 'material_label', 'text', 'products.material_label');
    await patchColumn(conn, 'products', 'id', 'unit', 'text', "products.unit (eski/legacy sütun)");
    await patchColumn(conn, 'users', 'id', 'full_name', 'text', 'users.full_name');
    await patchColumn(conn, 'stock_movements', 'id', 'note', 'note', 'stock_movements.note');
    await patchColumn(conn, 'purchase_requests', 'id', 'title', 'text', 'purchase_requests.title');
    await patchColumn(conn, 'purchase_requests', 'id', 'note', 'note', 'purchase_requests.note');
    await patchColumn(conn, 'projects', 'id', 'name', 'text', 'projects.name');

    await conn.commit();
    // eslint-disable-next-line no-console
    console.log('[bulk-uppercase] Tamam (transaction commit).');
  } catch (e) {
    await conn.rollback();
    // eslint-disable-next-line no-console
    console.error('[bulk-uppercase] Hata, rollback:', e.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
