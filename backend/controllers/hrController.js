const { jsonOk, jsonError } = require('../utils/apiResponse');
const {
  getScope,
  listDepartments,
  createDepartment,
  listPositions,
  createPosition,
  listEmployees,
  createEmployee,
  listAttendance,
  createAttendance,
} = require('../services/hrService');
const { logActivity } = require('../services/activityLogService');

function validationOut(out) {
  return jsonError('VALIDATION', out.error, null, out.messageKey);
}

async function getHrScope(_req, res) {
  const out = await getScope();
  return res.json(jsonOk(out));
}

async function getDepartments(_req, res) {
  const out = await listDepartments();
  return res.json(jsonOk(out));
}

async function postDepartment(req, res) {
  try {
    const out = await createDepartment(req.body || {});
    if (out.error) return res.status(400).json(validationOut(out));
    await logActivity(req, {
      action_type: 'CREATE',
      module_name: 'hr',
      table_name: 'departments',
      record_id: out.id,
      new_data: req.body || {},
      description: 'Departman eklendi',
    });
    return res.status(201).json(jsonOk(out));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(jsonError('VALIDATION', 'Kod zaten mevcut', null, 'api.hr.department_code_exists'));
    }
    throw e;
  }
}

async function getPositions(_req, res) {
  const out = await listPositions();
  return res.json(jsonOk(out));
}

async function postPosition(req, res) {
  try {
    const out = await createPosition(req.body || {});
    if (out.error) return res.status(400).json(validationOut(out));
    await logActivity(req, {
      action_type: 'CREATE',
      module_name: 'hr',
      table_name: 'positions',
      record_id: out.id,
      new_data: req.body || {},
      description: 'Pozisyon eklendi',
    });
    return res.status(201).json(jsonOk(out));
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json(jsonError('VALIDATION', 'Departman bulunamadi', null, 'api.hr.department_not_found'));
    }
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(jsonError('VALIDATION', 'Kod zaten mevcut', null, 'api.hr.position_code_exists'));
    }
    throw e;
  }
}

async function getEmployees(req, res) {
  const out = await listEmployees({
    status: req.query?.status,
    search: req.query?.search,
  });
  return res.json(jsonOk(out));
}

async function postEmployee(req, res) {
  try {
    const out = await createEmployee(req.body || {});
    if (out.error) return res.status(400).json(validationOut(out));
    await logActivity(req, {
      action_type: 'CREATE',
      module_name: 'hr',
      table_name: 'employees',
      record_id: out.id,
      new_data: req.body || {},
      description: 'Personel eklendi',
    });
    return res.status(201).json(jsonOk(out));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(
        jsonError('VALIDATION', 'Personel numarasi veya kullanici baglantisi tekrar ediyor', null, 'api.hr.employee_duplicate')
      );
    }
    if (e.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json(jsonError('VALIDATION', 'Iliskili kayit bulunamadi', null, 'api.hr.reference_not_found'));
    }
    throw e;
  }
}

async function getAttendance(req, res) {
  const out = await listAttendance({
    employeeId: req.query?.employeeId,
    status: req.query?.status,
    from: req.query?.from,
    to: req.query?.to,
  });
  return res.json(jsonOk(out));
}

async function postAttendance(req, res) {
  try {
    const out = await createAttendance(req.body || {}, req.session?.user?.id || null);
    if (out.error) return res.status(400).json(validationOut(out));
    await logActivity(req, {
      action_type: 'CREATE',
      module_name: 'hr',
      table_name: 'employee_attendance',
      record_id: out.id,
      new_data: req.body || {},
      description: 'Puantaj kaydi eklendi',
    });
    return res.status(201).json(jsonOk(out));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(jsonError('VALIDATION', 'Ayni personel ve gun icin kayit var', null, 'api.hr.attendance_duplicate'));
    }
    if (e.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json(jsonError('VALIDATION', 'Personel bulunamadi', null, 'api.hr.employee_not_found'));
    }
    throw e;
  }
}

module.exports = {
  getHrScope,
  getDepartments,
  postDepartment,
  getPositions,
  postPosition,
  getEmployees,
  postEmployee,
  getAttendance,
  postAttendance,
};
