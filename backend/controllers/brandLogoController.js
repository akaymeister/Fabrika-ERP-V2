/**
 * Marka / firma logosu yönetimi (yalnızca süper yönetici).
 * Dosyalar `uploads/brand/` altına kaydedilir; URL `/uploads/brand/<file>` olarak
 * `system_settings.brand_logo_url` anahtarında saklanır. Yeni yükleme yapıldığında
 * eski dosya silinir; silme isteğinde de fiziksel dosya kaldırılır.
 */
const fs = require('fs');
const path = require('path');
const { getValue, setValue, KEYS } = require('../services/systemSettingsService');
const { jsonOk, jsonError } = require('../utils/apiResponse');
const { UPLOADS_ROOT } = require('../utils/paths');

function urlToFsPath(urlPath) {
  if (!urlPath || typeof urlPath !== 'string') return null;
  const m = urlPath.match(/^\/uploads\/brand\/([A-Za-z0-9._-]+)$/);
  if (!m) return null;
  return path.join(UPLOADS_ROOT, 'brand', m[1]);
}

function safeUnlink(absPath) {
  if (!absPath) return;
  try {
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch (_) {
    /* yut: temizleme hatası yükleme akışını engellemesin */
  }
}

async function getBrandLogo(_req, res) {
  const url = (await getValue(KEYS.BRAND_LOGO_URL)) || '';
  return res.json(jsonOk({ logoUrl: url }));
}

async function postBrandLogo(req, res) {
  if (!req.file) {
    return res
      .status(400)
      .json(jsonError('VALIDATION', 'Logo dosyası bulunamadı', null, 'api.admin.brand_logo_required'));
  }
  const previous = (await getValue(KEYS.BRAND_LOGO_URL)) || '';
  const newUrl = `/uploads/brand/${req.file.filename}`;
  await setValue(KEYS.BRAND_LOGO_URL, newUrl);
  if (previous && previous !== newUrl) {
    safeUnlink(urlToFsPath(previous));
  }
  return res.json(jsonOk({ logoUrl: newUrl }));
}

async function deleteBrandLogo(_req, res) {
  const previous = (await getValue(KEYS.BRAND_LOGO_URL)) || '';
  if (previous) {
    safeUnlink(urlToFsPath(previous));
    await setValue(KEYS.BRAND_LOGO_URL, '');
  }
  return res.json(jsonOk({ logoUrl: '' }));
}

module.exports = { getBrandLogo, postBrandLogo, deleteBrandLogo };
