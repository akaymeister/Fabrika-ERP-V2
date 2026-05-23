const { listActivityLogs, getActivityLogById, getActivityLogMeta } = require('../services/activityLogQueryService');
const { logActivityFireAndForget } = require('../services/activityLogService');
const { jsonOk, jsonError } = require('../utils/apiResponse');

function parseListQuery(q) {
  return {
    from: q.from,
    to: q.to,
    userId: q.userId,
    username: q.username,
    module_name: q.module_name,
    action_type: q.action_type,
    table_name: q.table_name,
    record_id: q.record_id,
    q: q.q,
    page: q.page,
    pageSize: q.pageSize,
  };
}

function auditLogViewer(req, actionType, description, extra = {}) {
  logActivityFireAndForget(req, {
    action_type: actionType,
    module_name: 'admin',
    table_name: 'activity_logs',
    description,
    new_data: extra,
  });
}

async function getActivityLogs(req, res) {
  try {
    const result = await listActivityLogs(parseListQuery(req.query || {}));
    return res.json(jsonOk(result));
  } catch (e) {
    if (e && e.code === 'ER_NO_SUCH_TABLE') {
      return res
        .status(503)
        .json(jsonError('UNAVAILABLE', 'Denetim günlüğü tablosu yok', null, 'api.admin.logs.table_missing'));
    }
    // eslint-disable-next-line no-console
    console.error('[getActivityLogs]', e);
    return res.status(500).json(jsonError('INTERNAL', 'Günlük listesi alınamadı', null, 'api.admin.logs.list_failed'));
  }
}

async function getActivityLogDetail(req, res) {
  try {
    const row = await getActivityLogById(req.params.id);
    if (!row) {
      return res.status(404).json(jsonError('NOT_FOUND', 'Kayıt bulunamadı', null, 'api.admin.logs.not_found'));
    }
    auditLogViewer(req, 'VIEW', `Denetim günlüğü detayı görüntülendi (#${row.id})`, { logId: row.id });
    return res.json(jsonOk({ item: row }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[getActivityLogDetail]', e);
    return res.status(500).json(jsonError('INTERNAL', 'Detay alınamadı', null, 'api.admin.logs.detail_failed'));
  }
}

async function getActivityLogsMeta(req, res) {
  try {
    const meta = await getActivityLogMeta();
    auditLogViewer(req, 'VIEW', 'Denetim günlüğü ekranı görüntülendi');
    return res.json(jsonOk(meta));
  } catch (e) {
    if (e && e.code === 'ER_NO_SUCH_TABLE') {
      return res
        .status(503)
        .json(jsonError('UNAVAILABLE', 'Denetim günlüğü tablosu yok', null, 'api.admin.logs.table_missing'));
    }
    // eslint-disable-next-line no-console
    console.error('[getActivityLogsMeta]', e);
    return res.status(500).json(jsonError('INTERNAL', 'Meta alınamadı', null, 'api.admin.logs.meta_failed'));
  }
}

module.exports = {
  getActivityLogs,
  getActivityLogDetail,
  getActivityLogsMeta,
};
