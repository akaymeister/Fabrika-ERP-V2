const { err } = require('../utils/serviceError');

/**
 * Katman tüketim sırası: 0) seçili projeye ait giriş, 1) proje dışı / genel (fabrika), 2) diğer projeler (FIFO, layer id)
 */
function layerOutPriority(l, forProjectId) {
  if (!Number.isFinite(forProjectId) || forProjectId < 1) {
    return 0;
  }
  const refT = l.ref_type != null ? String(l.ref_type) : '';
  const refId = l.ref_id != null && l.ref_id !== '' ? Number(l.ref_id) : NaN;
  if (refT === 'project' && Number.isFinite(refId) && refId === forProjectId) {
    return 0;
  }
  if (refT !== 'project' || !Number.isFinite(refId) || refId < 1) {
    return 1;
  }
  return 2;
}

function sortLayersForOut(layers, forProjectId) {
  if (!Number.isFinite(forProjectId) || forProjectId < 1) {
    return [...layers].sort((a, b) => a.id - b.id);
  }
  return [...layers].sort((a, b) => {
    const pa = layerOutPriority(a, forProjectId);
    const pb = layerOutPriority(b, forProjectId);
    if (pa !== pb) {
      return pa - pb;
    }
    return a.id - b.id;
  });
}

/**
 * FIFO: m2 tüket, en eski stok_cost_layers kaydından başla.
 * @returns {{ cogsUzs: number, taken: { layerId, m2, costUzsPerM2 }[] } | { error: string }}
 */
async function consumeFifoM2({ conn, productId, qtyM2Out }) {
  const need = Number(qtyM2Out);
  if (!Number.isFinite(need) || need <= 0) {
    return err('Geçersiz m2', 'api.stock.m2_invalid');
  }

  let left = need;
  let cogsUzs = 0;
  const taken = [];
  const [layers] = await conn.query(
    'SELECT * FROM stock_cost_layers WHERE product_id = ? AND qty_m2_remaining > 0.0001 ORDER BY id ASC FOR UPDATE',
    [productId]
  );

  if (!layers.length) {
    return { cogsUzs: 0, taken: [], noLayers: true };
  }

  for (const L of layers) {
    if (left <= 0) break;
    const rem = Number(L.qty_m2_remaining);
    const take = Math.min(rem, left);
    const partCost = take * Number(L.cost_uzs_per_m2);
    cogsUzs += partCost;
    taken.push({ layerId: L.id, m2: take, costUzsPerM2: L.cost_uzs_per_m2 });
    const newRem = rem - take;
    await conn.query('UPDATE stock_cost_layers SET qty_m2_remaining = ? WHERE id = ?', [newRem, L.id]);
    left -= take;
  }

  if (left > 0.0001) {
    return err('Yetersiz stok (katman / FIFO)', 'api.stock.fifo_insufficient');
  }
  return { cogsUzs, taken, noLayers: false };
}

/**
 * Çıkış: önce seçili projeye projelenmiş stok, sonra proje dışı (ref yok / manual vb.), sonra diğer projeler; her seviyede FIFO (layer id)
 */
async function consumeFifoM2ForOut({ conn, productId, qtyM2Out, forProjectId }) {
  const need = Number(qtyM2Out);
  if (!Number.isFinite(need) || need <= 0) {
    return err('Geçersiz m2', 'api.stock.m2_invalid');
  }
  const pj = Number(forProjectId);
  if (!Number.isFinite(pj) || pj < 1) {
    return consumeFifoM2({ conn, productId, qtyM2Out });
  }
  const [rows] = await conn.query(
    `SELECT l.id, l.product_id, l.movement_in_id, l.qty_m2_remaining, l.cost_uzs_per_m2,
            sm.ref_type, sm.ref_id
     FROM stock_cost_layers l
     INNER JOIN stock_movements sm ON sm.id = l.movement_in_id AND sm.movement_type = 'in'
     WHERE l.product_id = ? AND l.qty_m2_remaining > 0.0001
     FOR UPDATE`,
    [productId]
  );
  if (!rows.length) {
    return { cogsUzs: 0, taken: [], noLayers: true };
  }
  const sorted = sortLayersForOut(rows, pj);
  let left = need;
  let cogsUzs = 0;
  const taken = [];
  for (const L of sorted) {
    if (left <= 0.0001) break;
    const rem = Number(L.qty_m2_remaining);
    const take = Math.min(rem, left);
    const partCost = take * Number(L.cost_uzs_per_m2);
    cogsUzs += partCost;
    taken.push({ layerId: L.id, m2: take, costUzsPerM2: L.cost_uzs_per_m2 });
    const newRem = rem - take;
    await conn.query('UPDATE stock_cost_layers SET qty_m2_remaining = ? WHERE id = ?', [newRem, L.id]);
    left -= take;
  }
  if (left > 0.0001) {
    return err('Yetersiz stok (katman / FIFO)', 'api.stock.fifo_insufficient');
  }
  return { cogsUzs, taken, noLayers: false };
}

/**
 * Giriş partisi: hareket kaydı zaten eklendikten sonra id ile çağrılabilir veya aynı transaction içinde.
 */
async function addLayer(conn, { productId, movementInId, qtyM2, costUzsPerM2, costUsdPerM2, inputCurrency, fxUzsPerUsd }) {
  await conn.query(
    `INSERT INTO stock_cost_layers
     (product_id, movement_in_id, qty_m2_remaining, cost_uzs_per_m2, cost_usd_per_m2, input_currency, fx_uzs_per_usd)
     VALUES (?,?,?,?,?,?,?)`,
    [
      productId,
      movementInId,
      qtyM2,
      costUzsPerM2,
      costUsdPerM2 != null ? costUsdPerM2 : null,
      inputCurrency || 'UZS',
      fxUzsPerUsd != null ? fxUzsPerUsd : null,
    ]
  );
}

module.exports = { consumeFifoM2, consumeFifoM2ForOut, addLayer };
