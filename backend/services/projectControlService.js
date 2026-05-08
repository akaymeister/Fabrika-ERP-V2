const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { toUpperTr, optionalNoteUpperTr } = require('../utils/textNormalize');
const { userHasPermission } = require('./accessService');
const {
  stableRowUid,
  mergeCoreFromDynamic,
  PRICE_USD_KEYS,
  PRICE_UZS_KEYS,
  detectInputType,
  detectOptions,
  OPERATION_PHASE_KEYS,
} = require('./projectBoqImportService');

const ALLOWED_ITEM_FIELDS = new Set([
  'title',
  'location_floor',
  'room_no',
  'mahal',
  'product_name',
  'quantity',
  'unit',
  'status',
  'progress',
  'priority',
  'assigned_employee_id',
  'department_id',
  'planned_start_date',
  'planned_end_date',
  'actual_start_date',
  'actual_end_date',
  'notes',
  'dynamic_data_json',
  'seq_no',
]);

const ALLOWED_STATUSES = new Set(['pending', 'in_progress', 'blocked', 'completed', 'cancelled', 'on_hold']);
const ALLOWED_PRIORITIES = new Set(['low', 'normal', 'high', 'critical']);
const ALLOWED_DEPT_TASK_STATUSES = new Set(['pending', 'in_progress', 'blocked', 'completed', 'na', 'on_hold']);
const BULK_INSERT_CHUNK = 500;
const DEFAULT_PHASES = ['roleve', 'cizim', 'malzeme_siparisi', 'uretim', 'boya', 'sevk', 'montaj'];
const DEFAULT_PHASE_DROPDOWN = ['Bekliyor', 'Devam', 'Tamam', 'Gecikti', 'Revizyon'];

const ITEM_STATUS_FLOW = {
  pending: new Set(['in_progress', 'on_hold', 'cancelled']),
  in_progress: new Set(['blocked', 'on_hold', 'completed', 'cancelled']),
  blocked: new Set(['in_progress', 'on_hold', 'cancelled']),
  on_hold: new Set(['in_progress', 'cancelled']),
  completed: new Set([]),
  cancelled: new Set([]),
};

const DEPT_TASK_STATUS_FLOW = {
  pending: new Set(['in_progress', 'on_hold', 'na']),
  in_progress: new Set(['blocked', 'on_hold', 'completed']),
  blocked: new Set(['in_progress', 'on_hold']),
  on_hold: new Set(['in_progress', 'na']),
  completed: new Set([]),
  na: new Set([]),
};

function clampProgress(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

function normalizeStatus(v) {
  const s = String(v || 'pending').trim().toLowerCase();
  return ALLOWED_STATUSES.has(s) ? s : 'pending';
}

function normalizeDeptTaskStatus(v) {
  const s = String(v || 'pending').trim().toLowerCase();
  return ALLOWED_DEPT_TASK_STATUSES.has(s) ? s : 'pending';
}

function normalizePriority(v) {
  const s = String(v || 'normal').trim().toLowerCase();
  return ALLOWED_PRIORITIES.has(s) ? s : 'normal';
}

function parsePositiveInt(v) {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function toDateOrNull(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  return s;
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function ensureDocumentRevisionProjectConsistency(conn, { projectId, boqDocumentId, boqRevisionId }) {
  const pid = parsePositiveInt(projectId);
  const did = parsePositiveInt(boqDocumentId);
  const rid = parsePositiveInt(boqRevisionId);
  if (!pid || !did || !rid) return false;
  const [rows] = await conn.query(
    `SELECT 1 AS ok
     FROM project_boq_revisions r
     INNER JOIN project_boq_documents d ON d.id = r.boq_document_id
     WHERE r.id = :rid
       AND r.boq_document_id = :did
       AND d.project_id = :pid
       AND r.deleted_at IS NULL
       AND d.deleted_at IS NULL
     LIMIT 1`,
    { rid, did, pid }
  );
  return rows.length > 0;
}

function canTransition(flow, fromState, toState) {
  if (fromState === toState) return true;
  const set = flow[fromState] || new Set();
  return set.has(toState);
}

function toJson(v) {
  if (v == null) return null;
  try {
    return JSON.stringify(v);
  } catch {
    return JSON.stringify({ text: String(v) });
  }
}

function parseDbJson(v) {
  if (v == null || v === '') return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

function normalizeColumnInputType(v) {
  const s = String(v || '').trim().toLowerCase();
  if (['dropdown', 'toggle', 'date', 'text', 'number', 'currency', 'readonly'].includes(s)) return s;
  return 'text';
}

async function listProjectsForControl() {
  const [rows] = await pool.query(
    `SELECT id, project_code, name, short_code, status
     FROM projects
     WHERE status IN ('active', 'on_hold')
     ORDER BY name ASC`
  );
  return rows;
}

async function createBoqUpload({
  projectId,
  documentName,
  disciplineType,
  revisionNote,
  originalFilename,
  storedPath,
  uploadedBy,
  parsedWorkbook,
}) {
  const pid = parsePositiveInt(projectId);
  if (!Number.isFinite(pid) || pid < 1) {
    return err('Gecersiz proje secimi', 'api.project_control.project_required');
  }
  if (!parsedWorkbook || !Array.isArray(parsedWorkbook.columns) || !Array.isArray(parsedWorkbook.rows)) {
    return err('Excel parse sonucu gecersiz', 'api.project_control.import_invalid_file');
  }
  const docName = toUpperTr(documentName) || toUpperTr(originalFilename) || 'BOQ';
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [prj] = await conn.query('SELECT id FROM projects WHERE id = :id LIMIT 1', { id: pid });
    if (!prj.length) {
      await conn.rollback();
      return err('Proje bulunamadi', 'api.project.not_found');
    }
    const [docRows] = await conn.query(
      `SELECT id
       FROM project_boq_documents
       WHERE project_id = :pid
         AND document_name = :name
         AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      { pid, name: docName }
    );
    let boqDocumentId = docRows[0]?.id || null;
    if (!boqDocumentId) {
      const [insDoc] = await conn.query(
        `INSERT INTO project_boq_documents
          (project_id, document_name, discipline_type, status, created_by)
         VALUES
          (:project_id, :document_name, :discipline_type, 'active', :created_by)`,
        {
          project_id: pid,
          document_name: docName,
          discipline_type: toUpperTr(disciplineType) || null,
          created_by: uploadedBy || null,
        }
      );
      boqDocumentId = insDoc.insertId;
    }
    const [[mx]] = await conn.query(
      `SELECT COALESCE(MAX(revision_no), 0) + 1 AS next_rev
       FROM project_boq_revisions
       WHERE boq_document_id = :docId
       FOR UPDATE`,
      { docId: boqDocumentId }
    );
    const revisionNo = Number(mx?.next_rev || 1);

    await conn.query(
      `UPDATE project_boq_revisions
       SET is_active_revision = 0, status = 'archived'
       WHERE boq_document_id = :docId AND deleted_at IS NULL`,
      { docId: boqDocumentId }
    );

    const [insRev] = await conn.query(
      `INSERT INTO project_boq_revisions
        (boq_document_id, revision_no, revision_note, original_filename, stored_path, is_active_revision, uploaded_by, row_count, status)
       VALUES
        (:docId, :revision_no, :revision_note, :original_filename, :stored_path, 1, :uploaded_by, :row_count, 'active')`,
      {
        docId: boqDocumentId,
        revision_no: revisionNo,
        revision_note: optionalNoteUpperTr(revisionNote),
        original_filename: originalFilename || 'boq.xlsx',
        stored_path: storedPath,
        uploaded_by: uploadedBy || null,
        row_count: parsedWorkbook.rows.length,
      }
    );
    const revisionId = insRev.insertId;

    const colValues = parsedWorkbook.columns.map((c, i) => [
      revisionId,
      c.column_key,
      c.column_label,
      c.column_hint || null,
      c.input_type || 'text',
      toJson(c.options_json || null),
      i,
      c.data_type || 'text',
      c.is_price_usd ? 1 : 0,
      c.is_price_uzs ? 1 : 0,
      c.is_visible_default ? 1 : 0,
    ]);
    for (const chunk of chunkArray(colValues, BULK_INSERT_CHUNK)) {
      // eslint-disable-next-line no-await-in-loop
      await conn.query(
        `INSERT INTO project_boq_columns
          (boq_revision_id, column_key, column_label, column_hint, input_type, options_json, column_order, data_type, is_price_usd, is_price_uzs, is_visible_default)
         VALUES ?`,
        [chunk]
      );
    }

    const seenUids = new Set();
    const wiValues = [];
    for (const row of parsedWorkbook.rows) {
      const merged = mergeCoreFromDynamic(row.dynamic, row.mapped);
      const uid = stableRowUid(pid, boqDocumentId, row.dynamic);
      if (seenUids.has(uid)) continue;
      seenUids.add(uid);
      wiValues.push([
        pid,
        boqDocumentId,
        revisionId,
        uid,
        row.source_row_no || null,
        merged.seq_no || null,
        toUpperTr(merged.product_name || merged.title || null),
        toUpperTr(merged.location_floor || null),
        toUpperTr(merged.room_no || null),
        toUpperTr(merged.mahal || null),
        toUpperTr(merged.product_name || null),
        merged.quantity || null,
        toUpperTr(merged.unit || null),
        'pending',
        0,
        'normal',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        toJson(row.dynamic),
        0,
        uploadedBy || null,
        uploadedBy || null,
      ]);
    }
    for (const chunk of chunkArray(wiValues, BULK_INSERT_CHUNK)) {
      // eslint-disable-next-line no-await-in-loop
      await conn.query(
        `INSERT INTO project_work_items
          (project_id, boq_document_id, boq_revision_id, stable_row_uid, source_row_no, seq_no, title, location_floor, room_no, mahal, product_name, quantity, unit,
           status, progress, priority, assigned_employee_id, department_id, planned_start_date, planned_end_date, actual_start_date, actual_end_date, notes,
           dynamic_data_json, is_deleted, created_by, updated_by)
         VALUES ?`,
        [chunk]
      );
    }
    await conn.commit();
    return { boqDocumentId, revisionId, revisionNo, rowCount: wiValues.length };
  } catch (e) {
    await conn.rollback();
    if (e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062)) {
      return err('Ayni BOQ revizyonu ayni anda olusturuldu, tekrar deneyin', 'api.project_control.revision_conflict');
    }
    throw e;
  } finally {
    conn.release();
  }
}

async function listBoqRevisions({ projectId } = {}) {
  const where = ['r.deleted_at IS NULL', 'd.deleted_at IS NULL'];
  const p = {};
  const pid = Number.parseInt(String(projectId || ''), 10);
  if (Number.isFinite(pid) && pid > 0) {
    where.push('d.project_id = :project_id');
    p.project_id = pid;
  }
  const [rows] = await pool.query(
    `SELECT r.id, r.boq_document_id, r.revision_no, r.revision_note, r.original_filename, r.is_active_revision, r.uploaded_at, r.row_count, r.status,
            d.document_name, d.discipline_type, d.project_id,
            p.name AS project_name, p.project_code
     FROM project_boq_revisions r
     INNER JOIN project_boq_documents d ON d.id = r.boq_document_id
     INNER JOIN projects p ON p.id = d.project_id
     WHERE ${where.join(' AND ')}
     ORDER BY r.uploaded_at DESC`,
    p
  );
  return rows;
}

async function loadRevisionColumns(revisionId) {
  const [columns] = await pool.query(
    `SELECT id, column_key, column_label, column_hint, input_type, options_json, column_order, data_type, is_price_usd, is_price_uzs, is_visible_default
     FROM project_boq_columns
     WHERE boq_revision_id = :id
     ORDER BY column_order ASC, id ASC`,
    { id: revisionId }
  );
  columns.forEach((c) => {
    const hint = c.column_hint || '';
    c.input_type = normalizeColumnInputType(c.input_type || detectInputType(c.column_label, hint, c.column_key));
    const parsedOptions = parseDbJson(c.options_json);
    if (Array.isArray(parsedOptions) && parsedOptions.length) {
      c.options_json = parsedOptions;
    } else {
      c.options_json = detectOptions(hint, c.input_type, c.column_key) || (OPERATION_PHASE_KEYS.has(c.column_key) ? DEFAULT_PHASE_DROPDOWN : null);
    }
  });
  return columns;
}

async function getRevisionDetail({ revisionId, viewer, limit = 200, offset = 0 }) {
  const rid = Number.parseInt(String(revisionId), 10);
  if (!Number.isFinite(rid) || rid < 1) return err('Gecersiz revizyon', 'api.project_control.revision_invalid');
  const [headRows] = await pool.query(
    `SELECT r.id, r.boq_document_id, r.revision_no, r.revision_note, r.original_filename, r.is_active_revision, r.uploaded_at, r.row_count, r.status,
            d.document_name, d.discipline_type, d.project_id,
            p.name AS project_name, p.project_code
     FROM project_boq_revisions r
     INNER JOIN project_boq_documents d ON d.id = r.boq_document_id
     INNER JOIN projects p ON p.id = d.project_id
     WHERE r.id = :id AND r.deleted_at IS NULL AND d.deleted_at IS NULL
     LIMIT 1`,
    { id: rid }
  );
  const head = headRows[0];
  if (!head) return err('Revizyon bulunamadi', 'api.project_control.revision_not_found');

  const columns = await loadRevisionColumns(rid);
  const canViewUsd = await userHasPermission(viewer?.id, viewer?.role?.slug, 'projects.control.price.usd.view');
  const canViewUzs = await userHasPermission(viewer?.id, viewer?.role?.slug, 'projects.control.price.uzs.view');

  const visibleColumns = columns.filter((c) => {
    if (c.is_price_usd && !canViewUsd) return false;
    if (c.is_price_uzs && !canViewUzs) return false;
    return true;
  });
  const hiddenKeys = new Set(
    columns
      .filter((c) => (c.is_price_usd && !canViewUsd) || (c.is_price_uzs && !canViewUzs))
      .map((c) => c.column_key)
  );
  if (!canViewUsd) {
    PRICE_USD_KEYS.forEach((k) => hiddenKeys.add(k));
  }
  if (!canViewUzs) {
    PRICE_UZS_KEYS.forEach((k) => hiddenKeys.add(k));
  }

  const lim = Math.max(1, Math.min(500, Number.parseInt(String(limit), 10) || 200));
  const off = Math.max(0, Number.parseInt(String(offset), 10) || 0);

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM project_work_items
     WHERE boq_revision_id = :rid AND is_deleted = 0`,
    { rid }
  );

  const [rows] = await pool.query(
    `SELECT wi.id, wi.project_id, wi.boq_document_id, wi.boq_revision_id, wi.stable_row_uid, wi.source_row_no, wi.seq_no, wi.title, wi.location_floor, wi.room_no, wi.mahal, wi.product_name,
            wi.quantity, wi.unit, wi.status, wi.progress, wi.priority, wi.assigned_employee_id, wi.department_id, wi.planned_start_date, wi.planned_end_date, wi.actual_start_date, wi.actual_end_date,
            wi.notes, wi.dynamic_data_json, wi.created_at, wi.updated_at,
            COALESCE(NULLIF(e.full_name, ''), CONCAT_WS(' ', e.first_name, e.last_name), e.employee_no) AS assigned_employee_name
     FROM project_work_items wi
     LEFT JOIN employees e ON e.id = wi.assigned_employee_id
     WHERE wi.boq_revision_id = :rid AND wi.is_deleted = 0
     ORDER BY COALESCE(wi.seq_no, 999999), wi.id ASC
     LIMIT :lim OFFSET :off`,
    { rid, lim, off }
  );

  rows.forEach((row) => {
    const dyn = parseDbJson(row.dynamic_data_json);
    hiddenKeys.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(dyn, k)) delete dyn[k];
    });
    row.dynamic_data_json = dyn;
  });

  return {
    revision: head,
    columns: visibleColumns,
    workItems: rows,
    paging: {
      total: Number(countRow?.c || 0),
      limit: lim,
      offset: off,
      hasMore: off + rows.length < Number(countRow?.c || 0),
    },
    permissions: {
      canViewUsdPrices: !!canViewUsd,
      canViewUzsPrices: !!canViewUzs,
    },
  };
}

async function patchRevision(revisionId, payload = {}) {
  const rid = Number.parseInt(String(revisionId), 10);
  if (!Number.isFinite(rid) || rid < 1) return err('Gecersiz revizyon', 'api.project_control.revision_invalid');
  const fields = [];
  const p = { id: rid };
  if (payload.status) {
    fields.push('status = :status');
    p.status = String(payload.status).trim().toLowerCase();
  }
  if (payload.revision_note != null) {
    fields.push('revision_note = :revision_note');
    p.revision_note = optionalNoteUpperTr(payload.revision_note);
  }
  if (payload.is_active_revision != null) {
    fields.push('is_active_revision = :is_active_revision');
    p.is_active_revision = payload.is_active_revision ? 1 : 0;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (p.is_active_revision === 1) {
      const [[rev]] = await conn.query(
        'SELECT boq_document_id FROM project_boq_revisions WHERE id = :id AND deleted_at IS NULL LIMIT 1',
        { id: rid }
      );
      if (!rev) {
        await conn.rollback();
        return err('Revizyon bulunamadi', 'api.project_control.revision_not_found');
      }
      await conn.query(
        `UPDATE project_boq_revisions
         SET is_active_revision = 0
         WHERE boq_document_id = :docId AND deleted_at IS NULL`,
        { docId: rev.boq_document_id }
      );
    }
    const [u] = await conn.query(
      `UPDATE project_boq_revisions
       SET ${fields.join(', ')}
       WHERE id = :id AND deleted_at IS NULL`,
      p
    );
    if (!u.affectedRows) {
      await conn.rollback();
      return err('Revizyon bulunamadi', 'api.project_control.revision_not_found');
    }
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function softDeleteRevision(revisionId) {
  const rid = Number.parseInt(String(revisionId), 10);
  if (!Number.isFinite(rid) || rid < 1) return err('Gecersiz revizyon', 'api.project_control.revision_invalid');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [u1] = await conn.query(
      `UPDATE project_boq_revisions
       SET deleted_at = NOW(), status = 'archived', is_active_revision = 0
       WHERE id = :id AND deleted_at IS NULL`,
      { id: rid }
    );
    if (!u1.affectedRows) {
      await conn.rollback();
      return err('Revizyon bulunamadi', 'api.project_control.revision_not_found');
    }
    await conn.query(
      `UPDATE project_work_items
       SET is_deleted = 1
       WHERE boq_revision_id = :id`,
      { id: rid }
    );
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getWorkItemById(id) {
  const wid = Number.parseInt(String(id), 10);
  if (!Number.isFinite(wid) || wid < 1) return null;
  const [rows] = await pool.query(
    `SELECT wi.*
     FROM project_work_items wi
     INNER JOIN project_boq_revisions r ON r.id = wi.boq_revision_id
     INNER JOIN project_boq_documents d ON d.id = wi.boq_document_id
     WHERE wi.id = :id
       AND wi.is_deleted = 0
       AND r.deleted_at IS NULL
       AND d.deleted_at IS NULL
     LIMIT 1`,
    { id: wid }
  );
  return rows[0] || null;
}

async function ensureWorkItemScope(conn, workItemId) {
  const wid = parsePositiveInt(workItemId);
  if (!wid) return null;
  const [rows] = await conn.query(
    `SELECT wi.id, wi.status, wi.assigned_employee_id, wi.department_id, wi.boq_revision_id, wi.project_id
     FROM project_work_items wi
     INNER JOIN project_boq_revisions r ON r.id = wi.boq_revision_id
     INNER JOIN project_boq_documents d ON d.id = wi.boq_document_id
     WHERE wi.id = :id
       AND wi.is_deleted = 0
       AND r.deleted_at IS NULL
       AND d.deleted_at IS NULL
     LIMIT 1`,
    { id: wid }
  );
  return rows[0] || null;
}

async function hasOpenDepartmentTasks(conn, workItemId) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c
     FROM project_work_item_department_tasks
     WHERE work_item_id = :id
       AND status NOT IN ('completed', 'na')`,
    { id: workItemId }
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function insertWorkItemHistory({ workItemId, changedBy, changeType, fieldName, oldValue, newValue }) {
  await pool.query(
    `INSERT INTO project_work_item_history
      (work_item_id, changed_by, change_type, field_name, old_value, new_value)
     VALUES
      (:work_item_id, :changed_by, :change_type, :field_name, :old_value, :new_value)`,
    {
      work_item_id: workItemId,
      changed_by: changedBy || null,
      change_type: changeType,
      field_name: fieldName || null,
      old_value: toJson(oldValue),
      new_value: toJson(newValue),
    }
  );
}

async function createWorkItem(payload = {}, actorId = null) {
  const required = ['project_id', 'boq_document_id', 'boq_revision_id'];
  for (const k of required) {
    if (!Number.isFinite(Number.parseInt(String(payload[k]), 10))) {
      return err('Satir eklemek icin zorunlu alanlar eksik', 'api.project_control.work_item_required');
    }
  }
  const dynamic = parseDbJson(payload.dynamic_data_json || {});
  const merged = mergeCoreFromDynamic(dynamic, payload);
  const projectId = parsePositiveInt(merged.project_id);
  const boqDocumentId = parsePositiveInt(merged.boq_document_id);
  const boqRevisionId = parsePositiveInt(merged.boq_revision_id);
  const uidBase = stableRowUid(projectId, boqDocumentId, dynamic);
  const uid = `${uidBase}-${Date.now()}`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const consistent = await ensureDocumentRevisionProjectConsistency(conn, {
      projectId,
      boqDocumentId,
      boqRevisionId,
    });
    if (!consistent) {
      await conn.rollback();
      return err('Proje-dokuman-revizyon uyumsuz', 'api.project_control.scope_mismatch');
    }
    const [dupRows] = await conn.query(
      `SELECT id FROM project_work_items
       WHERE boq_revision_id = :rid
         AND stable_row_uid = :uid
         AND is_deleted = 0
       LIMIT 1`,
      { rid: boqRevisionId, uid: uidBase }
    );
    if (dupRows.length) {
      await conn.rollback();
      return err('Ayni satir zaten mevcut', 'api.project_control.work_item_duplicate');
    }

    const [r] = await conn.query(
    `INSERT INTO project_work_items
      (project_id, boq_document_id, boq_revision_id, stable_row_uid, source_row_no, seq_no, title, location_floor, room_no, mahal, product_name,
       quantity, unit, status, progress, priority, assigned_employee_id, department_id, planned_start_date, planned_end_date, actual_start_date, actual_end_date,
       notes, dynamic_data_json, is_deleted, created_by, updated_by)
     VALUES
      (:project_id, :boq_document_id, :boq_revision_id, :stable_row_uid, :source_row_no, :seq_no, :title, :location_floor, :room_no, :mahal, :product_name,
       :quantity, :unit, :status, :progress, :priority, :assigned_employee_id, :department_id, :planned_start_date, :planned_end_date, :actual_start_date, :actual_end_date,
       :notes, :dynamic_data_json, 0, :actor, :actor)`,
    {
      project_id: projectId,
      boq_document_id: boqDocumentId,
      boq_revision_id: boqRevisionId,
      stable_row_uid: uid,
      source_row_no: merged.source_row_no || null,
      seq_no: merged.seq_no || null,
      title: toUpperTr(merged.title || merged.product_name || null),
      location_floor: toUpperTr(merged.location_floor || null),
      room_no: toUpperTr(merged.room_no || null),
      mahal: toUpperTr(merged.mahal || null),
      product_name: toUpperTr(merged.product_name || null),
      quantity: merged.quantity || null,
      unit: toUpperTr(merged.unit || null),
      status: normalizeStatus(merged.status),
      progress: clampProgress(merged.progress),
      priority: normalizePriority(merged.priority),
      assigned_employee_id: parsePositiveInt(merged.assigned_employee_id),
      department_id: parsePositiveInt(merged.department_id),
      planned_start_date: toDateOrNull(merged.planned_start_date),
      planned_end_date: toDateOrNull(merged.planned_end_date),
      actual_start_date: toDateOrNull(merged.actual_start_date),
      actual_end_date: toDateOrNull(merged.actual_end_date),
      notes: optionalNoteUpperTr(merged.notes),
      dynamic_data_json: toJson(dynamic),
      actor: actorId || null,
    }
    );
    await conn.commit();
    await insertWorkItemHistory({
    workItemId: r.insertId,
    changedBy: actorId,
    changeType: 'CREATE',
    oldValue: null,
    newValue: payload,
    });
    return { id: r.insertId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updateWorkItem(id, payload = {}, actorId = null) {
  const wid = Number.parseInt(String(id), 10);
  if (!Number.isFinite(wid) || wid < 1) return err('Gecersiz satir id', 'api.project_control.work_item_invalid');
  const conn = await pool.getConnection();
  let current = null;
  try {
    current = await ensureWorkItemScope(conn, wid);
  } finally {
    conn.release();
  }
  if (!current) return err('Satir bulunamadi', 'api.project_control.work_item_not_found');

  const fields = [];
  const p = { id: wid, updated_by: actorId || null };
  const afterForHistory = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (!ALLOWED_ITEM_FIELDS.has(k)) continue;
    if (k === 'dynamic_data_json') {
      fields.push('dynamic_data_json = :dynamic_data_json');
      p.dynamic_data_json = toJson(parseDbJson(v));
      afterForHistory.dynamic_data_json = parseDbJson(v);
      continue;
    }
    if (k === 'notes') {
      fields.push('notes = :notes');
      p.notes = optionalNoteUpperTr(v);
      afterForHistory.notes = p.notes;
      continue;
    }
    if (['title', 'location_floor', 'room_no', 'mahal', 'product_name', 'unit'].includes(k)) {
      fields.push(`${k} = :${k}`);
      p[k] = toUpperTr(v);
      afterForHistory[k] = p[k];
      continue;
    }
    if (k === 'status') {
      const nextStatus = normalizeStatus(v);
      if (!canTransition(ITEM_STATUS_FLOW, String(current.status || 'pending').toLowerCase(), nextStatus)) {
        return err('Gecersiz durum gecisi', 'api.project_control.invalid_status_transition');
      }
      if (nextStatus === 'completed' && !current.assigned_employee_id) {
        return err('Tamamlama icin personel atamasi gerekli', 'api.project_control.assignment_required_for_complete');
      }
      fields.push('status = :status');
      p.status = nextStatus;
      afterForHistory.status = p.status;
      continue;
    }
    if (k === 'priority') {
      fields.push('priority = :priority');
      p.priority = normalizePriority(v);
      afterForHistory.priority = p.priority;
      continue;
    }
    if (k === 'progress') {
      fields.push('progress = :progress');
      p.progress = clampProgress(v);
      afterForHistory.progress = p.progress;
      continue;
    }
    if (['planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date'].includes(k)) {
      fields.push(`${k} = :${k}`);
      p[k] = toDateOrNull(v);
      afterForHistory[k] = p[k];
      continue;
    }
    if (['assigned_employee_id', 'department_id', 'seq_no'].includes(k)) {
      fields.push(`${k} = :${k}`);
      p[k] = parsePositiveInt(v);
      afterForHistory[k] = p[k];
      continue;
    }
    fields.push(`${k} = :${k}`);
    p[k] = v;
    afterForHistory[k] = v;
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  fields.push('updated_by = :updated_by');

  if (p.status === 'completed') {
    const c = await pool.getConnection();
    try {
      const hasOpen = await hasOpenDepartmentTasks(c, wid);
      if (hasOpen) {
        return err('Departman gorevleri tamamlanmadan satir tamamlanamaz', 'api.project_control.dependency_not_completed');
      }
    } finally {
      c.release();
    }
  }

  const [u] = await pool.query(
    `UPDATE project_work_items
     SET ${fields.join(', ')}
     WHERE id = :id AND is_deleted = 0`,
    p
  );
  if (!u.affectedRows) return err('Satir bulunamadi', 'api.project_control.work_item_not_found');

  for (const [fieldName, newValue] of Object.entries(afterForHistory)) {
    const oldValue = fieldName === 'dynamic_data_json' ? parseDbJson(current.dynamic_data_json) : current[fieldName];
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    // eslint-disable-next-line no-await-in-loop
    await insertWorkItemHistory({
      workItemId: wid,
      changedBy: actorId,
      changeType: 'UPDATE',
      fieldName,
      oldValue,
      newValue,
    });
  }
  return { ok: true };
}

async function softDeleteWorkItem(id, actorId = null) {
  const wid = Number.parseInt(String(id), 10);
  if (!Number.isFinite(wid) || wid < 1) return err('Gecersiz satir id', 'api.project_control.work_item_invalid');
  const old = await getWorkItemById(wid);
  if (!old) return err('Satir bulunamadi', 'api.project_control.work_item_not_found');
  const [u] = await pool.query(
    `UPDATE project_work_items
     SET is_deleted = 1, updated_by = :actor
     WHERE id = :id AND is_deleted = 0`,
    { id: wid, actor: actorId || null }
  );
  if (!u.affectedRows) return err('Satir bulunamadi', 'api.project_control.work_item_not_found');
  await insertWorkItemHistory({
    workItemId: wid,
    changedBy: actorId,
    changeType: 'DELETE',
    oldValue: old,
    newValue: { is_deleted: 1 },
  });
  return { ok: true };
}

async function assignWorkItem(id, employeeId, actorId = null) {
  const wid = Number.parseInt(String(id), 10);
  const eid = Number.parseInt(String(employeeId), 10);
  if (!Number.isFinite(wid) || wid < 1 || !Number.isFinite(eid) || eid < 1) {
    return err('Gecersiz atama parametresi', 'api.project_control.assignment_invalid');
  }
  const [emps] = await pool.query(
    `SELECT id, department_id
     FROM employees
     WHERE id = :id AND employment_status = 'active'
     LIMIT 1`,
    { id: eid }
  );
  if (!emps.length) return err('Personel bulunamadi', 'api.hr.employee_not_found');
  const old = await getWorkItemById(wid);
  if (!old) return err('Satir bulunamadi', 'api.project_control.work_item_not_found');
  if (String(old.status || '').toLowerCase() === 'completed') {
    return err('Tamamlanan satira atama degisimi yapilamaz', 'api.project_control.completed_item_locked');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE project_work_item_assignments
       SET is_active = 0
       WHERE work_item_id = :wid`,
      { wid }
    );
    await conn.query(
      `INSERT INTO project_work_item_assignments
        (work_item_id, employee_id, assigned_by, is_active)
       VALUES
        (:work_item_id, :employee_id, :assigned_by, 1)`,
      { work_item_id: wid, employee_id: eid, assigned_by: actorId || null }
    );
    await conn.query(
      `UPDATE project_work_items
       SET assigned_employee_id = :employee_id, department_id = :department_id, updated_by = :actor
       WHERE id = :id AND is_deleted = 0`,
      { employee_id: eid, department_id: emps[0].department_id || null, actor: actorId || null, id: wid }
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  await insertWorkItemHistory({
    workItemId: wid,
    changedBy: actorId,
    changeType: 'ASSIGN',
    fieldName: 'assigned_employee_id',
    oldValue: old.assigned_employee_id,
    newValue: eid,
  });
  return { ok: true };
}

async function clearWorkItemAssignment(id, actorId = null) {
  const wid = Number.parseInt(String(id), 10);
  if (!Number.isFinite(wid) || wid < 1) return err('Gecersiz satir id', 'api.project_control.work_item_invalid');
  const old = await getWorkItemById(wid);
  if (!old) return err('Satir bulunamadi', 'api.project_control.work_item_not_found');
  if (String(old.status || '').toLowerCase() === 'completed') {
    return err('Tamamlanan satirdan atama kaldirilamaz', 'api.project_control.completed_item_locked');
  }
  await pool.query(
    `UPDATE project_work_item_assignments
     SET is_active = 0
     WHERE work_item_id = :wid`,
    { wid }
  );
  await pool.query(
    `UPDATE project_work_items
     SET assigned_employee_id = NULL, updated_by = :actor
     WHERE id = :id AND is_deleted = 0`,
    { actor: actorId || null, id: wid }
  );
  await insertWorkItemHistory({
    workItemId: wid,
    changedBy: actorId,
    changeType: 'UNASSIGN',
    fieldName: 'assigned_employee_id',
    oldValue: old.assigned_employee_id,
    newValue: null,
  });
  return { ok: true };
}

async function createColumn(payload = {}) {
  const revisionId = parsePositiveInt(payload.boq_revision_id);
  if (!Number.isFinite(revisionId) || revisionId < 1) {
    return err('Revizyon secimi zorunlu', 'api.project_control.revision_required');
  }
  const key = String(payload.column_key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');
  const label = String(payload.column_label || '').trim();
  if (!key || !label) return err('Kolon anahtari ve etiketi gerekli', 'api.project_control.column_required');
  const [revRows] = await pool.query(
    `SELECT id
     FROM project_boq_revisions
     WHERE id = :id AND deleted_at IS NULL
     LIMIT 1`,
    { id: revisionId }
  );
  if (!revRows.length) return err('Revizyon bulunamadi', 'api.project_control.revision_not_found');
  const [r] = await pool.query(
    `INSERT INTO project_boq_columns
      (boq_revision_id, column_key, column_label, column_hint, input_type, options_json, column_order, data_type, is_price_usd, is_price_uzs, is_visible_default)
     VALUES
      (:boq_revision_id, :column_key, :column_label, :column_hint, :input_type, :options_json, :column_order, :data_type, :is_price_usd, :is_price_uzs, :is_visible_default)`,
    {
      boq_revision_id: revisionId,
      column_key: key,
      column_label: label,
      column_hint: payload.column_hint || null,
      input_type: normalizeColumnInputType(payload.input_type || detectInputType(label, payload.column_hint || '', key)),
      options_json: toJson(payload.options_json || detectOptions(payload.column_hint || '', payload.input_type || detectInputType(label, payload.column_hint || '', key), key)),
      column_order: Number.isFinite(Number(payload.column_order)) ? Number(payload.column_order) : 999,
      data_type: payload.data_type || 'text',
      is_price_usd: payload.is_price_usd ? 1 : 0,
      is_price_uzs: payload.is_price_uzs ? 1 : 0,
      is_visible_default: payload.is_visible_default === false ? 0 : 1,
    }
  );
  return { id: r.insertId };
}

async function updateColumn(id, payload = {}) {
  const cid = Number.parseInt(String(id), 10);
  if (!Number.isFinite(cid) || cid < 1) return err('Gecersiz kolon', 'api.project_control.column_invalid');
  const fields = [];
  const p = { id: cid };
  ['column_label', 'column_hint', 'column_order', 'data_type', 'is_price_usd', 'is_price_uzs', 'is_visible_default'].forEach((k) => {
    if (payload[k] == null) return;
    fields.push(`${k} = :${k}`);
    p[k] = payload[k];
  });
  if (payload.input_type != null) {
    fields.push('input_type = :input_type');
    p.input_type = normalizeColumnInputType(payload.input_type);
  }
  if (payload.options_json != null) {
    fields.push('options_json = :options_json');
    p.options_json = toJson(payload.options_json);
  }
  if (!fields.length) return err('Guncellenecek alan yok', 'api.hr.nothing_to_update');
  const [u] = await pool.query(
    `UPDATE project_boq_columns
     SET ${fields.join(', ')}
     WHERE id = :id`,
    p
  );
  if (!u.affectedRows) return err('Kolon bulunamadi', 'api.project_control.column_not_found');
  return { ok: true };
}

async function listAssignableEmployees(filters = {}, viewer = null) {
  const where = [`e.employment_status = 'active'`];
  const p = {};
  const depId = Number.parseInt(String(filters.departmentId || ''), 10);
  if (Number.isFinite(depId) && depId > 0) {
    where.push('e.department_id = :department_id');
    p.department_id = depId;
  }
  const posId = Number.parseInt(String(filters.positionId || ''), 10);
  if (Number.isFinite(posId) && posId > 0) {
    where.push('e.position_id = :position_id');
    p.position_id = posId;
  }
  const q = String(filters.search || '').trim();
  if (q) {
    where.push('(e.first_name LIKE :q OR e.last_name LIKE :q OR e.full_name LIKE :q OR e.employee_no LIKE :q)');
    p.q = `%${q}%`;
  }
  const [rows] = await pool.query(
    `SELECT e.id, e.employee_no, e.first_name, e.last_name, e.full_name, e.department_id, d.name AS department_name, e.position_id, pz.name AS position_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN positions pz ON pz.id = e.position_id
     WHERE ${where.join(' AND ')}
     ORDER BY e.first_name ASC, e.last_name ASC, e.full_name ASC
     LIMIT 300`,
    p
  );
  const canViewHrModule = await userHasPermission(viewer?.id, viewer?.role?.slug, 'module.hr');
  return { employees: rows, fromHrModule: !!canViewHrModule };
}

async function listDepartmentTasksByWorkItem(workItemId) {
  const wid = parsePositiveInt(workItemId);
  if (!wid) return err('Gecersiz satir id', 'api.project_control.work_item_invalid');
  const [rows] = await pool.query(
    `SELECT t.id, t.work_item_id, t.department_id, d.name AS department_name, t.phase_key, t.status, t.progress, t.owner_employee_id,
            e.first_name AS owner_first_name, e.last_name AS owner_last_name, t.planned_start_date, t.planned_end_date,
            t.actual_start_date, t.actual_end_date, t.notes, t.created_at, t.updated_at
     FROM project_work_item_department_tasks t
     INNER JOIN departments d ON d.id = t.department_id
     LEFT JOIN employees e ON e.id = t.owner_employee_id
     WHERE t.work_item_id = :wid
     ORDER BY t.id ASC`,
    { wid }
  );
  return { tasks: rows };
}

async function listWorkItemHistory(workItemId, limit = 100) {
  const wid = parsePositiveInt(workItemId);
  if (!wid) return err('Gecersiz satir id', 'api.project_control.work_item_invalid');
  const lim = Math.max(1, Math.min(300, Number.parseInt(String(limit), 10) || 100));
  const [rows] = await pool.query(
    `SELECT h.id, h.work_item_id, h.changed_by, u.username AS changed_by_username, h.change_type, h.field_name, h.old_value, h.new_value, h.changed_at
     FROM project_work_item_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.work_item_id = :wid
     ORDER BY h.id DESC
     LIMIT :lim`,
    { wid, lim }
  );
  return { history: rows };
}

async function ensureDefaultDepartmentTasks(workItemId, actorId = null) {
  const wid = parsePositiveInt(workItemId);
  if (!wid) return err('Gecersiz satir id', 'api.project_control.work_item_invalid');
  const [existing] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM project_work_item_department_tasks
     WHERE work_item_id = :wid`,
    { wid }
  );
  if (Number(existing[0]?.c || 0) > 0) return { ok: true, created: 0 };
  const [deps] = await pool.query(
    `SELECT id
     FROM departments
     WHERE is_active = 1
     ORDER BY id ASC
     LIMIT 1`
  );
  const dep = deps[0];
  if (!dep) return err('Aktif departman bulunamadi', 'api.hr.department_not_found');
  const values = DEFAULT_PHASES.map((phase) => [
    wid,
    dep.id,
    phase,
    'pending',
    0,
    null,
    null,
    null,
    null,
    null,
    null,
  ]);
  await pool.query(
    `INSERT INTO project_work_item_department_tasks
      (work_item_id, department_id, phase_key, status, progress, owner_employee_id, planned_start_date, planned_end_date, actual_start_date, actual_end_date, notes)
     VALUES ?`,
    [values]
  );
  await insertWorkItemHistory({
    workItemId: wid,
    changedBy: actorId,
    changeType: 'DEPT_TASK_INIT',
    oldValue: null,
    newValue: { phases: DEFAULT_PHASES },
  });
  return { ok: true, created: values.length };
}

async function upsertDepartmentTask(workItemId, payload = {}, actorId = null) {
  const wid = parsePositiveInt(workItemId);
  if (!wid) return err('Gecersiz satir id', 'api.project_control.work_item_invalid');
  const item = await getWorkItemById(wid);
  if (!item) return err('Satir bulunamadi', 'api.project_control.work_item_not_found');

  const departmentId = parsePositiveInt(payload.department_id);
  if (!departmentId) return err('Departman secimi zorunlu', 'api.hr.department_required');
  const phaseKey = String(payload.phase_key || '').trim().toLowerCase();
  if (!phaseKey) return err('Faz anahtari zorunlu', 'api.project_control.phase_required');

  const [existingRows] = await pool.query(
    `SELECT id, status
     FROM project_work_item_department_tasks
     WHERE work_item_id = :wid
       AND department_id = :did
       AND phase_key = :phase
     LIMIT 1`,
    { wid, did: departmentId, phase: phaseKey }
  );
  const nextStatus = normalizeDeptTaskStatus(payload.status);
  const p = {
    work_item_id: wid,
    department_id: departmentId,
    phase_key: phaseKey,
    status: nextStatus,
    progress: clampProgress(payload.progress),
    owner_employee_id: parsePositiveInt(payload.owner_employee_id),
    planned_start_date: toDateOrNull(payload.planned_start_date),
    planned_end_date: toDateOrNull(payload.planned_end_date),
    actual_start_date: toDateOrNull(payload.actual_start_date),
    actual_end_date: toDateOrNull(payload.actual_end_date),
    notes: optionalNoteUpperTr(payload.notes),
  };

  if (!existingRows.length) {
    const [ins] = await pool.query(
      `INSERT INTO project_work_item_department_tasks
        (work_item_id, department_id, phase_key, status, progress, owner_employee_id, planned_start_date, planned_end_date, actual_start_date, actual_end_date, notes)
       VALUES
        (:work_item_id, :department_id, :phase_key, :status, :progress, :owner_employee_id, :planned_start_date, :planned_end_date, :actual_start_date, :actual_end_date, :notes)`,
      p
    );
    await insertWorkItemHistory({
      workItemId: wid,
      changedBy: actorId,
      changeType: 'DEPT_TASK_CREATE',
      fieldName: `${departmentId}:${phaseKey}`,
      oldValue: null,
      newValue: p,
    });
    return { id: ins.insertId };
  }

  const current = existingRows[0];
  if (!canTransition(DEPT_TASK_STATUS_FLOW, String(current.status || 'pending').toLowerCase(), nextStatus)) {
    return err('Gecersiz departman gorev durum gecisi', 'api.project_control.invalid_status_transition');
  }

  await pool.query(
    `UPDATE project_work_item_department_tasks
     SET status = :status,
         progress = :progress,
         owner_employee_id = :owner_employee_id,
         planned_start_date = :planned_start_date,
         planned_end_date = :planned_end_date,
         actual_start_date = :actual_start_date,
         actual_end_date = :actual_end_date,
         notes = :notes
     WHERE id = :id`,
    { ...p, id: current.id }
  );
  await insertWorkItemHistory({
    workItemId: wid,
    changedBy: actorId,
    changeType: 'DEPT_TASK_UPDATE',
    fieldName: `${departmentId}:${phaseKey}`,
    oldValue: { status: current.status },
    newValue: p,
  });
  return { id: current.id };
}

module.exports = {
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
};
