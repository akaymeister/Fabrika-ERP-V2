/**
 * Sadece süper yönetici (rol slug: super_admin) erişir.
 * İstek: session user olmalı (requireAuth ile birlikte).
 */
const { jsonError } = require('../utils/apiResponse');

function requireSuperAdmin(req, res, next) {
  const slug = req.session?.user?.role?.slug;
  if (slug !== 'super_admin' && !req.session?.user?.isSuperAdmin) {
    return res
      .status(403)
      .json(jsonError('FORBIDDEN', 'Bu işlem sadece süper yönetici içindir', null, 'api.admin.super_only'));
  }
  return next();
}

module.exports = { requireSuperAdmin };
