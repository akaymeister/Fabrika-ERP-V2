const { pool } = require('../config/database');

const LIST_COLUMNS = `
  id, user_id, username, full_name, action_type, module_name,
  table_name, record_id, description, ip_address, user_agent, created_at
`;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function clampPageSize(n) {
  const v = parseInt(String(n), 10);
  if (!Number.isFinite(v) || v < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(v, MAX_PAGE_SIZE);
}

function clampPage(n) {
  const v = parseInt(String(n), 10);
  if (!Number.isFinite(v) || v < 1) return 1;
  return v;
}

function buildWhere(filters) {
  const where = [];
  const params = {};

  if (filters.from) {
    where.push('created_at >= :from');
    params.from = `${String(filters.from).trim()} 00:00:00`;
  }
  if (filters.to) {
    where.push('created_at <= :to');
    params.to = `${String(filters.to).trim()} 23:59:59`;
  }
  if (filters.userId != null && filters.userId !== '') {
    const uid = parseInt(String(filters.userId), 10);
    if (Number.isFinite(uid) && uid > 0) {
      where.push('user_id = :userId');
      params.userId = uid;
    }
  }
  if (filters.username && String(filters.username).trim()) {
    where.push('username LIKE :username');
    params.username = `%${String(filters.username).trim()}%`;
  }
  if (filters.module_name && String(filters.module_name).trim()) {
    where.push('module_name = :module_name');
    params.module_name = String(filters.module_name).trim().slice(0, 32);
  }
  if (filters.action_type && String(filters.action_type).trim()) {
    where.push('action_type = :action_type');
    params.action_type = String(filters.action_type).trim().slice(0, 32);
  }
  if (filters.table_name && String(filters.table_name).trim()) {
    where.push('table_name = :table_name');
    params.table_name = String(filters.table_name).trim().slice(0, 128);
  }
  if (filters.record_id != null && String(filters.record_id).trim() !== '') {
    where.push('record_id = :record_id');
    params.record_id = String(filters.record_id).trim().slice(0, 64);
  }
  if (filters.q && String(filters.q).trim()) {
    where.push('description LIKE :q');
    params.q = `%${String(filters.q).trim()}%`;
  }

  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { sqlWhere, params };
}

async function listActivityLogs(filters = {}) {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const offset = (page - 1) * pageSize;
  const { sqlWhere, params } = buildWhere(filters);

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM activity_logs ${sqlWhere}`,
    params
  );
  const total = Number(countRows[0]?.total) || 0;

  const [rows] = await pool.query(
    `SELECT ${LIST_COLUMNS}
     FROM activity_logs
     ${sqlWhere}
     ORDER BY id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );

  return {
    items: rows,
    page,
    pageSize,
    total,
    totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

async function getActivityLogById(id) {
  const logId = parseInt(String(id), 10);
  if (!Number.isFinite(logId) || logId < 1) {
    return null;
  }
  const [rows] = await pool.query('SELECT * FROM activity_logs WHERE id = ?', [logId]);
  return rows[0] || null;
}

async function getActivityLogMeta() {
  const [modules] = await pool.query(
    `SELECT DISTINCT module_name AS v FROM activity_logs WHERE module_name IS NOT NULL AND module_name <> '' ORDER BY module_name`
  );
  const [actions] = await pool.query(
    `SELECT DISTINCT action_type AS v FROM activity_logs WHERE action_type IS NOT NULL AND action_type <> '' ORDER BY action_type`
  );
  return {
    moduleNames: modules.map((r) => r.v),
    actionTypes: actions.map((r) => r.v),
  };
}

module.exports = {
  listActivityLogs,
  getActivityLogById,
  getActivityLogMeta,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
