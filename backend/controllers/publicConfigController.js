const { getValue, KEYS } = require('../services/systemSettingsService');
const { jsonOk } = require('../utils/apiResponse');

async function getPublicConfig(req, res) {
  const defaultCurrency = (await getValue(KEYS.CURRENCY)) || 'UZS';
  const defaultLocale = (await getValue(KEYS.LOCALE)) || 'tr';
  return res.json(
    jsonOk({
      defaultCurrency,
      defaultLocale,
      supportedLocales: ['tr', 'uz', 'ru', 'en'],
    })
  );
}

module.exports = { getPublicConfig };
