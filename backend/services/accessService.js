const { pool } = require('../config/database');

/**
 * Rol + (isteğe) kullanıcı ek izinleri. Süper yönetici her şeye yazar.
 */
async function userHasPermission(userId, roleSlug, permKey) {
  if (!userId || !permKey) return false;
  if (roleSlug === 'super_admin') return true;

  const [[p]] = await pool.query('SELECT id FROM permissions WHERE perm_key = ? LIMIT 1', [permKey]);
  if (!p) return false;

  const [fromRole] = await pool.query(
    `SELECT 1 AS ok
     FROM users u
     INNER JOIN role_permissions rp ON rp.role_id = u.role_id
     WHERE u.id = ? AND rp.permission_id = ?
     LIMIT 1`,
    [userId, p.id]
  );
  if (fromRole.length) return true;

  const [fromPosition] = await pool.query(
    `SELECT 1 AS ok
     FROM users u
     INNER JOIN employees e ON e.user_id = u.id
     INNER JOIN position_permissions pp ON pp.position_id = e.position_id
     WHERE u.id = ? AND pp.permission_id = ?
     LIMIT 1`,
    [userId, p.id]
  );
  if (fromPosition.length) return true;

  const [fromUser] = await pool.query(
    'SELECT 1 AS ok FROM user_permissions WHERE user_id = ? AND permission_id = ? LIMIT 1',
    [userId, p.id]
  );
  return fromUser.length > 0;
}

/** permKeys içinden en az biri yeterli (süper yönetici tümü) */
async function userHasAnyPermission(userId, roleSlug, permKeys) {
  if (!userId || !Array.isArray(permKeys) || !permKeys.length) return false;
  if (roleSlug === 'super_admin') return true;
  for (const k of permKeys) {
    // eslint-disable-next-line no-await-in-loop
    if (await userHasPermission(userId, roleSlug, k)) return true;
  }
  return false;
}

module.exports = { userHasPermission, userHasAnyPermission };
