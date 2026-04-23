const {
  findUserWithRoleByUsername,
  verifyPassword,
  toSessionUser,
  updateLastLogin,
} = require('../services/authService');
const { jsonOk, jsonError } = require('../utils/apiResponse');

async function postLogin(req, res) {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json(jsonError('VALIDATION', 'Kullanıcı adı ve şifre gerekli', null, 'api.auth.credentials_required'));
  }

  const row = await findUserWithRoleByUsername(username);
  if (!row || !row.is_active) {
    return res.status(401).json(jsonError('AUTH_FAILED', 'Kullanıcı adı veya şifre hatalı', null, 'api.auth.failed'));
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    return res.status(401).json(jsonError('AUTH_FAILED', 'Kullanıcı adı veya şifre hatalı', null, 'api.auth.failed'));
  }

  const user = toSessionUser(row);
  req.session.user = user;
  try {
    await updateLastLogin(user.id);
  } catch (e) {
    // last_login kritik değil
  }

  return res.json(jsonOk({ user }));
}

function postLogout(req, res) {
  if (!req.session) {
    return res.json(jsonOk());
  }
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json(jsonError('SESSION', 'Oturum kapatılamadı', null, 'api.session.destroy_failed'));
    }
    return res.json(jsonOk());
  });
}

function getMe(req, res) {
  if (!req.session?.user) {
    return res.status(401).json(jsonError('UNAUTHORIZED', 'Oturum yok', null, 'api.session.required'));
  }
  return res.json(jsonOk({ user: req.session.user }));
}

module.exports = { postLogin, postLogout, getMe };
