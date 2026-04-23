const path = require('path');
const { FRONTEND_PUBLIC } = require('../utils/paths');

/**
 * HTML sayfaları (dashboard) için: oturum yoksa login sayfasına yönlendirir.
 */
function requirePageAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/login.html');
}

/**
 * Login sayfası: oturum varsa dashboard'a; yoksa login.html.
 */
function serveLoginOrRedirectToDashboard(req, res) {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  return res.sendFile(path.join(FRONTEND_PUBLIC, 'login.html'));
}

module.exports = { requirePageAuth, serveLoginOrRedirectToDashboard };
