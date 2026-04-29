const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { toUpperTr, optionalNoteUpperTr } = require('../utils/textNormalize');
const { normalizeCountryCode, isValidRegionForCountry } = require('../constants/locationData');
const { UPLOADS_ROOT } = require('../utils/paths');

const NATIONALITY_SET = new Set(['TR', 'UZ', 'RU', 'EN', 'OTHER']);
const HR_SETTING_KEYS = new Set([
  'daily_start_time',
  'daily_end_time',
  'break_1_minutes',
  'break_2_minutes',
  'break_3_minutes',
  'lunch_minutes',
  'holiday_days',
  'weekly_work_hours',
  'daily_work_hours',
  'overtime_multiplier_1',
  'overtime_multiplier_2',
  'overtime_multiplier_3',
]);

function normalizeNationality(v) {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'DİĞER' || s === 'DIGER') return 'OTHER';
  return NATIONALITY_SET.has(s) ? s : null;
}

function formatEmployeeLabel(e) {
  const name = [e.first_name, e.last_name].filter(Boolean).join(' ').trim() || String(e.full_name || '').trim();
  const no = String(e.employee_no || '').trim();
  return no ? `${no} - ${name}` : name;
}

function enrichEmployeeRow(e) {
  if (!e) return e;
  e.employee_display = formatEmployeeLabel(e);
  return e;
}

function parseMoney2(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function computeUnofficial(total, official) {
  return Math.round((Number(total) - Number(official)) * 100) / 100;
}

async function nextEmployeeNumber(conn) {
  const executor = conn || pool;
  const [rows] = await executor.query(
    `SELECT employee_no FROM employees WHERE employee_no IS NOT NULL AND employee_no LIKE 'PRS-%'`
  );
  let max = 0;
  for (const r of rows) {
    const m = String(r.employee_no || '').match(/^PRS-(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PRS-${String(max + 1).padStart(3, '0')}`;
}

function applyEmployeeListFilters(filters, where, p) {
  const status = normalizeStatus(filters.status);
  if (status) {
    where.push('e.employment_status = :status');
    p.status = status;
  }
  if (filters.nationality != null && String(filters.nationality).trim() !== '') {
    const nat = normalizeNationality(filters.nationality);
    if (!nat) return err('Uyruk gecersiz', 'api.hr.nationality_invalid');
    where.push('e.nationality = :nationality');
    p.nationality = nat;
  }
  const ctry = filters.country != null && String(filters.country).trim() !== '' ? normalizeCountryCode(filters.country) : null;
  if (filters.country != null && String(filters.country).trim() !== '') {
    if (!ctry) return err('Ulke gecersiz', 'api.hr.country_invalid');
    where.push('e.country = :country');
    p.country = ctry;
  }
  if (filters.region_or_city != null && String(filters.region_or_city).trim() !== '') {
    where.push('e.region_or_city = :region_or_city');
    p.region_or_city = toUpperTr(filters.region_or_city);
  }
  const depId = parseId(filters.department_id);
  if (depId) {
    where.push('e.department_id = :department_id');
    p.department_id = depId;
  }
  const posId = parseId(filters.position_id);
  if (posId) {
    where.push('e.position_id = :position_id');
    p.position_id = posId;
  }
  if (filters.search != null && String(filters.search).trim() !== '') {
    where.push(
      '(e.full_name LIKE :q OR e.employee_no LIKE :q OR e.first_name LIKE :q OR e.last_name LIKE :q OR CONCAT(COALESCE(e.first_name,\'\'), \' \', COALESCE(e.last_name,\'\')) LIKE :q)'
    );
    p.q = `%${String(filters.search).trim()}%`;
  }
  return null;
}

function applyEmployeeAttendanceFilters(filters, where, p) {
  if (filters.nationality != null && String(filters.nationality).trim() !== '') {
    const nat = normalizeNationality(filters.nationality);
    if (!nat) return err('Uyruk gecersiz', 'api.hr.nationality_invalid');
    where.push('e.nationality = :nationality');
    p.nationality = nat;
  }
  const ctry = filters.country != null && String(filters.country).trim() !== '' ? normalizeCountryCode(filters.country) : null;
  if (filters.country != null && String(filters.country).trim() !== '') {
    if (!ctry) return err('Ulke gecersiz', 'api.hr.country_invalid');
    where.push('e.country = :country');
    p.country = ctry;
  }
  if (filters.region_or_city != null && String(filters.region_or_city).trim() !== '') {
    where.push('e.region_or_city = :region_or_city');
    p.region_or_city = toUpperTr(filters.region_or_city);
  }
  const depId = parseId(filters.department_id);
  if (depId) {
    where.push('e.department_id = :department_id');
    p.department_id = depId;
  }
  const posId = parseId(filters.position_id);
  if (posId) {
    where.push('e.position_id = :position_id');
    p.position_id = posId;
  }
  if (filters.search != null && String(filters.search).trim() !== '') {
    where.push(
      "(COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) LIKE :emp_search OR e.employee_no LIKE :emp_search)"
    );
    p.emp_search = `%${String(filters.search).trim()}%`;
  }
  return null;
}

function safeUnlinkUpload(relPath) {
  if (!relPath || String(relPath).includes('..')) return;
  const full = path.resolve(path.join(UPLOADS_ROOT, relPath));
  const root = path.resolve(UPLOADS_ROOT);
  if (!full.startsWith(root)) return;
  fs.unlink(full, () => {});
}

function parseId(v) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeTelegramUsername(v) {
  if (v == null || String(v).trim() === '') return null;
  return String(v).trim().replace(/^@+/, '').slice(0, 100);
}

function normalizeTelegramChatId(v) {
  if (v == null || String(v).trim() === '') return null;
  return String(v).trim().slice(0, 100);
}

function normalizeTelegramNotifyEnabled(v) {
  if (v === 0 || v === '0' || v === false || v === 'false') return 0;
  return 1;
}

function normalizeStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  return ['active', 'passive', 'terminated'].includes(s) ? s : null;
}

function normalizeWorkStatus(v) {
  return String(v || '').trim().toLowerCase() || null;
}

function normalizeWorkType(v) {
  return String(v || '').trim().toLowerCase() || null;
}

function normalizeMonthKey(v) {
  const s = String(v || '').trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : null;
}

function normalizeTime(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/);
  if (!m) return null;
  return `${m[1]}:${m[2]}${m[3] || ':00'}`;
}

function normalizeCode(v) {
  const raw = String(v || '').trim().toLowerCase();
  const code = raw.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return code || null;
}

function parseNonNegNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseIntSafe(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function validateHrSettingValue(key, value) {
  const s = value == null ? '' : String(value).trim();
  if (key === 'daily_start_time' || key === 'daily_end_time') {
    return normalizeTime(`${s}:00`.slice(0, 8)) ? s.slice(0, 5) : null;
  }
  if (key === 'holiday_days') {
    return s.slice(0, 200);
  }
  if (key.startsWith('overtime_multiplier_')) {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return String(Math.round(n * 1000) / 1000);
  }
  const n = parseNonNegNumber(s);
  if (n == null) return null;
  return String(n);
}

async function getAllowedCodes(tableName, includeInactive = false) {
  const where = includeInactive ? '' : 'WHERE is_active = 1';
  const [rows] = await pool.query(`SELECT code FROM ${tableName} ${where}`);
  return new Set(rows.map((r) => String(r.code || '').trim().toLowerCase()).filter(Boolean));
}

async function ensureAllowedCode(tableName, code, message, messageKey) {
  const c = normalizeCode(code);
  if (!c) return err(message, messageKey);
  const allowed = await getAllowedCodes(tableName, true);
  return allowed.has(c) ? c : err(message, messageKey);
}

function validateAttendanceRule(workStatus, checkIn, checkOut) {
  const strictTime = workStatus === 'worked' || workStatus === 'half_day' || workStatus === 'overtime';
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

function monthKeyFromDate(workDate) {
  const d = String(workDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return d.slice(0, 7);
}

function computeTotalHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const cin = String(checkIn).slice(0, 8);
  const cout = String(checkOut).slice(0, 8);
  if (!cin || !cout || cout <= cin) return 0;
  const s = cin.split(':').map((x) => Number(x) || 0);
  const e = cout.split(':').map((x) => Number(x) || 0);
  const m1 = s[0] * 60 + s[1];
  const m2 = e[0] * 60 + e[1];
  if (m2 <= m1) return 0;
  return Math.round(((m2 - m1) / 60) * 100) / 100;
}

async function isAttendanceMonthLocked(monthKey) {
  const mk = normalizeMonthKey(monthKey);
  if (!mk) return false;
  const [rows] = await pool.query('SELECT is_locked FROM attendance_month_locks WHERE month_key = ? LIMIT 1', [mk]);
  return !!(rows.length && Number(rows[0].is_locked) === 1);
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
  const fErr = applyEmployeeListFilters(filters, where, p);
  if (fErr) return fErr;
  const sql = `SELECT e.id, e.employee_no, e.full_name, e.first_name, e.last_name, e.nationality, e.birth_date, e.gender, e.marital_status, e.photo_path,
                      COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS person_name,
                      e.salary_currency, e.salary_amount, e.official_salary_amount, e.unofficial_salary_amount,
                      e.country, e.region_or_city, e.address_line,
                      e.phone, e.phone_secondary, e.identity_no, e.passport_no, e.email, e.hire_date, e.employment_status,
                      e.department_id, d.name AS department_name, e.position_id, pz.name AS position_name,
                      e.user_id, u.username AS user_username,
                      e.telegram_username, e.telegram_chat_id, e.telegram_notify_enabled,
                      e.note, e.created_at, e.updated_at
               FROM employees e
               LEFT JOIN departments d ON d.id = e.department_id
               LEFT JOIN positions pz ON pz.id = e.position_id
               LEFT JOIN users u ON u.id = e.user_id
               ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY e.id DESC`;
  const [rows] = await pool.query(sql, p);
  rows.forEach(enrichEmployeeRow);
  return { employees: rows };
}

async function createEmployee(input) {
  let firstName = toUpperTr(input?.first_name);
  let lastName = toUpperTr(input?.last_name);
  if ((!firstName || !lastName) && input?.full_name) {
    const raw = String(input.full_name).trim();
    const sp = raw.indexOf(' ');
    if (sp === -1) {
      firstName = firstName || toUpperTr(raw);
      lastName = lastName || '';
    } else {
      firstName = firstName || toUpperTr(raw.slice(0, sp));
      lastName = lastName || toUpperTr(raw.slice(sp + 1));
    }
  }
  if (!String(firstName || '').trim() || !String(lastName || '').trim()) {
    return err('Ad ve soyad gerekli', 'api.hr.employee_name_required');
  }

  const hireDate = String(input?.hire_date || '').trim();
  if (!hireDate) return err('Ise giris tarihi gerekli', 'api.hr.hire_date_required');
  const status = normalizeStatus(input?.employment_status) || 'active';
  const departmentId = parseId(input?.department_id);
  const positionId = parseId(input?.position_id);
  const userId = parseId(input?.user_id);
  const phone = input?.phone == null || String(input.phone).trim() === '' ? null : String(input.phone).trim();
  const phoneSecondary =
    input?.phone_secondary == null || String(input.phone_secondary).trim() === '' ? null : String(input.phone_secondary).trim();
  const identityNo =
    input?.identity_no == null || String(input.identity_no).trim() === '' ? null : toUpperTr(input.identity_no);
  const passportNo =
    input?.passport_no == null || String(input.passport_no).trim() === '' ? null : toUpperTr(input.passport_no);
  const birthDate = input?.birth_date == null || String(input.birth_date).trim() === '' ? null : String(input.birth_date).trim();
  const genderRaw = String(input?.gender || '').trim().toLowerCase();
  const gender = ['male', 'female', 'other'].includes(genderRaw) ? genderRaw : null;
  if (input?.gender != null && String(input.gender).trim() !== '' && !gender) {
    return err('Cinsiyet gecersiz', 'api.hr.gender_invalid');
  }
  const maritalRaw = String(input?.marital_status || '').trim().toLowerCase();
  const maritalStatus = ['single', 'married', 'divorced', 'widowed'].includes(maritalRaw) ? maritalRaw : null;
  if (input?.marital_status != null && String(input.marital_status).trim() !== '' && !maritalStatus) {
    return err('Medeni durum gecersiz', 'api.hr.marital_invalid');
  }
  const email = input?.email == null || String(input.email).trim() === '' ? null : String(input.email).trim();
  const note = optionalNoteUpperTr(input?.note);
  const telegramUsername = normalizeTelegramUsername(input?.telegram_username);
  const telegramChatId = normalizeTelegramChatId(input?.telegram_chat_id);
  const telegramNotifyEnabled = normalizeTelegramNotifyEnabled(input?.telegram_notify_enabled);

  const nationality = normalizeNationality(input?.nationality);
  if (input?.nationality != null && String(input.nationality).trim() !== '' && !nationality) {
    return err('Uyruk gecersiz', 'api.hr.nationality_invalid');
  }

  const country =
    input?.country != null && String(input.country).trim() !== '' ? normalizeCountryCode(input.country) : null;
  if (input?.country != null && String(input.country).trim() !== '' && !country) {
    return err('Ulke gecersiz', 'api.hr.country_invalid');
  }
  let regionOrCity = null;
  if (input?.region_or_city != null && String(input.region_or_city).trim() !== '') {
    regionOrCity = toUpperTr(input.region_or_city);
    if (country && !isValidRegionForCountry(country, regionOrCity)) {
      return err('Il / bolge bu ulke icin gecersiz', 'api.hr.region_invalid');
    }
  }
  const addressLine =
    input?.address_line == null || String(input.address_line).trim() === ''
      ? null
      : optionalNoteUpperTr(input.address_line);

  const salaryCurrency = String(input?.salary_currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  const salaryAmount = parseMoney2(input?.salary_amount);
  const officialAmount = parseMoney2(input?.official_salary_amount);
  if (salaryAmount == null) return err('Toplam maas gecersiz', 'api.hr.salary_amount_invalid');
  if (officialAmount == null) return err('Resmi maas gecersiz', 'api.hr.official_salary_invalid');
  if (officialAmount > salaryAmount) {
    return err('Resmi maas toplam maastan buyuk olamaz', 'api.hr.salary_official_exceeds_total');
  }
  const unofficialAmount = computeUnofficial(salaryAmount, officialAmount);

  const fullName = toUpperTr(`${firstName} ${lastName}`.trim());

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const employeeNo = await nextEmployeeNumber(conn);
    const [r] = await conn.query(
      `INSERT INTO employees
        (employee_no, full_name, first_name, last_name, nationality, birth_date, gender, marital_status, photo_path, salary_currency,
         salary_amount, official_salary_amount, unofficial_salary_amount,
         country, region_or_city, address_line,
         phone, phone_secondary, identity_no, passport_no, email, hire_date, employment_status, department_id, position_id, user_id,
         telegram_username, telegram_chat_id, telegram_notify_enabled, note)
       VALUES
        (:employee_no, :full_name, :first_name, :last_name, :nationality, :birth_date, :gender, :marital_status, NULL, :salary_currency,
         :salary_amount, :official_salary_amount, :unofficial_salary_amount,
         :country, :region_or_city, :address_line,
         :phone, :phone_secondary, :identity_no, :passport_no, :email, :hire_date, :employment_status, :department_id, :position_id, :user_id,
         :telegram_username, :telegram_chat_id, :telegram_notify_enabled, :note)`,
      {
        employee_no: employeeNo,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        nationality,
        birth_date: birthDate,
        gender,
        marital_status: maritalStatus,
        salary_currency: salaryCurrency,
        salary_amount: salaryAmount,
        official_salary_amount: officialAmount,
        unofficial_salary_amount: unofficialAmount,
        country,
        region_or_city: regionOrCity,
        address_line: addressLine,
        phone,
        phone_secondary: phoneSecondary,
        identity_no: identityNo,
        passport_no: passportNo,
        email,
        hire_date: hireDate,
        employment_status: status,
        department_id: departmentId,
        position_id: positionId,
        user_id: userId,
        telegram_username: telegramUsername,
        telegram_chat_id: telegramChatId,
        telegram_notify_enabled: telegramNotifyEnabled,
        note,
      }
    );
    await conn.commit();
    return { id: r.insertId, employee_no: employeeNo };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getEmployeeById(id) {
  const empId = parseId(id);
  if (!empId) return err('Gecersiz personel', 'api.hr.employee_invalid');
  const [rows] = await pool.query(
    `SELECT e.id, e.employee_no, e.full_name, e.first_name, e.last_name, e.nationality, e.birth_date, e.gender, e.marital_status, e.photo_path,
            e.salary_currency, e.salary_amount, e.official_salary_amount, e.unofficial_salary_amount,
            e.country, e.region_or_city, e.address_line,
            e.phone, e.phone_secondary, e.identity_no, e.passport_no, e.email, e.hire_date, e.employment_status,
            e.department_id, e.position_id, e.user_id,
            e.telegram_username, e.telegram_chat_id, e.telegram_notify_enabled, e.note
     FROM employees e
     WHERE e.id = :id
     LIMIT 1`,
    { id: empId }
  );
  if (!rows.length) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  const emp = enrichEmployeeRow(rows[0]);
  emp.unofficial_salary_amount = computeUnofficial(emp.salary_amount, emp.official_salary_amount);
  return { employee: emp };
}

async function updateEmployee(id, input) {
  const empId = parseId(id);
  if (!empId) return err('Gecersiz personel', 'api.hr.employee_invalid');
  const [curRows] = await pool.query(
    `SELECT id, employee_no, full_name, first_name, last_name, nationality, birth_date, gender, marital_status, photo_path, salary_currency,
            salary_amount, official_salary_amount, unofficial_salary_amount, country, region_or_city, address_line,
            phone, phone_secondary, identity_no, passport_no, email, hire_date, employment_status, department_id, position_id, user_id,
            telegram_username, telegram_chat_id, telegram_notify_enabled, note
     FROM employees WHERE id = :id LIMIT 1`,
    { id: empId }
  );
  if (!curRows.length) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  const cur = curRows[0];

  const fields = [];
  const p = { id: empId };

  let firstName = cur.first_name;
  let lastName = cur.last_name;
  if (input?.first_name != null) {
    firstName = toUpperTr(input.first_name);
    if (!firstName) return err('Ad gerekli', 'api.hr.employee_first_name_required');
    fields.push('first_name = :first_name');
    p.first_name = firstName;
  }
  if (input?.last_name != null) {
    lastName = toUpperTr(input.last_name);
    if (!lastName) return err('Soyad gerekli', 'api.hr.employee_last_name_required');
    fields.push('last_name = :last_name');
    p.last_name = lastName;
  }
  if (input?.first_name != null || input?.last_name != null) {
    const fn = input?.first_name != null ? firstName : cur.first_name;
    const ln = input?.last_name != null ? lastName : cur.last_name;
    if (!String(fn || '').trim() || !String(ln || '').trim()) {
      return err('Ad ve soyad gerekli', 'api.hr.employee_name_required');
    }
    const mergedFull = toUpperTr(`${fn || ''} ${ln || ''}`.trim());
    fields.push('full_name = :full_name');
    p.full_name = mergedFull;
  } else if (input?.full_name != null) {
    // Geriye uyumluluk: sadece full_name gelirse ad/soyad üretip sakla.
    const fullRaw = String(input.full_name || '').trim();
    if (fullRaw) {
      const sp = fullRaw.indexOf(' ');
      const fn = sp === -1 ? toUpperTr(fullRaw) : toUpperTr(fullRaw.slice(0, sp));
      const ln = sp === -1 ? '' : toUpperTr(fullRaw.slice(sp + 1));
      if (!String(fn || '').trim() || !String(ln || '').trim()) {
        return err('Ad ve soyad gerekli', 'api.hr.employee_name_required');
      }
      fields.push('first_name = :first_name');
      fields.push('last_name = :last_name');
      fields.push('full_name = :full_name');
      p.first_name = fn;
      p.last_name = ln;
      p.full_name = toUpperTr(`${fn} ${ln}`.trim());
    }
  }

  if (input?.nationality !== undefined) {
    const nat = normalizeNationality(input.nationality);
    if (input.nationality != null && String(input.nationality).trim() !== '' && !nat) {
      return err('Uyruk gecersiz', 'api.hr.nationality_invalid');
    }
    fields.push('nationality = :nationality');
    p.nationality = nat;
  }
  if (input?.birth_date !== undefined) {
    p.birth_date = input.birth_date == null || String(input.birth_date).trim() === '' ? null : String(input.birth_date).trim();
    fields.push('birth_date = :birth_date');
  }
  if (input?.gender !== undefined) {
    const genderRaw = input.gender == null ? '' : String(input.gender).trim().toLowerCase();
    const gender = ['male', 'female', 'other'].includes(genderRaw) ? genderRaw : null;
    if (input.gender != null && String(input.gender).trim() !== '' && !gender) {
      return err('Cinsiyet gecersiz', 'api.hr.gender_invalid');
    }
    p.gender = gender;
    fields.push('gender = :gender');
  }
  if (input?.marital_status !== undefined) {
    const maritalRaw = input.marital_status == null ? '' : String(input.marital_status).trim().toLowerCase();
    const maritalStatus = ['single', 'married', 'divorced', 'widowed'].includes(maritalRaw) ? maritalRaw : null;
    if (input.marital_status != null && String(input.marital_status).trim() !== '' && !maritalStatus) {
      return err('Medeni durum gecersiz', 'api.hr.marital_invalid');
    }
    p.marital_status = maritalStatus;
    fields.push('marital_status = :marital_status');
  }

  if (input?.photo_path !== undefined) {
    const ph = input.photo_path == null || String(input.photo_path).trim() === '' ? null : String(input.photo_path).trim();
    fields.push('photo_path = :photo_path');
    p.photo_path = ph;
  }

  if (input?.country !== undefined) {
    const country =
      input.country == null || String(input.country).trim() === '' ? null : normalizeCountryCode(input.country);
    if (input.country != null && String(input.country).trim() !== '' && !country) {
      return err('Ulke gecersiz', 'api.hr.country_invalid');
    }
    fields.push('country = :country');
    p.country = country;
  }

  if (input?.region_or_city !== undefined) {
    const reg =
      input.region_or_city == null || String(input.region_or_city).trim() === '' ? null : toUpperTr(input.region_or_city);
    const effCountry =
      input.country !== undefined ? p.country : cur.country;
    if (reg && effCountry && !isValidRegionForCountry(effCountry, reg)) {
      return err('Il / bolge bu ulke icin gecersiz', 'api.hr.region_invalid');
    }
    fields.push('region_or_city = :region_or_city');
    p.region_or_city = reg;
  }

  if (input?.address_line !== undefined) {
    fields.push('address_line = :address_line');
    p.address_line =
      input.address_line == null || String(input.address_line).trim() === ''
        ? null
        : optionalNoteUpperTr(input.address_line);
  }

  if (input?.salary_currency != null) {
    const sc = String(input.salary_currency).toUpperCase() === 'USD' ? 'USD' : 'UZS';
    fields.push('salary_currency = :salary_currency');
    p.salary_currency = sc;
  }

  const salaryTouched = input?.salary_amount !== undefined || input?.official_salary_amount !== undefined;
  if (salaryTouched) {
    const nextTotal =
      input.salary_amount !== undefined ? parseMoney2(input.salary_amount) : parseMoney2(cur.salary_amount);
    const nextOfficial =
      input.official_salary_amount !== undefined
        ? parseMoney2(input.official_salary_amount)
        : parseMoney2(cur.official_salary_amount);
    if (nextTotal == null) return err('Toplam maas gecersiz', 'api.hr.salary_amount_invalid');
    if (nextOfficial == null) return err('Resmi maas gecersiz', 'api.hr.official_salary_invalid');
    if (nextOfficial > nextTotal) {
      return err('Resmi maas toplam maastan buyuk olamaz', 'api.hr.salary_official_exceeds_total');
    }
    const nextUnofficial = computeUnofficial(nextTotal, nextOfficial);
    fields.push('salary_amount = :salary_amount');
    fields.push('official_salary_amount = :official_salary_amount');
    fields.push('unofficial_salary_amount = :unofficial_salary_amount');
    p.salary_amount = nextTotal;
    p.official_salary_amount = nextOfficial;
    p.unofficial_salary_amount = nextUnofficial;
  }

  if (input?.phone !== undefined) {
    p.phone = input.phone == null || String(input.phone).trim() === '' ? null : String(input.phone).trim();
    fields.push('phone = :phone');
  }
  if (input?.phone_secondary !== undefined) {
    p.phone_secondary =
      input.phone_secondary == null || String(input.phone_secondary).trim() === '' ? null : String(input.phone_secondary).trim();
    fields.push('phone_secondary = :phone_secondary');
  }
  if (input?.identity_no !== undefined) {
    p.identity_no = input.identity_no == null || String(input.identity_no).trim() === '' ? null : toUpperTr(input.identity_no);
    fields.push('identity_no = :identity_no');
  }
  if (input?.passport_no !== undefined) {
    p.passport_no = input.passport_no == null || String(input.passport_no).trim() === '' ? null : toUpperTr(input.passport_no);
    fields.push('passport_no = :passport_no');
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
  if (input?.telegram_username !== undefined) {
    p.telegram_username = normalizeTelegramUsername(input.telegram_username);
    fields.push('telegram_username = :telegram_username');
  }
  if (input?.telegram_chat_id !== undefined) {
    p.telegram_chat_id = normalizeTelegramChatId(input.telegram_chat_id);
    fields.push('telegram_chat_id = :telegram_chat_id');
  }
  if (input?.telegram_notify_enabled !== undefined) {
    p.telegram_notify_enabled = normalizeTelegramNotifyEnabled(input.telegram_notify_enabled);
    fields.push('telegram_notify_enabled = :telegram_notify_enabled');
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE employees SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  return { ok: true };
}

async function updateEmployeePhoto(employeeId, relativePathUnderUploads) {
  const empId = parseId(employeeId);
  if (!empId) return err('Gecersiz personel', 'api.hr.employee_invalid');
  const rel = String(relativePathUnderUploads || '').replace(/\\/g, '/');
  if (!rel || rel.includes('..')) return err('Gecersiz dosya yolu', 'api.hr.photo_path_invalid');

  const [rows] = await pool.query('SELECT id, photo_path FROM employees WHERE id = :id LIMIT 1', { id: empId });
  if (!rows.length) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  const prev = rows[0].photo_path;
  await pool.query('UPDATE employees SET photo_path = :photo_path WHERE id = :id', { id: empId, photo_path: rel });
  if (prev && prev !== rel) safeUnlinkUpload(prev);
  return { ok: true, photo_path: rel };
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
  const sql = `SELECT a.id, a.employee_id, e.employee_no, e.first_name, e.last_name, e.full_name,
                      a.work_date, a.check_in_time, a.check_out_time,
                      a.work_status, a.overtime_hours, a.note, a.created_at, a.updated_at
               FROM employee_attendance a
               INNER JOIN employees e ON e.id = a.employee_id
               ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY a.work_date DESC, a.id DESC`;
  const [rows] = await pool.query(sql, p);
  rows.forEach((row) => {
    row.employee_name = formatEmployeeLabel(row);
  });
  return { attendance: rows };
}

async function createAttendance(input, actorId) {
  const employeeId = parseId(input?.employee_id);
  if (!employeeId) return err('Personel secin', 'api.hr.employee_required');
  const workDate = String(input?.work_date || '').trim();
  if (!workDate) return err('Tarih gerekli', 'api.hr.work_date_required');
  const wsCheck = await ensureAllowedCode(
    'hr_work_statuses',
    input?.work_status,
    'Calisma durumu gecersiz',
    'api.hr.work_status_invalid'
  );
  if (wsCheck && wsCheck.error) return wsCheck;
  const workStatus = wsCheck;

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

  const nextWorkStatus =
    input?.work_status !== undefined
      ? await ensureAllowedCode('hr_work_statuses', input.work_status, 'Calisma durumu gecersiz', 'api.hr.work_status_invalid')
      : current.work_status;
  if (nextWorkStatus && nextWorkStatus.error) return nextWorkStatus;

  const next = {
    employee_id: input?.employee_id !== undefined ? parseId(input.employee_id) : current.employee_id,
    work_date: input?.work_date !== undefined ? String(input.work_date || '').trim() : String(current.work_date || '').slice(0, 10),
    work_status: nextWorkStatus,
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

async function updateMonthlyAttendanceRow(id, input, actorId) {
  const attId = parseId(id);
  if (!attId) return err('Gecersiz puantaj kaydi', 'api.hr.attendance_invalid');
  const [rows] = await pool.query('SELECT id FROM employee_attendance WHERE id = :id LIMIT 1', { id: attId });
  if (!rows.length) return err('Puantaj kaydi bulunamadi', 'api.hr.attendance_not_found');

  const fields = [];
  const p = { id: attId, updated_by: actorId || null };

  if (input?.project_id !== undefined) {
    const pid = parseId(input.project_id);
    fields.push('project_id = :project_id');
    p.project_id = pid || null;
  }
  if (input?.work_status !== undefined) {
    const ws = await ensureAllowedCode('hr_work_statuses', input.work_status, 'Calisma durumu gecersiz', 'api.hr.work_status_invalid');
    if (ws && ws.error) return ws;
    fields.push('work_status = :work_status');
    p.work_status = ws;
  }
  if (input?.work_type !== undefined) {
    const wt = await ensureAllowedCode('hr_work_types', input.work_type, 'Is tipi gecersiz', 'api.hr.work_type_invalid');
    if (wt && wt.error) return wt;
    fields.push('work_type = :work_type');
    p.work_type = wt;
  }
  if (input?.total_hours !== undefined) {
    const th = Number(input.total_hours);
    if (!Number.isFinite(th) || th < 0) return err('Toplam saat gecersiz', 'api.hr.total_hours_invalid');
    fields.push('total_hours = :total_hours');
    p.total_hours = th;
  }
  if (input?.overtime_hours !== undefined) {
    const oh = Number(input.overtime_hours);
    if (!Number.isFinite(oh) || oh < 0) return err('Fazla mesai saati gecersiz', 'api.hr.overtime_invalid');
    fields.push('overtime_hours = :overtime_hours');
    p.overtime_hours = oh;
  }
  if (input?.note !== undefined) {
    fields.push('note = :note');
    p.note = optionalNoteUpperTr(input.note);
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');

  fields.push('updated_by = :updated_by');
  await pool.query(`UPDATE employee_attendance SET ${fields.join(', ')} WHERE id = :id`, p);
  return { ok: true };
}

async function listDailyAttendance(dateRaw, empFilters = {}) {
  const workDate = String(dateRaw || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return err('Tarih gecersiz', 'api.hr.work_date_required');
  const where = ['e.employment_status = \'active\''];
  const p = { work_date: workDate };
  const fErr = applyEmployeeAttendanceFilters(empFilters, where, p);
  if (fErr) return fErr;
  const [rows] = await pool.query(
    `SELECT e.id AS employee_id,
            e.employee_no,
            e.first_name,
            e.last_name,
            COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS full_name,
            e.department_id,
            d.name AS department_name,
            e.position_id,
            pz.name AS position_name,
            a.id AS attendance_id,
            a.project_id,
            prj.project_code,
            a.work_type,
            a.work_status,
            a.check_in_time,
            a.check_out_time,
            a.total_hours,
            a.overtime_hours,
            a.note
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN positions pz ON pz.id = e.position_id
     LEFT JOIN employee_attendance a ON a.employee_id = e.id AND a.work_date = :work_date
     LEFT JOIN projects prj ON prj.id = a.project_id
     WHERE ${where.join(' AND ')}
     ORDER BY e.first_name ASC, e.last_name ASC, e.full_name ASC`,
    p
  );
  rows.forEach((r) => {
    r.employee_display = formatEmployeeLabel(r);
  });
  return { date: workDate, rows, isLocked: await isAttendanceMonthLocked(monthKeyFromDate(workDate)) };
}

async function saveDailyAttendanceBulk({ workDate, entries } = {}, actorId) {
  const d = String(workDate || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return err('Tarih gecersiz', 'api.hr.work_date_required');
  if (await isAttendanceMonthLocked(monthKeyFromDate(d))) {
    return err('Ay kilitli, puantaj degistirilemez', 'api.hr.attendance_month_locked');
  }
  if (!Array.isArray(entries) || !entries.length) return err('Kayit satirlari gerekli', 'api.hr.daily_rows_required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let affected = 0;
    const allowedStatuses = await getAllowedCodes('hr_work_statuses', true);
    const allowedTypes = await getAllowedCodes('hr_work_types', true);
    for (const row of entries) {
      const employeeId = parseId(row?.employee_id);
      if (!employeeId) continue;
      const workStatus = normalizeWorkStatus(row?.work_status);
      if (!workStatus || !allowedStatuses.has(workStatus)) {
        await conn.rollback();
        return err('Calisma durumu gecersiz', 'api.hr.work_status_invalid');
      }
      const wtCandidate = normalizeWorkType(row?.work_type) || 'normal';
      if (!allowedTypes.has(wtCandidate)) {
        await conn.rollback();
        return err('Is tipi gecersiz', 'api.hr.work_type_invalid');
      }
      const workType = wtCandidate;
      const checkIn = normalizeTime(row?.check_in_time);
      const checkOut = normalizeTime(row?.check_out_time);
      const vErr = validateAttendanceRule(workStatus, checkIn, checkOut);
      if (vErr) {
        await conn.rollback();
        return vErr;
      }
      const totalHoursRaw = Number(row?.total_hours);
      const totalHours = Number.isFinite(totalHoursRaw) && totalHoursRaw >= 0 ? totalHoursRaw : computeTotalHours(checkIn, checkOut);
      const overtimeRaw = Number(row?.overtime_hours);
      const overtimeHours = Number.isFinite(overtimeRaw) && overtimeRaw >= 0 ? overtimeRaw : 0;
      const note = optionalNoteUpperTr(row?.note);
      const projectId = parseId(row?.project_id);
      await conn.query(
        `INSERT INTO employee_attendance
          (employee_id, work_date, project_id, work_type, check_in_time, check_out_time, work_status, total_hours, overtime_hours, note, created_by, updated_by)
         VALUES
          (:employee_id, :work_date, :project_id, :work_type, :check_in_time, :check_out_time, :work_status, :total_hours, :overtime_hours, :note, :created_by, :updated_by)
         ON DUPLICATE KEY UPDATE
           project_id = VALUES(project_id),
           work_type = VALUES(work_type),
           check_in_time = VALUES(check_in_time),
           check_out_time = VALUES(check_out_time),
           work_status = VALUES(work_status),
           total_hours = VALUES(total_hours),
           overtime_hours = VALUES(overtime_hours),
           note = VALUES(note),
           updated_by = VALUES(updated_by)`,
        {
          employee_id: employeeId,
          work_date: d,
          project_id: projectId,
          work_type: workType,
          check_in_time: checkIn,
          check_out_time: checkOut,
          work_status: workStatus,
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          note,
          created_by: actorId || null,
          updated_by: actorId || null,
        }
      );
      affected += 1;
    }
    await conn.commit();
    return { ok: true, affected };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listMonthlyAttendance({
  month,
  employeeId,
  projectId,
  nationality,
  country,
  region_or_city,
  department_id,
  position_id,
  search,
} = {}) {
  const mk = normalizeMonthKey(month);
  if (!mk) return err('Ay gecersiz', 'api.hr.month_required');
  const where = ["DATE_FORMAT(a.work_date, '%Y-%m') = :month_key"];
  const p = { month_key: mk };
  const eid = parseId(employeeId);
  if (eid) {
    where.push('a.employee_id = :employee_id');
    p.employee_id = eid;
  }
  const pid = parseId(projectId);
  if (pid) {
    where.push('a.project_id = :project_id');
    p.project_id = pid;
  }
  const fErr = applyEmployeeAttendanceFilters(
    { nationality, country, region_or_city, department_id, position_id, search },
    where,
    p
  );
  if (fErr) return fErr;
  const [rows] = await pool.query(
    `SELECT a.id, a.work_date, a.employee_id, e.employee_no, e.first_name, e.last_name,
            COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS full_name,
            a.project_id, prj.project_code, prj.name AS project_name, a.work_type, a.work_status,
            a.check_in_time, a.check_out_time, a.total_hours, a.overtime_hours, a.note
     FROM employee_attendance a
     INNER JOIN employees e ON e.id = a.employee_id
     LEFT JOIN projects prj ON prj.id = a.project_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.work_date ASC, e.first_name ASC, e.last_name ASC, e.full_name ASC`,
    p
  );
  rows.forEach((row) => {
    row.employee_name = formatEmployeeLabel(row);
  });
  const [summary] = await pool.query(
    `SELECT a.employee_id, e.employee_no, e.first_name, e.last_name,
            COALESCE(NULLIF(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')), ' '), e.full_name) AS full_name,
            SUM(a.total_hours) AS total_hours,
            SUM(a.overtime_hours) AS overtime_hours,
            SUM(CASE WHEN a.work_status = 'worked' THEN 1 ELSE 0 END) AS worked_days,
            SUM(CASE WHEN a.work_status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
            SUM(CASE WHEN a.work_status = 'leave' THEN 1 ELSE 0 END) AS leave_days,
            SUM(CASE WHEN a.work_status = 'sick_leave' THEN 1 ELSE 0 END) AS sick_leave_days,
            SUM(CASE WHEN a.work_status = 'half_day' THEN 1 ELSE 0 END) AS half_day_days,
            SUM(CASE WHEN a.work_status = 'overtime' THEN 1 ELSE 0 END) AS overtime_days
     FROM employee_attendance a
     INNER JOIN employees e ON e.id = a.employee_id
     WHERE ${where.join(' AND ')}
     GROUP BY a.employee_id, e.employee_no, e.first_name, e.last_name, e.full_name
     ORDER BY e.first_name ASC, e.last_name ASC, e.full_name ASC`,
    p
  );
  summary.forEach((row) => {
    row.employee_name = formatEmployeeLabel(row);
  });
  return { month: mk, rows, summary, isLocked: await isAttendanceMonthLocked(mk) };
}

async function listAttendanceLocks() {
  const [rows] = await pool.query(
    `SELECT l.id, l.month_key, l.is_locked, l.locked_at, l.unlocked_at, l.note,
            ul.username AS locked_by_username, uu.username AS unlocked_by_username
     FROM attendance_month_locks l
     LEFT JOIN users ul ON ul.id = l.locked_by
     LEFT JOIN users uu ON uu.id = l.unlocked_by
     ORDER BY l.month_key DESC`
  );
  return { locks: rows };
}

async function listAttendanceProjects() {
  const [rows] = await pool.query(
    `SELECT id, project_code, name
     FROM projects
     WHERE status = 'active'
     ORDER BY project_code ASC, id ASC`
  );
  return { projects: rows };
}

async function lockAttendanceMonth({ month, note } = {}, actorId) {
  const mk = normalizeMonthKey(month);
  if (!mk) return err('Ay gecersiz', 'api.hr.month_required');
  await pool.query(
    `INSERT INTO attendance_month_locks (month_key, is_locked, locked_at, locked_by, unlocked_at, unlocked_by, note)
     VALUES (:month_key, 1, NOW(), :actor_id, NULL, NULL, :note)
     ON DUPLICATE KEY UPDATE is_locked = 1, locked_at = NOW(), locked_by = :actor_id, unlocked_at = NULL, unlocked_by = NULL, note = :note`,
    { month_key: mk, actor_id: actorId || null, note: optionalNoteUpperTr(note) || null }
  );
  return { ok: true, month: mk, isLocked: true };
}

async function unlockAttendanceMonth({ month, note } = {}, actorId) {
  const mk = normalizeMonthKey(month);
  if (!mk) return err('Ay gecersiz', 'api.hr.month_required');
  await pool.query(
    `INSERT INTO attendance_month_locks (month_key, is_locked, locked_at, locked_by, unlocked_at, unlocked_by, note)
     VALUES (:month_key, 0, NOW(), NULL, NOW(), :actor_id, :note)
     ON DUPLICATE KEY UPDATE is_locked = 0, unlocked_at = NOW(), unlocked_by = :actor_id, note = :note`,
    { month_key: mk, actor_id: actorId || null, note: optionalNoteUpperTr(note) || null }
  );
  return { ok: true, month: mk, isLocked: false };
}

async function getHrSettingsBundle({ includeInactive = false } = {}) {
  const [settingRows] = await pool.query(
    'SELECT setting_key, setting_value FROM hr_settings WHERE setting_key IS NOT NULL ORDER BY setting_key ASC'
  );
  const settings = {};
  settingRows.forEach((r) => {
    settings[String(r.setting_key)] = r.setting_value;
  });
  const [workTypes] = await pool.query(
    `SELECT id, code, name, is_active, sort_order
     FROM hr_work_types
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY sort_order ASC, id ASC`
  );
  const [workStatuses] = await pool.query(
    `SELECT id, code, name, is_active, sort_order
     FROM hr_work_statuses
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY sort_order ASC, id ASC`
  );
  return { settings, workTypes, workStatuses };
}

async function saveHrSettingsBundle(input = {}) {
  const keys = Object.keys(input || {});
  if (!keys.length) return err('Ayar alanlari gerekli', 'api.hr.settings_required');
  for (const key of keys) {
    if (!HR_SETTING_KEYS.has(key)) return err('Gecersiz ayar anahtari', 'api.hr.settings_key_invalid');
    const normalized = validateHrSettingValue(key, input[key]);
    if (normalized == null) return err('Ayar degeri gecersiz', 'api.hr.settings_value_invalid');
    await pool.query(
      `INSERT INTO hr_settings (setting_key, setting_value)
       VALUES (:setting_key, :setting_value)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      { setting_key: key, setting_value: normalized }
    );
  }
  return { ok: true };
}

async function listWorkTypes({ includeInactive = false } = {}) {
  const [rows] = await pool.query(
    `SELECT id, code, name, is_active, sort_order
     FROM hr_work_types
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY sort_order ASC, id ASC`
  );
  return { workTypes: rows };
}

async function createWorkType(input = {}) {
  const code = normalizeCode(input?.code);
  const name = toUpperTr(input?.name);
  const sortOrder = parseIntSafe(input?.sort_order) ?? 100;
  if (!code) return err('Is tipi kodu gerekli', 'api.hr.work_type_code_required');
  if (!name) return err('Is tipi adi gerekli', 'api.hr.work_type_name_required');
  const [r] = await pool.query(
    'INSERT INTO hr_work_types (code, name, is_active, sort_order) VALUES (:code, :name, :is_active, :sort_order)',
    { code, name, is_active: input?.is_active === 0 ? 0 : 1, sort_order: sortOrder }
  );
  return { id: r.insertId };
}

async function updateWorkType(id, input = {}) {
  const itemId = parseId(id);
  if (!itemId) return err('Gecersiz is tipi', 'api.hr.work_type_invalid');
  const fields = [];
  const p = { id: itemId };
  if (input?.code !== undefined) {
    const code = normalizeCode(input.code);
    if (!code) return err('Is tipi kodu gerekli', 'api.hr.work_type_code_required');
    fields.push('code = :code');
    p.code = code;
  }
  if (input?.name !== undefined) {
    const name = toUpperTr(input.name);
    if (!name) return err('Is tipi adi gerekli', 'api.hr.work_type_name_required');
    fields.push('name = :name');
    p.name = name;
  }
  if (input?.is_active !== undefined) {
    fields.push('is_active = :is_active');
    p.is_active = input.is_active ? 1 : 0;
  }
  if (input?.sort_order !== undefined) {
    const sortOrder = parseIntSafe(input.sort_order);
    if (sortOrder == null) return err('Sira degeri gecersiz', 'api.hr.sort_order_invalid');
    fields.push('sort_order = :sort_order');
    p.sort_order = sortOrder;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE hr_work_types SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Is tipi bulunamadi', 'api.hr.work_type_not_found');
  return { ok: true };
}

async function deleteWorkType(id) {
  const itemId = parseId(id);
  if (!itemId) return err('Gecersiz is tipi', 'api.hr.work_type_invalid');
  const [rows] = await pool.query('SELECT code FROM hr_work_types WHERE id = :id LIMIT 1', { id: itemId });
  if (!rows.length) return err('Is tipi bulunamadi', 'api.hr.work_type_not_found');
  const code = String(rows[0].code || '').trim().toLowerCase();
  const [usage] = await pool.query('SELECT COUNT(*) AS c FROM employee_attendance WHERE work_type = :code', { code });
  if (Number(usage[0]?.c || 0) > 0) {
    return err('Kullanimda olan is tipi silinemez', 'api.hr.work_type_in_use');
  }
  await pool.query('DELETE FROM hr_work_types WHERE id = :id', { id: itemId });
  return { ok: true };
}

async function listWorkStatuses({ includeInactive = false } = {}) {
  const [rows] = await pool.query(
    `SELECT id, code, name, is_active, sort_order
     FROM hr_work_statuses
     ${includeInactive ? '' : 'WHERE is_active = 1'}
     ORDER BY sort_order ASC, id ASC`
  );
  return { workStatuses: rows };
}

async function createWorkStatus(input = {}) {
  const code = normalizeCode(input?.code);
  const name = toUpperTr(input?.name);
  const sortOrder = parseIntSafe(input?.sort_order) ?? 100;
  if (!code) return err('Calisma durumu kodu gerekli', 'api.hr.work_status_code_required');
  if (!name) return err('Calisma durumu adi gerekli', 'api.hr.work_status_name_required');
  const [r] = await pool.query(
    'INSERT INTO hr_work_statuses (code, name, is_active, sort_order) VALUES (:code, :name, :is_active, :sort_order)',
    { code, name, is_active: input?.is_active === 0 ? 0 : 1, sort_order: sortOrder }
  );
  return { id: r.insertId };
}

async function updateWorkStatus(id, input = {}) {
  const itemId = parseId(id);
  if (!itemId) return err('Gecersiz calisma durumu', 'api.hr.work_status_invalid');
  const fields = [];
  const p = { id: itemId };
  if (input?.code !== undefined) {
    const code = normalizeCode(input.code);
    if (!code) return err('Calisma durumu kodu gerekli', 'api.hr.work_status_code_required');
    fields.push('code = :code');
    p.code = code;
  }
  if (input?.name !== undefined) {
    const name = toUpperTr(input.name);
    if (!name) return err('Calisma durumu adi gerekli', 'api.hr.work_status_name_required');
    fields.push('name = :name');
    p.name = name;
  }
  if (input?.is_active !== undefined) {
    fields.push('is_active = :is_active');
    p.is_active = input.is_active ? 1 : 0;
  }
  if (input?.sort_order !== undefined) {
    const sortOrder = parseIntSafe(input.sort_order);
    if (sortOrder == null) return err('Sira degeri gecersiz', 'api.hr.sort_order_invalid');
    fields.push('sort_order = :sort_order');
    p.sort_order = sortOrder;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [r] = await pool.query(`UPDATE hr_work_statuses SET ${fields.join(', ')} WHERE id = :id`, p);
  if (!r.affectedRows) return err('Calisma durumu bulunamadi', 'api.hr.work_status_not_found');
  return { ok: true };
}

async function deleteWorkStatus(id) {
  const itemId = parseId(id);
  if (!itemId) return err('Gecersiz calisma durumu', 'api.hr.work_status_invalid');
  const [rows] = await pool.query('SELECT code FROM hr_work_statuses WHERE id = :id LIMIT 1', { id: itemId });
  if (!rows.length) return err('Calisma durumu bulunamadi', 'api.hr.work_status_not_found');
  const code = String(rows[0].code || '').trim().toLowerCase();
  const [usage] = await pool.query('SELECT COUNT(*) AS c FROM employee_attendance WHERE work_status = :code', { code });
  if (Number(usage[0]?.c || 0) > 0) {
    return err('Kullanimda olan durum silinemez', 'api.hr.work_status_in_use');
  }
  await pool.query('DELETE FROM hr_work_statuses WHERE id = :id', { id: itemId });
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
  updateEmployeePhoto,
  listAssignableUsers,
  listAttendance,
  createAttendance,
  updateAttendance,
  updateMonthlyAttendanceRow,
  listDailyAttendance,
  saveDailyAttendanceBulk,
  listMonthlyAttendance,
  listAttendanceLocks,
  listAttendanceProjects,
  lockAttendanceMonth,
  unlockAttendanceMonth,
  getHrSettingsBundle,
  saveHrSettingsBundle,
  listWorkTypes,
  createWorkType,
  updateWorkType,
  deleteWorkType,
  listWorkStatuses,
  createWorkStatus,
  updateWorkStatus,
  deleteWorkStatus,
};
