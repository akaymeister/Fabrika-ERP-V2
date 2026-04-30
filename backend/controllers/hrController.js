const fs = require('fs');
const path = require('path');
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
  listCompensationEmployees,
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
  summarizeDailyAttendance,
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
} = require('../services/hrService');
const { logActivity } = require('../services/activityLogService');
const { toUpperTr } = require('../utils/textNormalize');
const { scheduleNotifyEmployeeCreatedTelegram } = require('../services/employeeTelegramWelcomeService');

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
    nationality: req.query?.nationality,
    country: req.query?.country,
    region_or_city: req.query?.region,
    department_id: req.query?.departmentId,
    position_id: req.query?.positionId,
  }, req.session?.user || null);
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function getCompensationEmployees(req, res) {
  const out = await listCompensationEmployees(
    {
      status: req.query?.status,
      search: req.query?.search,
      nationality: req.query?.nationality,
      country: req.query?.country,
      region_or_city: req.query?.region,
      department_id: req.query?.departmentId,
      position_id: req.query?.positionId,
    },
    req.session?.user || null
  );
  if (out.error) return res.status(400).json(validationOut(out));
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
    const body = req.body || {};
    const out = await createEmployee({
      ...body,
      first_name: body.first_name,
      last_name: body.last_name,
    });
    if (out.error) return res.status(400).json(validationOut(out));
    await logActivity(req, {
      action_type: 'CREATE',
      module_name: 'hr',
      table_name: 'employees',
      record_id: out.id,
      new_data: req.body || {},
      description: 'Personel eklendi',
    });
    scheduleNotifyEmployeeCreatedTelegram(req, out.id, { erpUserCreated: false });
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
    const body = req.body || {};
    const out = await updateEmployee(id, {
      ...body,
      first_name: body.first_name,
      last_name: body.last_name,
    });
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

async function postEmployeePhoto(req, res) {
  const id = parseInt(String(req.params.id), 10);
  if (!req.file) {
    return res.status(400).json(jsonError('VALIDATION', 'Fotograf dosyasi gerekli', null, 'api.hr.photo_required'));
  }
  try {
    const rel = path.join('hr-employees', req.file.filename).replace(/\\/g, '/');
    const out = await updateEmployeePhoto(id, rel);
    if (out.error) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        /* ignore */
      }
      const status = out.messageKey === 'api.hr.employee_not_found' ? 404 : 400;
      return res.status(status).json(validationOut(out));
    }
    await logActivity(req, {
      action_type: 'UPDATE',
      module_name: 'hr',
      table_name: 'employees',
      record_id: id,
      new_data: { photo_path: rel },
      description: 'Personel fotografi yuklendi',
    });
    return res.json(jsonOk(out));
  } catch (e) {
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {
      /* ignore */
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

async function getDailyAttendanceSummary(req, res) {
  const out = await summarizeDailyAttendance(req.query?.date, {
    nationality: req.query?.nationality,
    country: req.query?.country,
    region_or_city: req.query?.region,
    department_id: req.query?.departmentId,
    position_id: req.query?.positionId,
    search: req.query?.search,
  });
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function getDailyAttendance(req, res) {
  const out = await listDailyAttendance(req.query?.date, {
    nationality: req.query?.nationality,
    country: req.query?.country,
    region_or_city: req.query?.region,
    department_id: req.query?.departmentId,
    position_id: req.query?.positionId,
    search: req.query?.search,
  });
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function putDailyAttendanceBulk(req, res) {
  try {
    const out = await saveDailyAttendanceBulk(req.body || {}, req.session?.user?.id || null);
    if (out.error) return res.status(400).json(validationOut(out));
    const body = req.body || {};
    const editReasonRaw = String(body.editReason || '').trim();
    const editReasonNorm = editReasonRaw ? toUpperTr(editReasonRaw) : '';
    await logActivity(req, {
      action_type: 'UPSERT',
      module_name: 'hr',
      table_name: 'employee_attendance',
      new_data: { ...body, editReason: editReasonNorm || undefined },
      description: editReasonNorm
        ? `Gunluk toplu puantaj kaydi | Duzenleme aciklamasi: ${editReasonNorm.slice(0, 500)}`
        : 'Gunluk toplu puantaj kaydi',
    });
    return res.json(jsonOk(out));
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json(jsonError('VALIDATION', 'Iliskili kayit bulunamadi', null, 'api.hr.reference_not_found'));
    }
    throw e;
  }
}

async function getMonthlyAttendance(req, res) {
  const out = await listMonthlyAttendance({
    month: req.query?.month,
    employeeId: req.query?.employeeId,
    projectId: req.query?.projectId,
    nationality: req.query?.nationality,
    country: req.query?.country,
    region_or_city: req.query?.region,
    department_id: req.query?.departmentId,
    position_id: req.query?.positionId,
    search: req.query?.search,
  }, req.session?.user || null);
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function patchMonthlyAttendanceRow(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const out = await updateMonthlyAttendanceRow(id, req.body || {}, req.session?.user?.id || null);
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function getAttendanceLocks(_req, res) {
  const out = await listAttendanceLocks();
  return res.json(jsonOk(out));
}

async function getAttendanceProjects(_req, res) {
  const out = await listAttendanceProjects();
  return res.json(jsonOk(out));
}

async function postAttendanceLock(req, res) {
  const out = await lockAttendanceMonth(req.body || {}, req.session?.user?.id || null);
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'hr',
    table_name: 'attendance_month_locks',
    new_data: req.body || {},
    description: 'Puantaj ay kilidi kapatildi',
  });
  return res.json(jsonOk(out));
}

async function postAttendanceUnlock(req, res) {
  const out = await unlockAttendanceMonth(req.body || {}, req.session?.user?.id || null);
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'hr',
    table_name: 'attendance_month_locks',
    new_data: req.body || {},
    description: 'Puantaj ay kilidi acildi',
  });
  return res.json(jsonOk(out));
}

async function getHrSettings(req, res) {
  const out = await getHrSettingsBundle({
    includeInactive: req.query?.includeInactive === '1',
  });
  return res.json(jsonOk(out));
}

async function putHrSettings(req, res) {
  const out = await saveHrSettingsBundle(req.body || {});
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'hr',
    table_name: 'hr_settings',
    new_data: req.body || {},
    description: 'IK ayarlari guncellendi',
  });
  return res.json(jsonOk(out));
}

async function getWorkTypes(req, res) {
  const out = await listWorkTypes({ includeInactive: req.query?.includeInactive === '1' });
  return res.json(jsonOk(out));
}

async function postWorkType(req, res) {
  const out = await createWorkType(req.body || {});
  if (out.error) return res.status(400).json(validationOut(out));
  return res.status(201).json(jsonOk(out));
}

async function patchWorkType(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const out = await updateWorkType(id, req.body || {});
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function removeWorkType(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const out = await deleteWorkType(id);
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function getWorkStatuses(req, res) {
  const out = await listWorkStatuses({ includeInactive: req.query?.includeInactive === '1' });
  return res.json(jsonOk(out));
}

async function postWorkStatus(req, res) {
  const out = await createWorkStatus(req.body || {});
  if (out.error) return res.status(400).json(validationOut(out));
  return res.status(201).json(jsonOk(out));
}

async function patchWorkStatus(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const out = await updateWorkStatus(id, req.body || {});
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function removeWorkStatus(req, res) {
  const id = parseInt(String(req.params.id), 10);
  const out = await deleteWorkStatus(id);
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
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
  getCompensationEmployees,
  getEmployee,
  postEmployee,
  patchEmployee,
  postEmployeePhoto,
  getAssignableUsers,
  getAttendance,
  postAttendance,
  patchAttendance,
  getDailyAttendanceSummary,
  getDailyAttendance,
  putDailyAttendanceBulk,
  getMonthlyAttendance,
  patchMonthlyAttendanceRow,
  getAttendanceLocks,
  getAttendanceProjects,
  postAttendanceLock,
  postAttendanceUnlock,
  getHrSettings,
  putHrSettings,
  getWorkTypes,
  postWorkType,
  patchWorkType,
  removeWorkType,
  getWorkStatuses,
  postWorkStatus,
  patchWorkStatus,
  removeWorkStatus,
};
