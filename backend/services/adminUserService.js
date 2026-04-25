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
            r.id AS role_id, r.name AS role_name, r.slug AS role_slug,
            e.id AS employee_id, e.position_id AS employee_position_id, p.name AS employee_position_name
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN employees e ON e.user_id = u.id
     LEFT JOIN positions p ON p.id = e.position_id
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

async function getSystemRoleBySlug(slug) {
  const [rows] = await pool.query(
    `SELECT id, slug, name
     FROM roles
     WHERE slug = :slug
     LIMIT 1`,
    { slug }
  );
  return rows[0] || null;
}

async function setUserPermissionSubject(userId, subjectType, subjectId, { actingUserId }) {
  const uid = parseInt(String(userId), 10);
  const sid = parseInt(String(subjectId), 10);
  if (!Number.isFinite(uid) || uid < 1) return err('Geçersiz kullanıcı', 'api.admin.user_invalid');
  if (!Number.isFinite(sid) || sid < 1) return err('Geçersiz yetki konusu', 'api.admin.invalid_permission_subject');

  const [users] = await pool.query(
    `SELECT u.id, u.role_id, r.slug AS role_slug, e.id AS employee_id
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.id = :id
     LIMIT 1`,
    { id: uid }
  );
  if (!users.length) return err('Kullanıcı yok', 'api.admin.user_not_found');
  const user = users[0];

  if (subjectType === 'system_role') {
    const [roles] = await pool.query(
      `SELECT id, slug
       FROM roles
       WHERE id = :id
         AND slug IN ('super_admin', 'admin')
       LIMIT 1`,
      { id: sid }
    );
    if (!roles.length) return err('Sadece Super Admin veya Admin atanabilir', 'api.admin.system_role_only');

    const toRole = roles[0];
    if (uid === actingUserId && user.role_slug === SUPER_SLUG && toRole.slug !== SUPER_SLUG) {
      return err('Kendi süper yönetici rolünüzü kaldıramazsınız', 'api.admin.cannot_downgrade_self_super');
    }
    if (user.role_slug === SUPER_SLUG && toRole.slug !== SUPER_SLUG) {
      const n = await countActiveSuperAdmins();
      if (n <= 1) {
        return err('Son aktif süper yönetici rolü kaldırılamaz', 'api.admin.last_super_role');
      }
    }
    await pool.query('UPDATE users SET role_id = :role_id WHERE id = :id', { role_id: toRole.id, id: uid });
    return { ok: true };
  }

  if (subjectType === 'hr_position') {
    const [positions] = await pool.query(
      `SELECT id
       FROM positions
       WHERE id = :id AND is_active = 1
       LIMIT 1`,
      { id: sid }
    );
    if (!positions.length) return err('Pozisyon bulunamadı', 'api.hr.position_not_found');
    if (!user.employee_id) {
      return err('Önce bu kullanıcıyı bir personel kartına bağlayın.', 'api.admin.user_employee_link_required');
    }
    await pool.query('UPDATE employees SET position_id = :position_id WHERE id = :employee_id', {
      position_id: sid,
      employee_id: user.employee_id,
    });
    const adminRole = await getSystemRoleBySlug('admin');
    if (adminRole && user.role_id !== adminRole.id) {
      // Operasyonel yetki artık pozisyondan okunacağı için sistem rolünü admin seviyesine sabitle.
      await pool.query('UPDATE users SET role_id = :role_id WHERE id = :id', { role_id: adminRole.id, id: uid });
    }
    return { ok: true };
  }

  return err('Geçersiz yetki konusu', 'api.admin.invalid_permission_subject');
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
  setUserPermissionSubject,
  resetPassword,
  SUPER_SLUG,
};
