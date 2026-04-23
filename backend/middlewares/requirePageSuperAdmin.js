const path = require('path');
const { FRONTEND_PUBLIC } = require('../utils/paths');

/**
 * /admin.html — giriş + süper yönetici; değilse ana ekrana.
 */
function requirePageSuperAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login.html');
  }
  const slug = req.session.user?.role?.slug;
  if (slug !== 'super_admin' && !req.session.user?.isSuperAdmin) {
    return res.redirect('/');
  }
  return next();
}

function sendAdminPage(req, res) {
  return res.sendFile(path.join(FRONTEND_PUBLIC, 'admin.html'));
}

module.exports = { requirePageSuperAdmin, sendAdminPage };
