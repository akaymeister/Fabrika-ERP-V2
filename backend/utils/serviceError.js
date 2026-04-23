/**
 * Standart servis hata şekli: Türkçe message + istemcide i18n için messageKey
 * @param {string} turkish
 * @param {string} messageKey örn. api.stock.unit_required
 */
function err(turkish, messageKey) {
  return { error: turkish, messageKey };
}

module.exports = { err };
