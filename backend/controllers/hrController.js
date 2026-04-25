const { jsonOk, jsonError } = require('../utils/apiResponse');
const {
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

async function patchDepartment(req, res) {
  const id = parseInt(String(req.params.id), 10);
  try {
    const out = await updateDepartment(id, req.body || {});
    if (out.error) return res.status(400).json(validationOut(out));
    await logActivity(req, {
      action_type: 'UPDATE',
      module_name: 'hr',
      table_name: 'departments',
      record_id: id,
      new_data: req.body || {},
      description: 'Departman guncellendi',
    });
    return res.json(jsonOk(out));
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

async function patchPosition(req, res) {
  const id = parseInt(String(req.params.id), 10);
  try {
    const out = await updatePosition(id, req.body || {});
    if (out.error) return res.status(400).json(validationOut(out));
    await logActivity(req, {
      action_type: 'UPDATE',
      module_name: 'hr',
      table_name: 'positions',
      record_id: id,
      new_data: req.body || {},
      description: 'Pozisyon guncellendi',
    });
    return res.json(jsonOk(out));
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

async function getEmployee(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const out = await getEmployeeById(id);
  if (out.error) {
    const status = out.messageKey === 'api.hr.employee_not_found' ? 404 : 400;
    return res.status(status).json(validationOut(out));
  }
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

async function patchEmployee(req, res) {
  const id = parseInt(String(req.params.id), 10);
  try {
    const out = await updateEmployee(id, req.body || {});
    if (out.error) return res.status(400).json(validationOut(out));
    await logActivity(req, {
      action_type: 'UPDATE',
      module_name: 'hr',
      table_name: 'employees',
      record_id: id,
      new_data: req.body || {},
      description: 'Personel guncellendi',
    });
    return res.json(jsonOk(out));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(
        jsonError('VALIDATION', 'Ayni kullanici baska personele bagli', null, 'api.hr.employee_duplicate')
      );
    }
    if (e.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json(jsonError('VALIDATION', 'Iliskili kayit bulunamadi', null, 'api.hr.reference_not_found'));
    }
    throw e;
  }
}

async function getAssignableUsers(req, res) {
  const out = await listAssignableUsers(req.query?.employeeId);
  return res.json(jsonOk(out));
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

async function patchAttendance(req, res) {
  const id = parseInt(String(req.params.id), 10);
  try {
    const out = await updateAttendance(id, req.body || {}, req.session?.user?.id || null);
    if (out.error) return res.status(400).json(validationOut(out));
    await logActivity(req, {
      action_type: 'UPDATE',
      module_name: 'hr',
      table_name: 'employee_attendance',
      record_id: id,
      new_data: req.body || {},
      description: 'Puantaj kaydi guncellendi',
    });
    return res.json(jsonOk(out));
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
  patchDepartment,
  getPositions,
  postPosition,
  patchPosition,
  getEmployees,
  getEmployee,
  postEmployee,
  patchEmployee,
  getAssignableUsers,
  getAttendance,
  postAttendance,
  patchAttendance,
};
