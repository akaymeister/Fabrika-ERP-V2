const {
  listUsers,
  pickCreatePayload,
  pickUpdatePayload,
  createUser,
  updateUser,
  resetPassword,
} = require('../services/adminUserService');
const {
  getPermissionIdsBySubject,
  setPermissionIdsBySubject,
  getUserExtraPermissionIds,
  setUserExtraPermissionIds,
  listAllPermissions,
  listPermissionSubjects,
} = require('../services/permissionService');
const { jsonOk, jsonError } = require('../utils/apiResponse');
const { pool } = require('../config/database');

async function getRolesList(req, res) {
  const [rows] = await pool.query('SELECT id, name, slug, created_at FROM roles ORDER BY name');
  return res.json(jsonOk({ roles: rows }));
}

async function getPermissionCatalog(req, res) {
  const perms = await listAllPermissions();
  return res.json(jsonOk({ permissions: perms }));
}

async function getRolePermissionsById(req, res) {
  const roleId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(roleId)) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz rol id', null, 'api.admin.invalid_role_id'));
  }
  const [roles] = await pool.query('SELECT id, name, slug FROM roles WHERE id = ?', [roleId]);
  if (!roles.length) {
    return res.status(404).json(jsonError('NOT_FOUND', 'Rol yok', null, 'api.admin.role_not_found'));
  }
  const ids = await getRolePermissionIds(roleId);
  return res.json(jsonOk({ role: roles[0], permissionIds: ids }));
}

async function putRolePermissionsById(req, res) {
  const roleId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(roleId)) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz rol id', null, 'api.admin.invalid_role_id'));
  }
  const [roles] = await pool.query('SELECT id, slug FROM roles WHERE id = ?', [roleId]);
  if (!roles.length) {
    return res.status(404).json(jsonError('NOT_FOUND', 'Rol yok', null, 'api.admin.role_not_found'));
  }
  const raw = req.body?.permissionIds;
  const list = Array.isArray(raw) ? raw.map((x) => parseInt(String(x), 10)).filter((n) => n > 0) : [];
  try {
    await setRolePermissionIds(roleId, list);
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(jsonError('MIGRATION', 'Yetki tabloları yok: npm run db:migrate', null, 'api.admin.migration_permissions'));
    }
    throw e;
  }
  return res.json(jsonOk());
}

function parseSubjectType(typeRaw) {
  const type = String(typeRaw || '').trim();
  if (type === 'system_role' || type === 'hr_position') return type;
  return null;
}

async function getPermissionSubjects(_req, res) {
  const subjects = await listPermissionSubjects();
  return res.json(jsonOk({ subjects }));
}

async function getPermissionSubjectPermissions(req, res) {
  const type = parseSubjectType(req.params.type);
  const id = parseInt(String(req.params.id), 10);
  if (!type || !Number.isFinite(id) || id < 1) {
    return res.status(400).json(jsonError('VALIDATION', 'Gecersiz yetki konusu', null, 'api.admin.invalid_permission_subject'));
  }

  if (type === 'system_role') {
    const [rows] = await pool.query('SELECT id, name, slug FROM roles WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json(jsonError('NOT_FOUND', 'Rol yok', null, 'api.admin.role_not_found'));
    }
  } else {
    const [rows] = await pool.query('SELECT id, name, code FROM positions WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json(jsonError('NOT_FOUND', 'Pozisyon yok', null, 'api.hr.position_not_found'));
    }
  }

  const permissionIds = await getPermissionIdsBySubject(type, id);
  return res.json(jsonOk({ permissionIds }));
}

async function putPermissionSubjectPermissions(req, res) {
  const type = parseSubjectType(req.params.type);
  const id = parseInt(String(req.params.id), 10);
  if (!type || !Number.isFinite(id) || id < 1) {
    return res.status(400).json(jsonError('VALIDATION', 'Gecersiz yetki konusu', null, 'api.admin.invalid_permission_subject'));
  }

  if (type === 'system_role') {
    const [rows] = await pool.query('SELECT id, slug FROM roles WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json(jsonError('NOT_FOUND', 'Rol yok', null, 'api.admin.role_not_found'));
    }
  } else {
    const [rows] = await pool.query('SELECT id FROM positions WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) {
      return res.status(404).json(jsonError('NOT_FOUND', 'Pozisyon yok', null, 'api.hr.position_not_found'));
    }
  }

  const raw = req.body?.permissionIds;
  const list = Array.isArray(raw) ? raw.map((x) => parseInt(String(x), 10)).filter((n) => n > 0) : [];
  try {
    await setPermissionIdsBySubject(type, id, list);
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res
        .status(500)
        .json(jsonError('MIGRATION', 'Yetki tabloları yok: npm run db:migrate', null, 'api.admin.migration_permissions'));
    }
    if (e.message === 'INVALID_SUBJECT_TYPE') {
      return res
        .status(400)
        .json(jsonError('VALIDATION', 'Gecersiz yetki konusu', null, 'api.admin.invalid_permission_subject'));
    }
    throw e;
  }
  return res.json(jsonOk());
}

async function getUserExtraPerms(req, res) {
  const userId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(userId)) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.admin.invalid_id'));
  }
  const [users] = await pool.query('SELECT id, username FROM users WHERE id = ?', [userId]);
  if (!users.length) {
    return res.status(404).json(jsonError('NOT_FOUND', 'Kullanıcı yok', null, 'api.admin.user_not_found'));
  }
  const permissionIds = await getUserExtraPermissionIds(userId);
  return res.json(jsonOk({ user: users[0], permissionIds }));
}

async function putUserExtraPerms(req, res) {
  const userId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(userId)) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.admin.invalid_id'));
  }
  const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
  if (!users.length) {
    return res.status(404).json(jsonError('NOT_FOUND', 'Kullanıcı yok', null, 'api.admin.user_not_found'));
  }
  const raw = req.body?.permissionIds;
  const list = Array.isArray(raw) ? raw.map((x) => parseInt(String(x), 10)).filter((n) => n > 0) : [];
  try {
    await setUserExtraPermissionIds(userId, list);
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json(jsonError('MIGRATION', 'Yetki tabloları yok: npm run db:migrate', null, 'api.admin.migration_permissions'));
    }
    throw e;
  }
  return res.json(jsonOk());
}

async function getUsersList(req, res) {
  const users = await listUsers();
  return res.json(jsonOk({ users }));
}

async function postUser(req, res) {
  const input = pickCreatePayload(req.body);
  try {
    const result = await createUser(input);
    if (result.error) {
      return res.status(400).json(jsonError('VALIDATION', result.error, null, result.messageKey));
    }
    return res.status(201).json(jsonOk({ id: result.userId }));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(jsonError('VALIDATION', 'Bu kullanıcı adı zaten var', null, 'api.admin.username_taken'));
    }
    throw e;
  }
}

async function patchUser(req, res) {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.admin.invalid_id'));
  }
  const payload = pickUpdatePayload(req.body);
  if (Object.keys(payload).length === 0) {
    return res.status(400).json(jsonError('VALIDATION', 'Güncellenecek alan yok', null, 'api.admin.nothing_to_update'));
  }
  const out = await updateUser(id, payload, { actingUserId: req.session.user.id });
  if (out.error) {
    return res.status(400).json(jsonError('VALIDATION', out.error, null, out.messageKey));
  }
  return res.json(jsonOk());
}

async function postResetPassword(req, res) {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.admin.invalid_id'));
  }
  const newPassword = String(req.body?.newPassword || '');
  const out = await resetPassword(id, newPassword);
  if (out.error) {
    return res.status(400).json(jsonError('VALIDATION', out.error, null, out.messageKey));
  }
  return res.json(jsonOk());
}

module.exports = {
  getRolesList,
  getPermissionCatalog,
  getRolePermissionsById,
  putRolePermissionsById,
  getPermissionSubjects,
  getPermissionSubjectPermissions,
  putPermissionSubjectPermissions,
  getUserExtraPerms,
  putUserExtraPerms,
  getUsersList,
  postUser,
  patchUser,
  postResetPassword,
};
