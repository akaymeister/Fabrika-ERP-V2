const { jsonError } = require('../utils/apiResponse');

/**
 * API rotaları için: oturum yoksa 401 JSON döner.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json(jsonError('UNAUTHORIZED', 'Oturum gerekli', null, 'api.permission.session'));
  }
  return next();
}

module.exports = { requireAuth };
