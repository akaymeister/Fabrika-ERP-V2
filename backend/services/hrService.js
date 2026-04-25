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

function normalizeTime(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/);
  if (!m) return null;
  return `${m[1]}:${m[2]}${m[3] || ':00'}`;
}

function validateAttendanceRule(workStatus, checkIn, checkOut) {
  const strictTime = workStatus === 'worked' || workStatus === 'half_day';
  if (strictTime) {
    if (!checkIn || !checkOut) return err('Giris ve cikis saati zorunlu', 'api.hr.attendance_time_required');
    if (checkOut <= checkIn) return err('Cikis saati giristen sonra olmali', 'api.hr.attendance_time_order_invalid');
    return null;
  }
  // absent / leave / sick_leave icin saatler opsiyonel; doluysa tutarli olmali
  if (checkIn && checkOut && checkOut <= checkIn) {
    return err('Cikis saati giristen sonra olmali', 'api.hr.attendance_time_order_invalid');
  }
  return null;
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

async function updateDepartment(id, input) {
  const depId = parseId(id);
  if (!depId) return err('Gecersiz departman', 'api.hr.department_invalid');
  const fields = [];
  const p = { id: depId };
  if (input?.name != null) {
    const name = toUpperTr(input.name);
    if (!name) return err('Departman adi gerekli', 'api.hr.department_name_required');
    fields.push('name = :name');
    p.name = name;
  }
  if (input?.code !== undefined) {
    const code = input.code == null || String(input.code).trim() === '' ? null : String(input.code).trim();
    fields.push('code = :code');
    p.code = code;
  }
  if (input?.is_active != null) {
    fields.push('is_active = :is_active');
    p.is_active = input.is_active ? 1 : 0;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE departments SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Departman bulunamadi', 'api.hr.department_not_found');
  return { ok: true };
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

async function updatePosition(id, input) {
  const posId = parseId(id);
  if (!posId) return err('Gecersiz pozisyon', 'api.hr.position_invalid');
  const fields = [];
  const p = { id: posId };
  if (input?.department_id != null) {
    const departmentId = parseId(input.department_id);
    if (!departmentId) return err('Departman secin', 'api.hr.department_required');
    fields.push('department_id = :department_id');
    p.department_id = departmentId;
  }
  if (input?.name != null) {
    const name = toUpperTr(input.name);
    if (!name) return err('Pozisyon adi gerekli', 'api.hr.position_name_required');
    fields.push('name = :name');
    p.name = name;
  }
  if (input?.code !== undefined) {
    const code = input.code == null || String(input.code).trim() === '' ? null : String(input.code).trim();
    fields.push('code = :code');
    p.code = code;
  }
  if (input?.is_active != null) {
    fields.push('is_active = :is_active');
    p.is_active = input.is_active ? 1 : 0;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE positions SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Pozisyon bulunamadi', 'api.hr.position_not_found');
  return { ok: true };
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

async function getEmployeeById(id) {
  const empId = parseId(id);
  if (!empId) return err('Gecersiz personel', 'api.hr.employee_invalid');
  const [rows] = await pool.query(
    `SELECT e.id, e.employee_no, e.full_name, e.phone, e.email, e.hire_date, e.employment_status,
            e.department_id, e.position_id, e.user_id, e.note
     FROM employees e
     WHERE e.id = :id
     LIMIT 1`,
    { id: empId }
  );
  if (!rows.length) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  return { employee: rows[0] };
}

async function updateEmployee(id, input) {
  const empId = parseId(id);
  if (!empId) return err('Gecersiz personel', 'api.hr.employee_invalid');
  const fields = [];
  const p = { id: empId };

  if (input?.employee_no !== undefined) {
    const employeeNo =
      input.employee_no == null || String(input.employee_no).trim() === '' ? null : String(input.employee_no).trim();
    fields.push('employee_no = :employee_no');
    p.employee_no = employeeNo;
  }
  if (input?.full_name != null) {
    const fullName = toUpperTr(input.full_name);
    if (!fullName) return err('Ad soyad gerekli', 'api.hr.employee_name_required');
    fields.push('full_name = :full_name');
    p.full_name = fullName;
  }
  if (input?.phone !== undefined) {
    p.phone = input.phone == null || String(input.phone).trim() === '' ? null : String(input.phone).trim();
    fields.push('phone = :phone');
  }
  if (input?.email !== undefined) {
    p.email = input.email == null || String(input.email).trim() === '' ? null : String(input.email).trim();
    fields.push('email = :email');
  }
  if (input?.hire_date != null) {
    const hireDate = String(input.hire_date || '').trim();
    if (!hireDate) return err('Ise giris tarihi gerekli', 'api.hr.hire_date_required');
    fields.push('hire_date = :hire_date');
    p.hire_date = hireDate;
  }
  if (input?.employment_status != null) {
    const status = normalizeStatus(input.employment_status);
    if (!status) return err('Personel durumu gecersiz', 'api.hr.employee_status_invalid');
    fields.push('employment_status = :employment_status');
    p.employment_status = status;
  }
  if (input?.department_id !== undefined) {
    p.department_id = parseId(input.department_id);
    fields.push('department_id = :department_id');
  }
  if (input?.position_id !== undefined) {
    p.position_id = parseId(input.position_id);
    fields.push('position_id = :position_id');
  }
  if (input?.user_id !== undefined) {
    p.user_id = parseId(input.user_id);
    fields.push('user_id = :user_id');
  }
  if (input?.note !== undefined) {
    p.note = optionalNoteUpperTr(input.note);
    fields.push('note = :note');
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE employees SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  return { ok: true };
}

async function listAssignableUsers(currentEmployeeId = null) {
  const employeeId = parseId(currentEmployeeId);
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.email, u.is_active,
            e.id AS linked_employee_id
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.is_active = 1
       AND (e.id IS NULL OR e.id = :employee_id)
     ORDER BY u.username ASC`,
    { employee_id: employeeId || 0 }
  );
  return { users: rows };
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

  const checkIn = normalizeTime(input?.check_in_time);
  const checkOut = normalizeTime(input?.check_out_time);
  const vErr = validateAttendanceRule(workStatus, checkIn, checkOut);
  if (vErr) return vErr;
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

async function updateAttendance(id, input, actorId) {
  const attId = parseId(id);
  if (!attId) return err('Gecersiz puantaj kaydi', 'api.hr.attendance_invalid');

  const [rows] = await pool.query(
    `SELECT id, employee_id, work_date, check_in_time, check_out_time, work_status, overtime_hours, note
     FROM employee_attendance
     WHERE id = :id
     LIMIT 1`,
    { id: attId }
  );
  if (!rows.length) return err('Puantaj kaydi bulunamadi', 'api.hr.attendance_not_found');
  const current = rows[0];

  const next = {
    employee_id: input?.employee_id !== undefined ? parseId(input.employee_id) : current.employee_id,
    work_date: input?.work_date !== undefined ? String(input.work_date || '').trim() : String(current.work_date || '').slice(0, 10),
    work_status: input?.work_status !== undefined ? normalizeWorkStatus(input.work_status) : current.work_status,
    check_in_time:
      input?.check_in_time !== undefined
        ? normalizeTime(input.check_in_time)
        : normalizeTime(String(current.check_in_time || '').slice(0, 8)),
    check_out_time:
      input?.check_out_time !== undefined
        ? normalizeTime(input.check_out_time)
        : normalizeTime(String(current.check_out_time || '').slice(0, 8)),
    overtime_hours:
      input?.overtime_hours !== undefined
        ? (() => {
            const n = Number(input.overtime_hours);
            return Number.isFinite(n) && n >= 0 ? n : null;
          })()
        : Number(current.overtime_hours || 0),
    note: input?.note !== undefined ? optionalNoteUpperTr(input.note) : current.note,
  };

  if (!next.employee_id) return err('Personel secin', 'api.hr.employee_required');
  if (!next.work_date) return err('Tarih gerekli', 'api.hr.work_date_required');
  if (!next.work_status) return err('Calisma durumu gecersiz', 'api.hr.work_status_invalid');
  if (next.overtime_hours == null) return err('Fazla mesai saati gecersiz', 'api.hr.overtime_invalid');

  const vErr = validateAttendanceRule(next.work_status, next.check_in_time, next.check_out_time);
  if (vErr) return vErr;

  const [r] = await pool.query(
    `UPDATE employee_attendance
     SET employee_id = :employee_id,
         work_date = :work_date,
         check_in_time = :check_in_time,
         check_out_time = :check_out_time,
         work_status = :work_status,
         overtime_hours = :overtime_hours,
         note = :note,
         updated_by = :updated_by
     WHERE id = :id`,
    {
      id: attId,
      employee_id: next.employee_id,
      work_date: next.work_date,
      check_in_time: next.check_in_time,
      check_out_time: next.check_out_time,
      work_status: next.work_status,
      overtime_hours: next.overtime_hours,
      note: next.note,
      updated_by: actorId || null,
    }
  );
  if (!r.affectedRows) return err('Puantaj kaydi bulunamadi', 'api.hr.attendance_not_found');
  return { ok: true };
}

module.exports = {
  getScope,
  listDepartments,
  createDepartment,
  updateDepartment,
  listPositions,
  createPosition,
  updatePosition,
  listEmployees,
  createEmployee,
  getEmployeeById,
  updateEmployee,
  listAssignableUsers,
  listAttendance,
  createAttendance,
  updateAttendance,
};
