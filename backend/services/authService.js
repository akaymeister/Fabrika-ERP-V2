const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

/**
 * Giriş için kullanıcıyı (rol bilgisiyle) getirir.
 */
async function findUserWithRoleByUsername(username) {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.is_active,
            r.id AS role_id, r.name AS role_name, r.slug AS role_slug
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.username = :username
     LIMIT 1`,
    { username }
  );
  if (!rows.length) return null;
  return rows[0];
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * API / oturum için "public" kullanıcı nesnesi.
 */
function toSessionUser(row) {
  const isSuperAdmin = row.role_slug === 'super_admin';
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    isSuperAdmin,
    role: {
      id: row.role_id,
      name: row.role_name,
      slug: row.role_slug,
    },
  };
}

/** Son giriş zamanı (opsiyonel) */
async function updateLastLogin(userId) {
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = :id', { id: userId });
}

module.exports = {
  findUserWithRoleByUsername,
  verifyPassword,
  toSessionUser,
  updateLastLogin,
};
