const { listProjects, createProject, updateProject, setProjectStatus, deleteProject } = require('../services/projectService');
const { jsonOk, jsonError } = require('../utils/apiResponse');

function validationOut(out) {
  return jsonError('VALIDATION', out.error, null, out.messageKey);
}

function parseId(raw) {
  const id = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(id) || id < 1) {
    return null;
  }
  return id;
}

async function getProjects(_req, res) {
  try {
    const rows = await listProjects();
    return res.json(jsonOk({ projects: rows }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getProjects]', e);
    return res.status(500).json(jsonError('DB', e.message || 'DB hatası', null, 'api.error.unknown'));
  }
}

async function postProject(req, res) {
  const b = req.body || {};
  const out = await createProject({
    name: b.name ?? b.projectName,
    shortName: b.shortName ?? b.short_name ?? b.shortCode,
  });
  if (out.error) {
    const st =
      out.messageKey === 'api.project.migration' || out.messageKey === 'api.project.code_failed' ? 500 : 400;
    return res.status(st).json(validationOut(out));
  }
  return res
    .status(201)
    .json(jsonOk({ id: out.id, projectCode: out.projectCode, name: out.name, shortCode: out.shortCode }));
}

async function putProject(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.project.invalid_id'));
  }
  const b = req.body || {};
  const out = await updateProject(id, { name: b.name ?? b.projectName });
  if (out.error) {
    const st = out.messageKey === 'api.project.migration' ? 500 : out.messageKey === 'api.project.not_found' ? 404 : 400;
    return res.status(st).json(validationOut(out));
  }
  return res.json(jsonOk({ id: out.id, name: out.name }));
}

async function patchProject(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.project.invalid_id'));
  }
  const b = req.body || {};
  if (b.status == null) {
    return res.status(400).json(jsonError('VALIDATION', 'status gerekli', null, 'api.project.status_required'));
  }
  const out = await setProjectStatus(id, b.status);
  if (out.error) {
    const st =
      out.messageKey === 'api.project.migration' ? 500 : out.messageKey === 'api.project.not_found' ? 404 : 400;
    return res.status(st).json(validationOut(out));
  }
  return res.json(jsonOk({ id: out.id, status: out.status }));
}

async function deleteProjectById(req, res) {
  const id = parseId(req.params.id);
  if (id == null) {
    return res.status(400).json(jsonError('VALIDATION', 'Geçersiz id', null, 'api.project.invalid_id'));
  }
  const out = await deleteProject(id);
  if (out.error) {
    const st = out.messageKey === 'api.project.migration' ? 500 : out.messageKey === 'api.project.not_found' ? 404 : 400;
    return res.status(st).json(validationOut(out));
  }
  return res.json(jsonOk({ id: out.id }));
}

module.exports = { getProjects, postProject, putProject, patchProject, deleteProjectById };
