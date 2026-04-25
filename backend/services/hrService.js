const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { toUpperTr, optionalNoteUpperTr } = require('../utils/textNormalize');

function parseId(v) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  return ['active', 'passive', 'terminated'].includes(s) ? s : null;
}

function normalizeWorkStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  return ['worked', 'absent', 'leave', 'sick_leave', 'half_day'].includes(s) ? s : null;
}

async function getScope() {
  return { canHr: true };
}

async function listDepartments() {
  const [rows] = await pool.query(
    `SELECT id, code, name, is_active, created_at, updated_at
     FROM departments
     ORDER BY is_active DESC, name ASC`
  );
  return { departments: rows };
}

async function createDepartment(input) {
  const name = toUpperTr(input?.name);
  if (!name) return err('Departman adı gerekli', 'api.hr.department_name_required');
  const code = input?.code == null || String(input.code).trim() === '' ? null : String(input.code).trim();
  const [r] = await pool.query(
    'INSERT INTO departments (code, name, is_active) VALUES (:code, :name, :is_active)',
    { code, name, is_active: input?.is_active === 0 ? 0 : 1 }
  );
  return { id: r.insertId };
}

async function listPositions() {
  const [rows] = await pool.query(
    `SELECT p.id, p.department_id, p.code, p.name, p.is_active, p.created_at, p.updated_at,
            d.name AS department_name
     FROM positions p
     INNER JOIN departments d ON d.id = p.department_id
     ORDER BY p.is_active DESC, d.name ASC, p.name ASC`
  );
  return { positions: rows };
}

async function createPosition(input) {
  const departmentId = parseId(input?.department_id);
  if (!departmentId) return err('Departman seçin', 'api.hr.department_required');
  const name = toUpperTr(input?.name);
  if (!name) return err('Pozisyon adı gerekli', 'api.hr.position_name_required');
  const code = input?.code == null || String(input.code).trim() === '' ? null : String(input.code).trim();
  const [r] = await pool.query(
    'INSERT INTO positions (department_id, code, name, is_active) VALUES (:department_id, :code, :name, :is_active)',
    { department_id: departmentId, code, name, is_active: input?.is_active === 0 ? 0 : 1 }
  );
  return { id: r.insertId };
}

async function listEmployees(filters = {}) {
  const where = [];
  const p = {};
  const status = normalizeStatus(filters.status);
  if (status) {
    where.push('e.employment_status = :status');
    p.status = status;
  }
  if (filters.search != null && String(filters.search).trim() !== '') {
    where.push('(e.full_name LIKE :q OR e.employee_no LIKE :q)');
    p.q = `%${String(filters.search).trim()}%`;
  }
  const sql = `SELECT e.id, e.employee_no, e.full_name, e.phone, e.email, e.hire_date, e.employment_status,
                      e.department_id, d.name AS department_name, e.position_id, pz.name AS position_name,
                      e.user_id, u.username AS user_username, e.note, e.created_at, e.updated_at
               FROM employees e
               LEFT JOIN departments d ON d.id = e.department_id
               LEFT JOIN positions pz ON pz.id = e.position_id
               LEFT JOIN users u ON u.id = e.user_id
               ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY e.id DESC`;
  const [rows] = await pool.query(sql, p);
  return { employees: rows };
}

async function createEmployee(input) {
  const fullName = toUpperTr(input?.full_name);
  if (!fullName) return err('Ad soyad gerekli', 'api.hr.employee_name_required');
  const hireDate = String(input?.hire_date || '').trim();
  if (!hireDate) return err('Ise giris tarihi gerekli', 'api.hr.hire_date_required');
  const status = normalizeStatus(input?.employment_status) || 'active';
  const departmentId = parseId(input?.department_id);
  const positionId = parseId(input?.position_id);
  const userId = parseId(input?.user_id);
  const employeeNo =
    input?.employee_no == null || String(input.employee_no).trim() === '' ? null : String(input.employee_no).trim();
  const phone = input?.phone == null || String(input.phone).trim() === '' ? null : String(input.phone).trim();
  const email = input?.email == null || String(input.email).trim() === '' ? null : String(input.email).trim();
  const note = optionalNoteUpperTr(input?.note);

  const [r] = await pool.query(
    `INSERT INTO employees
      (employee_no, full_name, phone, email, hire_date, employment_status, department_id, position_id, user_id, note)
     VALUES
      (:employee_no, :full_name, :phone, :email, :hire_date, :employment_status, :department_id, :position_id, :user_id, :note)`,
    {
      employee_no: employeeNo,
      full_name: fullName,
      phone,
      email,
      hire_date: hireDate,
      employment_status: status,
      department_id: departmentId,
      position_id: positionId,
      user_id: userId,
      note,
    }
  );
  return { id: r.insertId };
}

async function listAttendance(filters = {}) {
  const where = [];
  const p = {};
  if (parseId(filters.employeeId)) {
    where.push('a.employee_id = :employee_id');
    p.employee_id = parseId(filters.employeeId);
  }
  const ws = normalizeWorkStatus(filters.status);
  if (ws) {
    where.push('a.work_status = :work_status');
    p.work_status = ws;
  }
  if (filters.from) {
    where.push('a.work_date >= :from_date');
    p.from_date = String(filters.from);
  }
  if (filters.to) {
    where.push('a.work_date <= :to_date');
    p.to_date = String(filters.to);
  }
  const sql = `SELECT a.id, a.employee_id, e.full_name AS employee_name, a.work_date, a.check_in_time, a.check_out_time,
                      a.work_status, a.overtime_hours, a.note, a.created_at, a.updated_at
               FROM employee_attendance a
               INNER JOIN employees e ON e.id = a.employee_id
               ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY a.work_date DESC, a.id DESC`;
  const [rows] = await pool.query(sql, p);
  return { attendance: rows };
}

async function createAttendance(input, actorId) {
  const employeeId = parseId(input?.employee_id);
  if (!employeeId) return err('Personel secin', 'api.hr.employee_required');
  const workDate = String(input?.work_date || '').trim();
  if (!workDate) return err('Tarih gerekli', 'api.hr.work_date_required');
  const workStatus = normalizeWorkStatus(input?.work_status);
  if (!workStatus) return err('Calisma durumu gecersiz', 'api.hr.work_status_invalid');

  const checkIn = input?.check_in_time == null || String(input.check_in_time).trim() === '' ? null : String(input.check_in_time).trim();
  const checkOut =
    input?.check_out_time == null || String(input.check_out_time).trim() === '' ? null : String(input.check_out_time).trim();
  const overtime = Number(input?.overtime_hours);
  const overtimeHours = Number.isFinite(overtime) && overtime >= 0 ? overtime : 0;
  const note = optionalNoteUpperTr(input?.note);

  const [r] = await pool.query(
    `INSERT INTO employee_attendance
      (employee_id, work_date, check_in_time, check_out_time, work_status, overtime_hours, note, created_by, updated_by)
     VALUES
      (:employee_id, :work_date, :check_in_time, :check_out_time, :work_status, :overtime_hours, :note, :created_by, :updated_by)`,
    {
      employee_id: employeeId,
      work_date: workDate,
      check_in_time: checkIn,
      check_out_time: checkOut,
      work_status: workStatus,
      overtime_hours: overtimeHours,
      note,
      created_by: actorId || null,
      updated_by: actorId || null,
    }
  );
  return { id: r.insertId };
}

module.exports = {
  getScope,
  listDepartments,
  createDepartment,
  listPositions,
  createPosition,
  listEmployees,
  createEmployee,
  listAttendance,
  createAttendance,
};
