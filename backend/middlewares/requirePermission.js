const { userHasPermission, userHasAnyPermission } = require('../services/accessService');
const { jsonError } = require('../utils/apiResponse');

/**
 * @param {string} permKey permissions.perm_key
 */
function requirePermission(permKey) {
  return async (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json(jsonError('UNAUTHORIZED', 'Oturum gerekli', null, 'api.permission.session'));
    }
    const u = req.session.user;
    const ok = await userHasPermission(u.id, u.role?.slug, permKey);
    if (!ok) {
      return res.status(403).json(jsonError('FORBIDDEN', 'Bu işlem için yetkiniz yok', null, 'api.permission.denied'));
    }
    return next();
  };
}

/** @param {string[]} permKeys */
function requireAnyPermission(permKeys) {
  return async (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json(jsonError('UNAUTHORIZED', 'Oturum gerekli', null, 'api.permission.session'));
    }
    const u = req.session.user;
    const ok = await userHasAnyPermission(u.id, u.role?.slug, permKeys);
    if (!ok) {
      return res.status(403).json(jsonError('FORBIDDEN', 'Bu işlem için yetkiniz yok', null, 'api.permission.denied'));
    }
    return next();
  };
}

module.exports = { requirePermission, requireAnyPermission };
