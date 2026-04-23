const { pool } = require('../config/database');

const KEYS = {
  CURRENCY: 'default_currency',
  LOCALE: 'default_locale',
  /** Proje kodu otomatik üretim: örn. PRJ → PRJ-26-001 (yy + yıl içi sıra) */
  PROJECT_CODE_PREFIX: 'project_code_prefix',
};

async function getAll() {
  const [rows] = await pool.query('SELECT setting_key, setting_value FROM system_settings');
  const o = {};
  for (const r of rows) {
    o[r.setting_key] = r.setting_value;
  }
  return o;
}

async function getValue(key) {
  const [rows] = await pool.query('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
  return rows[0]?.setting_value ?? null;
}

async function setValue(key, value) {
  await pool.query(
    'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()',
    [key, String(value)]
  );
}

/** Genel: USD → sistem para (UZS) */
function usdToSystemAmount(usd, fxUzsPerUsd) {
  const u = Number(usd);
  const fx = Number(fxUzsPerUsd);
  if (!Number.isFinite(u) || !Number.isFinite(fx) || fx <= 0) return 0;
  return u * fx;
}

module.exports = {
  KEYS,
  getAll,
  getValue,
  setValue,
  usdToSystemAmount,
};
