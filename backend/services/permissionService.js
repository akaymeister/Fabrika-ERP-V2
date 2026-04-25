const { pool } = require('../config/database');

async function listAllPermissions() {
  const [rows] = await pool.query(
    'SELECT id, perm_key, name, description FROM permissions ORDER BY perm_key'
  );
  return rows;
}

async function getRolePermissionIds(roleId) {
  const [rows] = await pool.query(
    'SELECT permission_id FROM role_permissions WHERE role_id = :roleId',
    { roleId }
  );
  return rows.map((r) => r.permission_id);
}

async function getPositionPermissionIds(positionId) {
  const [rows] = await pool.query(
    'SELECT permission_id FROM position_permissions WHERE position_id = :positionId',
    { positionId }
  );
  return rows.map((r) => r.permission_id);
}

/**
 * rolün izin setini değiştirir (tam liste).
 */
async function setRolePermissionIds(roleId, permissionIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    for (const pid of permissionIds) {
      const n = parseInt(String(pid), 10);
      if (!Number.isFinite(n) || n < 1) continue;
      await conn.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
        roleId,
        n,
      ]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function setPositionPermissionIds(positionId, permissionIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM position_permissions WHERE position_id = ?', [positionId]);
    for (const pid of permissionIds) {
      const n = parseInt(String(pid), 10);
      if (!Number.isFinite(n) || n < 1) continue;
      await conn.query(
        'INSERT IGNORE INTO position_permissions (position_id, permission_id) VALUES (?, ?)',
        [positionId, n]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getUserExtraPermissionIds(userId) {
  const [rows] = await pool.query(
    'SELECT permission_id FROM user_permissions WHERE user_id = :userId',
    { userId }
  );
  return rows.map((r) => r.permission_id);
}

/**
 * Kullanıcıya ek (rol üstü) izin seti; tam liste.
 */
async function setUserExtraPermissionIds(userId, permissionIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
    for (const pid of permissionIds) {
      const n = parseInt(String(pid), 10);
      if (!Number.isFinite(n) || n < 1) continue;
      await conn.query('INSERT IGNORE INTO user_permissions (user_id, permission_id) VALUES (?, ?)', [
        userId,
        n,
      ]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listPermissionSubjects() {
  const [systemRoles] = await pool.query(
    `SELECT id, name, slug
     FROM roles
     WHERE slug IN ('super_admin', 'admin')
     ORDER BY FIELD(slug, 'super_admin', 'admin'), name`
  );
  const [hrPositions] = await pool.query(
    `SELECT id, name, code, is_active
     FROM positions
     WHERE is_active = 1
     ORDER BY name ASC`
  );
  return [
    ...systemRoles.map((r) => ({ type: 'system_role', id: r.id, name: r.name, code: r.slug })),
    ...hrPositions.map((p) => ({ type: 'hr_position', id: p.id, name: p.name, code: p.code || null })),
  ];
}

async function getPermissionIdsBySubject(subjectType, subjectId) {
  if (subjectType === 'system_role') return getRolePermissionIds(subjectId);
  if (subjectType === 'hr_position') return getPositionPermissionIds(subjectId);
  return [];
}

async function setPermissionIdsBySubject(subjectType, subjectId, permissionIds) {
  if (subjectType === 'system_role') {
    await setRolePermissionIds(subjectId, permissionIds);
    return;
  }
  if (subjectType === 'hr_position') {
    await setPositionPermissionIds(subjectId, permissionIds);
    return;
  }
  throw new Error('INVALID_SUBJECT_TYPE');
}

module.exports = {
  listAllPermissions,
  getRolePermissionIds,
  setRolePermissionIds,
  getPositionPermissionIds,
  setPositionPermissionIds,
  listPermissionSubjects,
  getPermissionIdsBySubject,
  setPermissionIdsBySubject,
  getUserExtraPermissionIds,
  setUserExtraPermissionIds,
};
