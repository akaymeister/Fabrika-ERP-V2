const fs = require('fs');
const { jsonOk, jsonError } = require('../utils/apiResponse');
const { logActivity } = require('../services/activityLogService');
const { parseWorkbook, PRICE_USD_KEYS, PRICE_UZS_KEYS } = require('../services/projectBoqImportService');
const { userHasPermission } = require('../services/accessService');
const {
  listProjectsForControl,
  createBoqUpload,
  listBoqRevisions,
  getRevisionDetail,
  patchRevision,
  softDeleteRevision,
  createWorkItem,
  updateWorkItem,
  softDeleteWorkItem,
  assignWorkItem,
  clearWorkItemAssignment,
  createColumn,
  updateColumn,
  listAssignableEmployees,
  listDepartmentTasksByWorkItem,
  listWorkItemHistory,
  ensureDefaultDepartmentTasks,
  upsertDepartmentTask,
} = require('../services/projectControlService');

function validationOut(out) {
  return jsonError('VALIDATION', out.error, null, out.messageKey);
}

function touchesPriceFields(payload = {}) {
  const dyn = payload && payload.dynamic_data_json && typeof payload.dynamic_data_json === 'object' ? payload.dynamic_data_json : null;
  if (!dyn) return false;
  const keys = Object.keys(dyn);
  return keys.some((k) => PRICE_USD_KEYS.has(k) || PRICE_UZS_KEYS.has(k));
}

function decodeUploadedFilename(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'boq.xlsx';
  try {
    // Multer can expose latin1-decoded UTF-8 names on Windows.
    const fixed = Buffer.from(raw, 'latin1').toString('utf8').trim();
    return fixed || raw;
  } catch {
    return raw;
  }
}

async function getProjects(_req, res) {
  const rows = await listProjectsForControl();
  return res.json(jsonOk({ projects: rows }));
}

async function postBoq(req, res) {
  if (!req.file || !req.file.path) {
    return res.status(400).json(jsonError('VALIDATION', 'Excel dosyasi gerekli', null, 'api.project_control.import_file_required'));
  }
  const b = req.body || {};
  let fileBuffer = null;
  try {
    fileBuffer = await fs.promises.readFile(req.file.path);
  } catch (_e) {
    return res.status(400).json(jsonError('IO', 'Dosya okunamadi', null, 'api.project_control.import_invalid_file'));
  }
  const parsed = await parseWorkbook(fileBuffer);
  if (parsed.error) {
    return res.status(400).json(validationOut(parsed));
  }
  const out = await createBoqUpload({
    projectId: b.projectId,
    documentName: b.documentName,
    disciplineType: b.disciplineType,
    revisionNote: b.revisionNote,
    originalFilename: decodeUploadedFilename(req.file.originalname),
    storedPath: req.file.path,
    uploadedBy: req.session?.user?.id || null,
    parsedWorkbook: parsed,
  });
  if (out.error) {
    return res.status(400).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'CREATE',
    module_name: 'projects',
    table_name: 'project_boq_revisions',
    record_id: out.revisionId,
    new_data: out,
    description: 'Project control BOQ yüklendi',
  });
  return res.status(201).json(jsonOk(out));
}

async function getBoq(req, res) {
  const rows = await listBoqRevisions({ projectId: req.query?.projectId });
  return res.json(jsonOk({ revisions: rows }));
}

async function getBoqDetail(req, res) {
  const out = await getRevisionDetail({
    revisionId: req.params.revisionId,
    viewer: req.session?.user || null,
    limit: req.query?.limit,
    offset: req.query?.offset,
  });
  if (out.error) {
    const status = out.messageKey === 'api.project_control.revision_not_found' ? 404 : 400;
    return res.status(status).json(validationOut(out));
  }
  return res.json(jsonOk(out));
}

async function patchBoq(req, res) {
  if (req.body?.is_active_revision === true || Number(req.body?.is_active_revision) === 1) {
    const ok = await userHasPermission(
      req.session?.user?.id,
      req.session?.user?.role?.slug,
      'projects.control.revision.activate'
    );
    if (!ok) {
      return res.status(403).json(jsonError('FORBIDDEN', 'Revizyon aktiflestirme yetkisi yok', null, 'api.permission.denied'));
    }
  }
  const out = await patchRevision(req.params.revisionId, req.body || {});
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'projects',
    table_name: 'project_boq_revisions',
    record_id: req.params.revisionId,
    new_data: req.body || {},
    description: 'Project control BOQ revizyon güncellendi',
  });
  return res.json(jsonOk(out));
}

async function deleteBoq(req, res) {
  const out = await softDeleteRevision(req.params.revisionId);
  if (out.error) {
    const status = out.messageKey === 'api.project_control.revision_not_found' ? 404 : 400;
    return res.status(status).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'DELETE',
    module_name: 'projects',
    table_name: 'project_boq_revisions',
    record_id: req.params.revisionId,
    description: 'Project control BOQ revizyonu silindi (soft delete)',
  });
  return res.json(jsonOk(out));
}

async function postWorkItem(req, res) {
  if (touchesPriceFields(req.body || {})) {
    const ok = await userHasPermission(req.session?.user?.id, req.session?.user?.role?.slug, 'projects.control.price.edit');
    if (!ok) {
      return res.status(403).json(jsonError('FORBIDDEN', 'Fiyat alanları için yetki yok', null, 'api.permission.denied'));
    }
  }
  const out = await createWorkItem(req.body || {}, req.session?.user?.id || null);
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'CREATE',
    module_name: 'projects',
    table_name: 'project_work_items',
    record_id: out.id,
    new_data: req.body || {},
    description: 'Project control work item eklendi',
  });
  return res.status(201).json(jsonOk(out));
}

async function patchWorkItem(req, res) {
  if (touchesPriceFields(req.body || {})) {
    const ok = await userHasPermission(req.session?.user?.id, req.session?.user?.role?.slug, 'projects.control.price.edit');
    if (!ok) {
      return res.status(403).json(jsonError('FORBIDDEN', 'Fiyat alanları için yetki yok', null, 'api.permission.denied'));
    }
  }
  const out = await updateWorkItem(req.params.id, req.body || {}, req.session?.user?.id || null);
  if (out.error) {
    const status = out.messageKey === 'api.project_control.work_item_not_found' ? 404 : 400;
    return res.status(status).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'projects',
    table_name: 'project_work_items',
    record_id: req.params.id,
    new_data: req.body || {},
    description: 'Project control work item güncellendi',
  });
  return res.json(jsonOk(out));
}

async function deleteWorkItem(req, res) {
  const out = await softDeleteWorkItem(req.params.id, req.session?.user?.id || null);
  if (out.error) {
    const status = out.messageKey === 'api.project_control.work_item_not_found' ? 404 : 400;
    return res.status(status).json(validationOut(out));
  }
  await logActivity(req, {
    action_type: 'DELETE',
    module_name: 'projects',
    table_name: 'project_work_items',
    record_id: req.params.id,
    description: 'Project control work item silindi (soft delete)',
  });
  return res.json(jsonOk(out));
}

async function postAssign(req, res) {
  const out = await assignWorkItem(req.params.id, req.body?.employeeId, req.session?.user?.id || null);
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'projects',
    table_name: 'project_work_items',
    record_id: req.params.id,
    new_data: { employeeId: req.body?.employeeId },
    description: 'Project control work item personel atandi',
  });
  return res.json(jsonOk(out));
}

async function deleteAssign(req, res) {
  const out = await clearWorkItemAssignment(req.params.id, req.session?.user?.id || null);
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'projects',
    table_name: 'project_work_items',
    record_id: req.params.id,
    description: 'Project control work item personel atamasi kaldirildi',
  });
  return res.json(jsonOk(out));
}

async function postColumn(req, res) {
  if (req.body?.is_price_usd || req.body?.is_price_uzs) {
    const ok = await userHasPermission(req.session?.user?.id, req.session?.user?.role?.slug, 'projects.control.price.edit');
    if (!ok) {
      return res.status(403).json(jsonError('FORBIDDEN', 'Fiyat kolonları için yetki yok', null, 'api.permission.denied'));
    }
  }
  const out = await createColumn(req.body || {});
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'CREATE',
    module_name: 'projects',
    table_name: 'project_boq_columns',
    record_id: out.id,
    new_data: req.body || {},
    description: 'Project control kolon eklendi',
  });
  return res.status(201).json(jsonOk(out));
}

async function patchColumn(req, res) {
  if (req.body?.is_price_usd != null || req.body?.is_price_uzs != null) {
    const ok = await userHasPermission(req.session?.user?.id, req.session?.user?.role?.slug, 'projects.control.price.edit');
    if (!ok) {
      return res.status(403).json(jsonError('FORBIDDEN', 'Fiyat kolonları için yetki yok', null, 'api.permission.denied'));
    }
  }
  const out = await updateColumn(req.params.id, req.body || {});
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'projects',
    table_name: 'project_boq_columns',
    record_id: req.params.id,
    new_data: req.body || {},
    description: 'Project control kolon güncellendi',
  });
  return res.json(jsonOk(out));
}

async function getAssignableEmployees(req, res) {
  const out = await listAssignableEmployees(
    {
      departmentId: req.query?.departmentId,
      positionId: req.query?.positionId,
      search: req.query?.search,
    },
    req.session?.user || null
  );
  return res.json(jsonOk(out));
}

async function getWorkItemDepartmentTasks(req, res) {
  const out = await listDepartmentTasksByWorkItem(req.params.id);
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function getWorkItemHistory(req, res) {
  const out = await listWorkItemHistory(req.params.id, req.query?.limit);
  if (out.error) return res.status(400).json(validationOut(out));
  return res.json(jsonOk(out));
}

async function postWorkItemDepartmentTaskInit(req, res) {
  const out = await ensureDefaultDepartmentTasks(req.params.id, req.session?.user?.id || null);
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'CREATE',
    module_name: 'projects',
    table_name: 'project_work_item_department_tasks',
    record_id: req.params.id,
    new_data: out,
    description: 'Project control departman gorevleri baslatildi',
  });
  return res.status(201).json(jsonOk(out));
}

async function postWorkItemDepartmentTask(req, res) {
  const out = await upsertDepartmentTask(req.params.id, req.body || {}, req.session?.user?.id || null);
  if (out.error) return res.status(400).json(validationOut(out));
  await logActivity(req, {
    action_type: 'UPDATE',
    module_name: 'projects',
    table_name: 'project_work_item_department_tasks',
    record_id: out.id,
    new_data: req.body || {},
    description: 'Project control departman gorevi guncellendi',
  });
  return res.json(jsonOk(out));
}

module.exports = {
  getProjects,
  postBoq,
  getBoq,
  getBoqDetail,
  patchBoq,
  deleteBoq,
  postWorkItem,
  patchWorkItem,
  deleteWorkItem,
  postAssign,
  deleteAssign,
  postColumn,
  patchColumn,
  getAssignableEmployees,
  getWorkItemDepartmentTasks,
  getWorkItemHistory,
  postWorkItemDepartmentTaskInit,
  postWorkItemDepartmentTask,
};
