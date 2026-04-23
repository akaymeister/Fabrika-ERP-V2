const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { toUpperTr } = require('../utils/textNormalize');

const SUPER_SLUG = 'super_admin';

async function countActiveSuperAdmins() {
  const [[r]] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.is_active = 1 AND r.slug = ?`,
    [SUPER_SLUG]
  );
  return Number(r.c) || 0;
}

async function getRoleIdById(roleId) {
  const [rows] = await pool.query('SELECT id, slug, name FROM roles WHERE id = :id', { id: roleId });
  return rows[0] || null;
}

async function listUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login_at, u.created_at,
            r.id AS role_id, r.name AS role_name, r.slug AS role_slug
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     ORDER BY u.id ASC`
  );
  return rows;
}

function pickCreatePayload(body) {
  return {
    username: String(body?.username || '').trim(),
    full_name: String(body?.full_name || '').trim(),
    email: body?.email == null || body?.email === '' ? null : String(body.email).trim(),
    role_id: parseInt(String(body?.role_id), 10),
    password: String(body?.password || ''),
  };
}

function pickUpdatePayload(body) {
  const o = {};
  if (body.full_name != null) o.full_name = String(body.full_name).trim();
  if (body.email !== undefined) o.email = body.email == null || body.email === '' ? null : String(body.email).trim();
  if (body.role_id != null) o.role_id = parseInt(String(body.role_id), 10);
  if (body.is_active != null) o.is_active = body.is_active ? 1 : 0;
  return o;
}

/**
 * @returns {{ userId: number } | { error: string }}
 */
async function createUser(input) {
  if (!input.username || input.username.length < 2) {
    return err('Kullanıcı adı en az 2 karakter', 'api.admin.username_short');
  }
  if (!input.full_name) {
    return err('Ad soyad gerekli', 'api.admin.full_name_required');
  }
  if (!input.password || input.password.length < 4) {
    return err('Şifre en az 4 karakter', 'api.admin.password_short');
  }
  if (!Number.isFinite(input.role_id) || input.role_id < 1) {
    return err('Geçerli bir rol seçin', 'api.admin.role_invalid');
  }

  const role = await getRoleIdById(input.role_id);
  if (!role) {
    return err('Rol bulunamadı', 'api.admin.role_not_found');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const [r] = await pool.query(
    'INSERT INTO users (username, email, password_hash, full_name, role_id) VALUES (?,?,?,?,?)',
    [input.username, input.email, passwordHash, toUpperTr(input.full_name), input.role_id]
  );
  return { userId: r.insertId };
}

/**
 * @returns {{ ok: true } | { error: string }}
 */
async function updateUser(userId, payload, { actingUserId }) {
  if (!userId || userId < 1) {
    return err('Geçersiz kullanıcı', 'api.admin.user_invalid');
  }

  const [users] = await pool.query('SELECT u.id, u.role_id, r.slug AS role_slug FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = :id', {
    id: userId,
  });
  if (!users.length) {
    return err('Kullanıcı yok', 'api.admin.user_not_found');
  }
  const before = users[0];

  if (payload.role_id != null) {
    const toRole = await getRoleIdById(payload.role_id);
    if (!toRole) {
      return err('Rol yok', 'api.admin.role_missing');
    }
    if (before.role_slug === SUPER_SLUG && toRole.slug !== SUPER_SLUG) {
      const n = await countActiveSuperAdmins();
      if (n <= 1) {
        return err('Son aktif süper yönetici rolü kaldırılamaz', 'api.admin.last_super_role');
      }
    }
  }

  if (payload.is_active === 0 && before.id === actingUserId) {
    return err('Kendi hesabınızı pasif yapamazsınız', 'api.admin.cannot_deactivate_self');
  }
  if (payload.is_active === 0 && before.role_slug === SUPER_SLUG) {
    const n = await countActiveSuperAdmins();
    if (n <= 1) {
      return err('Son aktif süper yönetici kapatılamaz', 'api.admin.last_super_active');
    }
  }

  const fields = [];
  const values = { id: userId };
  if (payload.full_name != null) {
    fields.push('full_name = :full_name');
    values.full_name = toUpperTr(payload.full_name);
  }
  if (payload.email !== undefined) {
    fields.push('email = :email');
    values.email = payload.email;
  }
  if (payload.role_id != null) {
    fields.push('role_id = :role_id');
    values.role_id = payload.role_id;
  }
  if (payload.is_active != null) {
    fields.push('is_active = :is_active');
    values.is_active = payload.is_active;
  }

  if (!fields.length) {
    return err('Güncellenecek alan yok', 'api.admin.nothing_to_update');
  }

  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = :id`, values);
  return { ok: true };
}

async function resetPassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 4) {
    return err('Yeni şifre en az 4 karakter', 'api.admin.new_password_short');
  }
  const hash = await bcrypt.hash(newPassword, 10);
  const [r] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
  if (!r.affectedRows) {
    return err('Kullanıcı yok', 'api.admin.user_not_found');
  }
  return { ok: true };
}

module.exports = {
  countActiveSuperAdmins,
  getRoleIdById,
  listUsers,
  pickCreatePayload,
  pickUpdatePayload,
  createUser,
  updateUser,
  resetPassword,
  SUPER_SLUG,
};
