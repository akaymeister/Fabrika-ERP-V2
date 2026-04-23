const path = require('path');
const { userHasPermission, userHasAnyPermission } = require('../services/accessService');
const { FRONTEND_PUBLIC } = require('../utils/paths');

/**
 * HTML sayfaları: yetki yok → ana sayfaya.
 */
function requirePagePermission(permKey) {
  return async (req, res, next) => {
    if (!req.session?.user) {
      return res.redirect('/login.html');
    }
    const u = req.session.user;
    const ok = await userHasPermission(u.id, u.role?.slug, permKey);
    if (!ok) {
      return res.redirect('/?err=forbidden');
    }
    return next();
  };
}

/** @param {string[]} permKeys en az biri yeterli */
function requirePageAnyPermission(permKeys) {
  return async (req, res, next) => {
    if (!req.session?.user) {
      return res.redirect('/login.html');
    }
    const u = req.session.user;
    const ok = await userHasAnyPermission(u.id, u.role?.slug, permKeys);
    if (!ok) {
      return res.redirect('/?err=forbidden');
    }
    return next();
  };
}

function sendPage(filename) {
  return (req, res) => res.sendFile(path.join(FRONTEND_PUBLIC, filename));
}

module.exports = { requirePagePermission, requirePageAnyPermission, sendPage };
