const {
  findUserWithRoleByUsername,
  verifyPassword,
  toSessionUser,
  updateLastLogin,
} = require('../services/authService');
const { jsonOk, jsonError } = require('../utils/apiResponse');
const { logActivity } = require('../services/activityLogService');

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

  await logActivity(req, {
    action_type: 'LOGIN',
    module_name: 'auth',
    table_name: 'users',
    record_id: user.id,
    new_data: { id: user.id, username: user.username, role: user.role?.slug },
    description: 'Oturum açma',
    actor: { userId: user.id, username: user.username, fullName: user.fullName },
  });

  return res.json(jsonOk({ user }));
}

async function postLogout(req, res) {
  const u = req.session?.user;
  if (u) {
    await logActivity(req, {
      action_type: 'LOGOUT',
      module_name: 'auth',
      table_name: 'users',
      record_id: u.id,
      description: 'Oturum kapatma',
      actor: { userId: u.id, username: u.username, fullName: u.fullName },
    });
  }
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
