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

module.exports = {
  listAllPermissions,
  getRolePermissionIds,
  setRolePermissionIds,
  getUserExtraPermissionIds,
  setUserExtraPermissionIds,
};
