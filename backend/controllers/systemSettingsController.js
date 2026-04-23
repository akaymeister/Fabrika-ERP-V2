const { getAll, setValue, KEYS } = require('../services/systemSettingsService');
const { jsonOk, jsonError } = require('../utils/apiResponse');
const { normalizeProjectCodePrefix } = require('../utils/projectCodeFormat');

async function getSettings(req, res) {
  const all = await getAll();
  return res.json(jsonOk({ settings: all, defaultCurrency: all[KEYS.CURRENCY] || 'UZS' }));
}

/**
 * Sadece süper yönetici — sistem para birimi ve varsayılan dil
 */
async function putSettings(req, res) {
  const { defaultCurrency, defaultLocale, projectCodePrefix } = req.body;
  if (defaultCurrency != null) {
    const c = String(defaultCurrency).trim().toUpperCase();
    if (c.length < 2 || c.length > 5) {
      return res.status(400).json(jsonError('VALIDATION', 'Geçersiz para birimi', null, 'api.settings.invalid_currency'));
    }
    await setValue(KEYS.CURRENCY, c);
  }
  if (defaultLocale != null) {
    const l = String(defaultLocale).trim().toLowerCase();
    if (!['tr', 'en', 'ru', 'uz'].includes(l)) {
      return res.status(400).json(jsonError('VALIDATION', 'Dil: tr, en, ru, uz', null, 'api.settings.invalid_locale'));
    }
    await setValue(KEYS.LOCALE, l);
  }
  if (projectCodePrefix != null && projectCodePrefix !== undefined) {
    const raw = String(projectCodePrefix).trim();
    const p = raw === '' ? 'PRJ' : normalizeProjectCodePrefix(raw);
    if (!p) {
      return res
        .status(400)
        .json(
          jsonError('VALIDATION', 'Proje kodu öneki geçersiz (2-16, A–Z, 0–9, tire)', null, 'api.settings.invalid_project_prefix')
        );
    }
    await setValue(KEYS.PROJECT_CODE_PREFIX, p);
  }
  const all = await getAll();
  return res.json(jsonOk({ settings: all }));
}

module.exports = { getSettings, putSettings };
