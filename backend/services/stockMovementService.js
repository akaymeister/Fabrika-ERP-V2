const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { optionalNoteUpperTr } = require('../utils/textNormalize');
const { addLayer, consumeFifoM2, consumeFifoM2ForOut } = require('./stockCostLayerService');
const { getValue, KEYS, usdToSystemAmount } = require('./systemSettingsService');
const { m3FromStockM2AndDepth } = require('./stockProductService');

async function listMovements({ productId, movementType, projectId, limit = 100, offset = 0 } = {}) {
  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 500);
  const off = Math.max(parseInt(String(offset), 10) || 0, 0);
  const params = [];
  let where = '1=1';
  if (productId) {
    where += ' AND sm.product_id = ?';
    params.push(parseInt(String(productId), 10));
  }
  const mt = movementType && String(movementType).toLowerCase();
  if (mt === 'in' || mt === 'out' || mt === 'adjustment') {
    where += ' AND sm.movement_type = ?';
    params.push(mt);
  }
  if (projectId) {
    const pj = parseInt(String(projectId), 10);
    if (Number.isFinite(pj) && pj > 0) {
      where += ' AND sm.ref_type = ? AND sm.ref_id = ?';
      params.push('project', pj);
    }
  }
  params.push(lim, off);
  const hasExtra = await columnExists('stock_movements', 'line_total_uzs');
  const extra = hasExtra
    ? `, sm.input_currency, sm.line_total_uzs, sm.line_total_usd, sm.fx_uzs_per_usd, sm.cogs_uzs_total, sm.qty_pieces`
    : '';
  const hasUnitId = await columnExists('products', 'unit_id');
  const unitCol = hasUnitId ? 'u2.code AS unit_code' : 'p.unit AS unit_code';
  const unitJoin = hasUnitId ? 'LEFT JOIN units u2 ON u2.id = p.unit_id' : '';
  const hasDirectM2 = await columnExists('stock_movements', 'direct_m2_entry');
  const directM2Sel = hasDirectM2 ? 'sm.direct_m2_entry' : 'NULL AS direct_m2_entry';
  const hasProjects = await tableExists('projects');
  const projSel = hasProjects ? 'pr.name AS project_name, pr.project_code AS project_code' : 'NULL AS project_name, NULL AS project_code';
  const projJoin = hasProjects
    ? 'LEFT JOIN projects pr ON (sm.ref_type = \'project\' AND pr.id = sm.ref_id)'
    : '';
  const hasWh = await columnExists('products', 'warehouse_id');
  const whSel = hasWh ? 'p.warehouse_id, p.warehouse_subcategory_id' : 'NULL AS warehouse_id, NULL AS warehouse_subcategory_id';
  const [rows] = await pool.query(
    `SELECT sm.id, sm.product_id, sm.movement_type, sm.qty, sm.note, sm.ref_type, sm.ref_id, sm.created_at,
            p.product_code, p.name AS product_name, p.m2_per_piece, p.unit AS p_unit, ${unitCol},
            COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS user_username, ${directM2Sel}, ${whSel}, ${projSel}${extra}
     FROM stock_movements sm
     INNER JOIN products p ON p.id = sm.product_id
     LEFT JOIN users u ON u.id = sm.user_id
     ${unitJoin}
     ${projJoin}
     WHERE ${where}
     ORDER BY sm.id DESC
     LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col]
  );
  return r[0].c > 0;
}

/**
 * Giriş hareketini iptal: stok ve FIFO katmanı ters, kayıt silinir. Açıklama zorunlu.
 * @param {{ conn, movementId, userId, reason, kind? }} a — conn üzerinde transaction açık olmalı (replace senaryosu)
 */
async function voidStockInMovementOnConn(a) {
  const { conn, movementId, userId, reason, kind = 'delete' } = a;
  const reasonRow = optionalNoteUpperTr(reason);
  if (!reasonRow || !String(reasonRow).trim()) {
    return err('İptal / düzenleme açıklaması zorunludur', 'api.stock.void_reason_required');
  }
  const mid = parseInt(String(movementId), 10);
  if (!Number.isFinite(mid) || mid < 1) {
    return err('Geçersiz hareket', 'api.stock.movement_id_invalid');
  }
  const [[sm]] = await conn.query(
    `SELECT sm.* FROM stock_movements sm WHERE sm.id = ? AND sm.movement_type = 'in' FOR UPDATE`,
    [mid]
  );
  if (!sm) {
    return err('Giriş hareketi bulunamadı', 'api.stock.movement_in_not_found');
  }
  const m2In = Number(sm.qty);
  const inPieces = Number(sm.qty_pieces) || 0;
  const pid = parseInt(String(sm.product_id), 10);
  const [[P]] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [pid]);
  if (!P) {
    return err('Ürün yok', 'api.stock.product_not_found');
  }
  const m2p = Number(P.m2_per_piece) || 0;
  const sm2 = Number(P.stock_m2 != null && P.stock_m2 !== undefined ? P.stock_m2 : P.stock_qty) || 0;
  const sp = Number(P.stock_pieces) || 0;
  const stockQty = Number(P.stock_qty) || 0;
  if (m2In <= 0) {
    return err('Hareket m² geçersiz', 'api.stock.m2_invalid');
  }
  if (m2p > 0 && (await tableExists('stock_cost_layers')) && (await columnExists('stock_movements', 'line_total_uzs'))) {
    const [[L]] = await conn.query('SELECT * FROM stock_cost_layers WHERE movement_in_id = ? FOR UPDATE', [mid]);
    if (L) {
      const rem = Number(L.qty_m2_remaining);
      if (rem + 0.0001 < m2In) {
        return err('Bu girişten stok tüketildi; iptal veya değiştirme yapılamaz', 'api.stock.void_consumed');
      }
      await conn.query('DELETE FROM stock_cost_layers WHERE id = ?', [L.id]);
    }
  }
  const newM2 = Math.max(0, sm2 - m2In);
  const newPieces = Math.max(0, sp - (inPieces > 0 ? inPieces : m2p > 0 ? m2In / m2p : 0));
  const nq = Math.max(0, stockQty - m2In);
  if (await columnExists('products', 'stock_m2')) {
    const depth = Number(P.depth_mm) || 0;
    const newM3 =
      (await columnExists('products', 'stock_m3')) && depth > 0
        ? m3FromStockM2AndDepth(newM2, depth)
        : null;
    if (newM3 != null) {
      await conn.query('UPDATE products SET stock_m2 = ?, stock_pieces = ?, stock_qty = ?, stock_m3 = ? WHERE id = ?', [
        newM2,
        newPieces,
        nq,
        newM3,
        pid,
      ]);
    } else {
      await conn.query('UPDATE products SET stock_m2 = ?, stock_pieces = ?, stock_qty = ? WHERE id = ?', [
        newM2,
        newPieces,
        nq,
        pid,
      ]);
    }
  } else {
    await conn.query('UPDATE products SET stock_qty = ? WHERE id = ?', [nq, pid]);
  }
  await conn.query('DELETE FROM stock_movements WHERE id = ?', [mid]);
  if (await tableExists('stock_in_void_audit')) {
    try {
      await conn.query(
        'INSERT INTO stock_in_void_audit (old_movement_id, product_id, void_reason, voided_by, kind) VALUES (?,?,?,?,?)',
        [mid, pid, reasonRow, userId, kind === 'replace' ? 'replace' : 'delete']
      );
    } catch {
      /* tablo yok veya hata: ana işlem yine de tamam */
    }
  }
  return { voidedId: mid, newStockM2: String(newM2), newStockPieces: String(newPieces) };
}

async function voidStockInMovement({ movementId, userId, reason, kind = 'delete' }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await voidStockInMovementOnConn({ conn, movementId, userId, reason, kind });
    if (out && out.error) {
      await conn.rollback();
      return out;
    }
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Düzenle: eski girişi aynı işlemde iptal + yeni kayıt
 */
async function replaceStockInMovement({ oldMovementId, userId, reason, inParams }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const v = await voidStockInMovementOnConn({
      conn,
      movementId: oldMovementId,
      userId,
      reason: `${reason} [DÜZENLE]`,
      kind: 'replace',
    });
    if (v && v.error) {
      await conn.rollback();
      return v;
    }
    const inRes = await recordMovementIn({ ...inParams, userId, _useConn: conn });
    if (inRes && inRes.error) {
      await conn.rollback();
      return inRes;
    }
    await conn.commit();
    return inRes;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Çıkış hareketini iptal: stok + FIFO iade, kayıt silinir. Açıklama zorunlu.
 */
async function voidStockOutMovementOnConn(a) {
  const { conn, movementId, userId, reason, kind = 'delete' } = a;
  const reasonRow = optionalNoteUpperTr(reason);
  if (!reasonRow || !String(reasonRow).trim()) {
    return err('İptal / düzenleme açıklaması zorunludur', 'api.stock.void_reason_required');
  }
  const mid = parseInt(String(movementId), 10);
  if (!Number.isFinite(mid) || mid < 1) {
    return err('Geçersiz hareket', 'api.stock.movement_id_invalid');
  }
  const [[sm]] = await conn.query(
    `SELECT * FROM stock_movements WHERE id = ? AND movement_type = 'out' FOR UPDATE`,
    [mid]
  );
  if (!sm) {
    return err('Çıkış hareketi bulunamadı', 'api.stock.movement_out_not_found');
  }
  const m2Out = Number(sm.qty);
  const outPieces = Number(sm.qty_pieces) || 0;
  const cogsT = sm.cogs_uzs_total != null && sm.cogs_uzs_total !== undefined ? Number(sm.cogs_uzs_total) : 0;
  const pid = parseInt(String(sm.product_id), 10);
  let takenArr = null;
  if (await columnExists('stock_movements', 'out_fifo_taken') && sm.out_fifo_taken) {
    try {
      const raw = sm.out_fifo_taken;
      takenArr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      takenArr = null;
    }
  }
  if (await tableExists('stock_cost_layers')) {
    if (Array.isArray(takenArr) && takenArr.length) {
      for (const t of takenArr) {
        const lid = t.layerId;
        const m2Part = Number(t.m2) || 0;
        if (lid && m2Part > 0) {
          await conn.query('UPDATE stock_cost_layers SET qty_m2_remaining = qty_m2_remaining + ? WHERE id = ?', [m2Part, lid]);
        }
      }
    } else if (cogsT > 0.0001) {
      const [rows] = await conn.query('SELECT id FROM stock_cost_layers WHERE product_id = ? ORDER BY id ASC LIMIT 1', [pid]);
      if (rows[0]) {
        await conn.query('UPDATE stock_cost_layers SET qty_m2_remaining = qty_m2_remaining + ? WHERE id = ?', [m2Out, rows[0].id]);
      }
    }
  }
  const [[P]] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [pid]);
  if (!P) {
    return err('Ürün yok', 'api.stock.product_not_found');
  }
  if (m2Out <= 0) {
    return err('Hareket m² geçersiz', 'api.stock.m2_invalid');
  }
  const m2p = Number(P.m2_per_piece) || 0;
  const sm2 = Number(P.stock_m2) || Number(P.stock_qty) || 0;
  const sp = Number(P.stock_pieces) || 0;
  const nq = Number(P.stock_qty) || 0;
  const newM2 = sm2 + m2Out;
  const addPieces = m2p > 0 ? m2Out / m2p : outPieces;
  const newP = sp + addPieces;
  const newNq = nq + m2Out;
  const depth = Number(P.depth_mm) || 0;
  const newM3 =
    (await columnExists('products', 'stock_m3')) && depth > 0 ? m3FromStockM2AndDepth(newM2, depth) : null;
  if (newM3 != null) {
    await conn.query('UPDATE products SET stock_m2 = ?, stock_pieces = ?, stock_qty = ?, stock_m3 = ? WHERE id = ?', [
      newM2,
      newP,
      newNq,
      newM3,
      pid,
    ]);
  } else {
    await conn.query('UPDATE products SET stock_m2 = ?, stock_pieces = ?, stock_qty = ? WHERE id = ?', [
      newM2,
      newP,
      newNq,
      pid,
    ]);
  }
  await conn.query('DELETE FROM stock_movements WHERE id = ?', [mid]);
  if (await tableExists('stock_out_void_audit')) {
    try {
      await conn.query(
        'INSERT INTO stock_out_void_audit (old_movement_id, product_id, void_reason, voided_by, kind) VALUES (?,?,?,?,?)',
        [mid, pid, reasonRow, userId, kind === 'replace' ? 'replace' : 'delete']
      );
    } catch {
      /* tablo yok: ana iş yine de tamam */
    }
  }
  return { voidedId: mid, newStockM2: String(newM2), newStockPieces: String(newP) };
}

async function voidStockOutMovement({ movementId, userId, reason, kind = 'delete' }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await voidStockOutMovementOnConn({ conn, movementId, userId, reason, kind });
    if (out && out.error) {
      await conn.rollback();
      return out;
    }
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Düzenle: eski çıkışı aynı işlemde iptal + yeni çıkış
 */
async function replaceStockOutMovement({ oldMovementId, userId, reason, outParams }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const v = await voidStockOutMovementOnConn({
      conn,
      movementId: oldMovementId,
      userId,
      reason: `${reason} [DÜZENLE]`,
      kind: 'replace',
    });
    if (v && v.error) {
      await conn.rollback();
      return v;
    }
    const o = await recordMovementOut({ ...outParams, userId, _useConn: conn });
    if (o && o.error) {
      await conn.rollback();
      return o;
    }
    await conn.commit();
    return o;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Giriş: qtyPieces veya m2; para: SYSTEM (UZS) veya USD
 * _useConn: dış transaction (replace) — commit/release dışarıda
 */
async function recordMovementIn(params) {
  const {
    _useConn,
    productId,
    userId,
    note,
    qtyPieces,
    qtyM2: qtyM2In,
    projectId,
    inputCurrency = 'UZS', // 'UZS' | 'USD' | 'SYSTEM' — SYSTEM = DB default_currency karşılığı
    lineTotalUzs,
    lineTotalUsd,
    fxUzsPerUsd,
  } = params;

  const ownConn = !_useConn;
  const conn = _useConn || (await pool.getConnection());

  const noteRow = optionalNoteUpperTr(note);

  const pid = parseInt(String(productId), 10);
  const qPieces = Number(qtyPieces);
  const directM2 = Number(qtyM2In);
  try {
    if (ownConn) {
      await conn.beginTransaction();
    }
    const [[P]] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [pid]);
    if (!P) {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Ürün yok', 'api.stock.product_not_found');
    }
    const m2p = Number(P.m2_per_piece) || 0;
    if (m2p <= 0) {
      if (ownConn) {
        await conn.rollback();
      }
      return err(
        'Ürün m2/parça oranı hatalı (önce ürün boyutları / patch-004)',
        'api.stock.m2_per_piece_invalid'
      );
    }
    let m2In;
    if (Number.isFinite(directM2) && directM2 > 0) {
      m2In = directM2;
    } else if (Number.isFinite(qPieces) && qPieces > 0) {
      m2In = qPieces * m2p;
    } else {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Miktar: adet veya m2 girin', 'api.stock.qty_pieces_or_m2');
    }
    if (m2In <= 0) {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Girilecek m2 0’dan büyük olmalı', 'api.stock.m2_positive');
    }

    const pj = projectId != null && projectId !== '' ? parseInt(String(projectId), 10) : NaN;
    if (!Number.isFinite(pj) || pj < 1) {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Proje seçimi zorunludur', 'api.stock.project_required');
    }
    const [[prj]] = await conn.query('SELECT id FROM projects WHERE id = ? AND status = ? LIMIT 1', [pj, 'active']);
    if (!prj) {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Proje bulunamadı veya pasif', 'api.stock.project_invalid');
    }
    const refTypeRow = 'project';
    const refIdRow = pj;

    const defCur = (await getValue(KEYS.CURRENCY)) || 'UZS';
    const useUsd = String(inputCurrency).toUpperCase() === 'USD';
    const fx = Number(fxUzsPerUsd) || 0;
    let totalUzs = Number(lineTotalUzs) || 0;
    let totalUsd = Number(lineTotalUsd) || 0;
    if (useUsd) {
      if (totalUsd <= 0 || fx <= 0) {
        if (ownConn) {
          await conn.rollback();
        }
        return err('USD tutarı ve kur (1 USD = ? UZS) gerekli', 'api.stock.usd_fx_required');
      }
      totalUzs = usdToSystemAmount(totalUsd, fx);
    } else {
      if (totalUzs <= 0) {
        if (ownConn) {
          await conn.rollback();
        }
        return err('Toplam tutar (sistem parası) gerekli', 'api.stock.line_total_system_required');
      }
    }
    const costUzsPerM2 = totalUzs / m2In;
    const costUsdPerM2 = useUsd && totalUsd > 0 ? totalUsd / m2In : null;

    const sp = Number(P.stock_pieces) || 0;
    const sm2 = Number(P.stock_m2 != null && P.stock_m2 !== undefined ? P.stock_m2 : P.stock_qty) || 0;
    const addPieces = m2p > 0 ? m2In / m2p : 0;
    const newM2 = sm2 + m2In;
    const newPieces = sp + addPieces;
    const stockQty = Number(P.stock_qty) || 0;
    const newQty = stockQty + m2In;
    if (await columnExists('products', 'stock_m2')) {
      const depth = Number(P.depth_mm) || 0;
      const newM3 =
        (await columnExists('products', 'stock_m3')) && depth > 0
          ? m3FromStockM2AndDepth(newM2, depth)
          : null;
      if (newM3 != null) {
        await conn.query('UPDATE products SET stock_m2 = ?, stock_pieces = ?, stock_qty = ?, stock_m3 = ? WHERE id = ?', [
          newM2,
          newPieces,
          newQty,
          newM3,
          pid,
        ]);
      } else {
        await conn.query('UPDATE products SET stock_m2 = ?, stock_pieces = ?, stock_qty = ? WHERE id = ?', [
          newM2,
          newPieces,
          newQty,
          pid,
        ]);
      }
    } else {
      await conn.query('UPDATE products SET stock_qty = ? WHERE id = ?', [newQty, pid]);
    }
    const directM2Entry = Number.isFinite(directM2) && directM2 > 0 ? 1 : 0;
    let mid;
    if (await columnExists('stock_movements', 'line_total_uzs')) {
      const hasDirectCol = await columnExists('stock_movements', 'direct_m2_entry');
      if (hasDirectCol) {
        const [r] = await conn.query(
          `INSERT INTO stock_movements (product_id, user_id, movement_type, qty, qty_pieces, direct_m2_entry, ref_type, ref_id, line_total_uzs, line_total_usd, fx_uzs_per_usd, input_currency, note)
           VALUES (?,?, 'in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pid,
            userId,
            m2In,
            addPieces,
            directM2Entry,
            refTypeRow,
            refIdRow,
            totalUzs,
            useUsd ? totalUsd : null,
            useUsd ? fx : null,
            useUsd ? 'USD' : 'UZS',
            noteRow,
          ]
        );
        mid = r.insertId;
      } else {
        const [r] = await conn.query(
          `INSERT INTO stock_movements (product_id, user_id, movement_type, qty, qty_pieces, ref_type, ref_id, line_total_uzs, line_total_usd, fx_uzs_per_usd, input_currency, note)
         VALUES (?,?, 'in', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pid,
            userId,
            m2In,
            addPieces,
            refTypeRow,
            refIdRow,
            totalUzs,
            useUsd ? totalUsd : null,
            useUsd ? fx : null,
            useUsd ? 'USD' : 'UZS',
            noteRow,
          ]
        );
        mid = r.insertId;
      }
    } else {
      const [r] = await conn.query(
        `INSERT INTO stock_movements (product_id, user_id, movement_type, qty, ref_type, ref_id, note) VALUES (?,?, 'in', ?, ?, ?, ?)`,
        [pid, userId, m2In, refTypeRow, refIdRow, noteRow]
      );
      mid = r.insertId;
    }
    if (await tableExists('stock_cost_layers')) {
      await addLayer(conn, {
        productId: pid,
        movementInId: mid,
        qtyM2: m2In,
        costUzsPerM2,
        costUsdPerM2: costUsdPerM2,
        inputCurrency: useUsd ? 'USD' : 'UZS',
        fxUzsPerUsd: useUsd ? fx : null,
      });
    }
    if (ownConn) {
      await conn.commit();
    }
    return { movementId: mid, newStockM2: String(newM2), newStockPieces: String(newPieces), cogs: null };
  } catch (e) {
    if (ownConn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    throw e;
  } finally {
    if (ownConn) {
      conn.release();
    }
  }
}

async function recordMovementOut(params) {
  const { _useConn, productId, userId, note, qtyM2, qtyPieces, projectId } = params;
  const ownConn = !_useConn;
  const conn = _useConn || (await pool.getConnection());
  const noteRow = optionalNoteUpperTr(note);
  const pid = parseInt(String(productId), 10);
  try {
    if (ownConn) {
      await conn.beginTransaction();
    }
    const [[P]] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [pid]);
    if (!P) {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Ürün yok', 'api.stock.product_not_found');
    }
    const m2p = Number(P.m2_per_piece) || 0;
    let m2Out;
    if (Number(qtyM2) > 0) {
      m2Out = Number(qtyM2);
    } else if (Number(qtyPieces) > 0 && m2p > 0) {
      m2Out = Number(qtyPieces) * m2p;
    } else {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Çıkış: m2 veya adet', 'api.stock.out_qty_required');
    }
    if (m2Out <= 0) {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Miktar geçersiz', 'api.stock.qty_invalid');
    }
    const pj = projectId != null && projectId !== '' ? parseInt(String(projectId), 10) : NaN;
    if (!Number.isFinite(pj) || pj < 1) {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Proje seçimi zorunludur', 'api.stock.project_required');
    }
    const [[prj]] = await conn.query('SELECT id FROM projects WHERE id = ? AND status = ? LIMIT 1', [pj, 'active']);
    if (!prj) {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Proje bulunamadı veya pasif', 'api.stock.project_invalid');
    }
    const sm2 = Number(P.stock_m2) || Number(P.stock_qty) || 0;
    if (sm2 < m2Out - 0.0001) {
      if (ownConn) {
        await conn.rollback();
      }
      return err('Yetersiz stok (m2)', 'api.stock.insufficient_m2');
    }
    let cogs = 0;
    let fifoTaken = null;
    if (await tableExists('stock_cost_layers')) {
      const fifo = await consumeFifoM2ForOut({ conn, productId: pid, qtyM2Out: m2Out, forProjectId: pj });
      if (fifo.error) {
        if (ownConn) {
          await conn.rollback();
        }
        return fifo;
      }
      cogs = fifo.cogsUzs;
      if (Array.isArray(fifo.taken) && fifo.taken.length) {
        fifoTaken = fifo.taken;
      }
    } else {
      cogs = 0;
    }
    const newM2 = sm2 - m2Out;
    const sp = Number(P.stock_pieces) || 0;
    const outPieces = m2p > 0 ? m2Out / m2p : 0;
    const newP = Math.max(0, sp - outPieces);
    const nq = Math.max(0, (Number(P.stock_qty) || 0) - m2Out);
    const depth = Number(P.depth_mm) || 0;
    const newM3 =
      (await columnExists('products', 'stock_m3')) && depth > 0 ? m3FromStockM2AndDepth(newM2, depth) : null;
    if (newM3 != null) {
      await conn.query('UPDATE products SET stock_m2 = ?, stock_pieces = ?, stock_qty = ?, stock_m3 = ? WHERE id = ?', [
        newM2,
        newP,
        nq,
        newM3,
        pid,
      ]);
    } else {
      await conn.query('UPDATE products SET stock_m2 = ?, stock_pieces = ?, stock_qty = ? WHERE id = ?', [
        newM2,
        newP,
        nq,
        pid,
      ]);
    }
    const inCur = String((await getValue(KEYS.CURRENCY)) || 'UZS')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 3) || 'UZS';
    const [ins] = await conn.query(
      `INSERT INTO stock_movements (product_id, user_id, movement_type, qty, qty_pieces, ref_type, ref_id, cogs_uzs_total, input_currency, note)
       VALUES (?,?, 'out', ?, ?, 'project', ?, ?, ?, ?)`,
      [pid, userId, m2Out, outPieces, pj, cogs, inCur, noteRow]
    );
    const newMid = ins.insertId;
    if (fifoTaken && (await columnExists('stock_movements', 'out_fifo_taken'))) {
      await conn.query('UPDATE stock_movements SET out_fifo_taken = ? WHERE id = ?', [JSON.stringify(fifoTaken), newMid]);
    }
    if (ownConn) {
      await conn.commit();
    }
    return { movementId: newMid, newStockM2: String(newM2), cogsUzs: cogs };
  } catch (e) {
    if (ownConn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    throw e;
  } finally {
    if (ownConn) {
      conn.release();
    }
  }
}

async function tableExists(t) {
  const [r] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [t]
  );
  return r[0].c > 0;
}

/** Eski basit in/out (para yok) */
async function recordMovement({ productId, movementType, qty, userId, note, refType, refId }) {
  const type = String(movementType);
  if (type === 'in' && (await columnExists('stock_movements', 'line_total_uzs'))) {
    // yeni yol: body'de finans beklenir — controller ayrı çağırır
    return err('USE_DETAILED_IN', 'api.stock.use_detailed_in');
  }
  if (type === 'out' && (await tableExists('stock_cost_layers')) && (await columnExists('products', 'stock_m2'))) {
    const r = refId != null && refId !== '' ? parseInt(String(refId), 10) : null;
    return recordMovementOut({ productId, userId, note, qtyM2: Number(qty), projectId: r });
  }
  const noteRow = optionalNoteUpperTr(note);
  const pid = parseInt(String(productId), 10);
  const q = Number(qty);
  if (type !== 'in' && type !== 'out') {
    return err('Hareket in veya out', 'api.stock.movement_type_invalid');
  }
  if (!Number.isFinite(q) || q <= 0) {
    return err('Miktar 0’dan büyük olmalı', 'api.stock.qty_positive');
  }
  const poolConn = await pool.getConnection();
  try {
    await poolConn.beginTransaction();
    const [[row]] = await poolConn.query('SELECT id, stock_qty, stock_m2 FROM products WHERE id = ? FOR UPDATE', [pid]);
    if (!row) {
      await poolConn.rollback();
      return err('Ürün yok', 'api.stock.product_not_found');
    }
    const curM2 = Number(row.stock_m2) || Number(row.stock_qty) || 0;
    let newStock;
    if (type === 'in') {
      newStock = curM2 + q;
    } else {
      if (curM2 < q) {
        await poolConn.rollback();
        return err('Yetersiz stok', 'api.stock.insufficient');
      }
      newStock = curM2 - q;
    }
    const qcol = (await columnExists('products', 'stock_m2')) ? 'stock_m2' : 'stock_qty';
    await poolConn.query(`UPDATE products SET ${qcol} = ?, stock_qty = ? WHERE id = ?`, [newStock, newStock, pid]);
    const [ins] = await poolConn.query(
      `INSERT INTO stock_movements (product_id, user_id, movement_type, qty, ref_type, ref_id, note) VALUES (?,?,?,?,?,?,?)`,
      [pid, userId, type, q, refType || 'manual', refId, noteRow]
    );
    await poolConn.commit();
    return { movementId: ins.insertId, newStock: String(newStock) };
  } catch (e) {
    await poolConn.rollback();
    throw e;
  } finally {
    poolConn.release();
  }
}

module.exports = {
  listMovements,
  recordMovement,
  recordMovementIn,
  recordMovementOut,
  columnExists,
  voidStockInMovement,
  voidStockOutMovement,
  replaceStockInMovement,
  replaceStockOutMovement,
};
