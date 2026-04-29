const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

async function getMyProfile(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id < 1) return null;

  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.full_name, u.last_login_at, u.is_active, u.must_change_password,
            r.id AS role_id, r.name AS role_name, r.slug AS role_slug,
            e.id AS employee_id, e.employee_no, e.first_name, e.last_name, e.full_name AS employee_full_name,
            e.nationality, e.hire_date, e.employment_status, e.photo_path,
            e.salary_currency, e.salary_amount, e.official_salary_amount, e.unofficial_salary_amount,
            d.id AS department_id, d.name AS department_name,
            p.id AS position_id, p.name AS position_name
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     LEFT JOIN employees e ON e.user_id = u.id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN positions p ON p.id = e.position_id
     WHERE u.id = :id
     LIMIT 1`,
    { id }
  );
  if (!rows.length) return null;
  const row = rows[0];
  const employeeName =
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || String(row.employee_full_name || '').trim() || null;

  return {
    user: {
      id: row.id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      is_active: !!row.is_active,
      must_change_password: Number(row.must_change_password) === 1,
      last_login_at: row.last_login_at || null,
      role: {
        id: row.role_id,
        name: row.role_name,
        slug: row.role_slug,
      },
    },
    employee: row.employee_id
      ? {
          id: row.employee_id,
          employee_no: row.employee_no,
          full_name: employeeName,
          nationality: row.nationality,
          hire_date: row.hire_date,
          employment_status: row.employment_status,
          photo_path: row.photo_path,
          department: row.department_id ? { id: row.department_id, name: row.department_name } : null,
          position: row.position_id ? { id: row.position_id, name: row.position_name } : null,
          salary: {
            currency: row.salary_currency,
            total: Number(row.salary_amount || 0),
            official: Number(row.official_salary_amount || 0),
            unofficial: Number(row.unofficial_salary_amount || 0),
          },
        }
      : null,
    summary: {
      attendance: {
        worked_days_this_month: null,
        absent_days_this_month: null,
        overtime_hours_this_month: null,
        projects: [],
        note: 'placeholder',
      },
      advance: {
        total_advance: null,
        remaining_balance: null,
        history: [],
        note: 'placeholder',
      },
      notifications: [],
    },
  };
}

async function changeMyPassword(userId, currentPassword, newPassword) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id < 1) return { error: 'api.auth.failed' };
  const [rows] = await pool.query('SELECT id, password_hash FROM users WHERE id = :id LIMIT 1', { id });
  if (!rows.length) return { error: 'api.auth.failed' };

  const ok = await bcrypt.compare(String(currentPassword || ''), String(rows[0].password_hash || ''));
  if (!ok) return { error: 'api.me.current_password_invalid' };

  const hash = await bcrypt.hash(String(newPassword), 10);
  await pool.query('UPDATE users SET password_hash = :hash, must_change_password = 0 WHERE id = :id', { id, hash });
  return { ok: true };
}

module.exports = {
  getMyProfile,
  changeMyPassword,
};
