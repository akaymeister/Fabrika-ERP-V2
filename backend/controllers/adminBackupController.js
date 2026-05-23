const path = require('path');
const {
  startBackupJob,
  listBackupRuns,
  getBackupRunById,
  deleteBackupRun,
  getDownloadStream,
} = require('../services/backupService');
const { logActivityFireAndForget } = require('../services/activityLogService');
const { jsonOk, jsonError } = require('../utils/apiResponse');

function auditBackup(req, actionType, description, extra = {}) {
  logActivityFireAndForget(req, {
    action_type: actionType,
    module_name: 'admin',
    table_name: 'backup_runs',
    description,
    new_data: extra,
  });
}

async function getBackupRuns(req, res) {
  try {
    const result = await listBackupRuns({
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.json(jsonOk(result));
  } catch (e) {
    if (e && e.code === 'ER_NO_SUCH_TABLE') {
      return res
        .status(503)
        .json(jsonError('UNAVAILABLE', 'Yedek tablosu yok', null, 'api.admin.backup.table_missing'));
    }
    // eslint-disable-next-line no-console
    console.error('[getBackupRuns]', e);
    return res.status(500).json(jsonError('INTERNAL', 'Liste alınamadı', null, 'api.admin.backup.list_failed'));
  }
}

async function postBackupRun(req, res) {
  const includesUploads = !!(req.body && (req.body.includesUploads === true || req.body.includesUploads === 1));
  const userId = req.session?.user?.id;

  try {
    auditBackup(req, 'CREATE', 'Manuel veritabanı yedeği başlatıldı', { includesUploads });
    const result = await startBackupJob({ userId, includesUploads });
    return res.status(202).json(jsonOk({ run: result }));
  } catch (e) {
    if (e && e.code === 'BACKUP_BUSY') {
      return res.status(409).json(jsonError('CONFLICT', 'Başka bir yedek işlemi sürüyor', null, 'api.admin.backup.busy'));
    }
    if (e && e.code === 'MYSQLDUMP_NOT_FOUND') {
      auditBackup(req, 'CREATE', 'Manuel yedek başarısız: mysqldump bulunamadı');
      return res
        .status(503)
        .json(jsonError('UNAVAILABLE', 'mysqldump bulunamadı', null, 'api.admin.backup.mysqldump_missing'));
    }
    auditBackup(req, 'CREATE', `Manuel yedek başarısız: ${e?.message || 'hata'}`, { includesUploads });
    // eslint-disable-next-line no-console
    console.error('[postBackupRun]', e);
    return res.status(500).json(jsonError('INTERNAL', 'Yedekleme başarısız', { message: e?.message }, 'api.admin.backup.run_failed'));
  }
}

async function getBackupDownload(req, res) {
  try {
    const row = await getBackupRunById(req.params.id);
    if (!row) {
      return res.status(404).json(jsonError('NOT_FOUND', 'Kayıt bulunamadı', null, 'api.admin.backup.not_found'));
    }
    if (row.status !== 'success') {
      return res.status(400).json(jsonError('VALIDATION', 'Yedek dosyası hazır değil', null, 'api.admin.backup.not_ready'));
    }
    const { full, stream } = getDownloadStream(row.file_path);
    auditBackup(req, 'VIEW', `Yedek dosyası indirildi (#${row.id})`, { runId: row.id, fileName: row.file_name });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(row.file_name)}"`);
    stream.pipe(res);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json(jsonError('INTERNAL', 'İndirme hatası', null, 'api.admin.backup.download_failed'));
      }
    });
    return undefined;
  } catch (e) {
    if (e && e.code === 'FILE_NOT_FOUND') {
      return res.status(404).json(jsonError('NOT_FOUND', 'Dosya bulunamadı', null, 'api.admin.backup.file_missing'));
    }
    // eslint-disable-next-line no-console
    console.error('[getBackupDownload]', e);
    return res.status(500).json(jsonError('INTERNAL', 'İndirme hatası', null, 'api.admin.backup.download_failed'));
  }
}

async function deleteBackupRunHandler(req, res) {
  try {
    const row = await deleteBackupRun(req.params.id);
    if (!row) {
      return res.status(404).json(jsonError('NOT_FOUND', 'Kayıt bulunamadı', null, 'api.admin.backup.not_found'));
    }
    auditBackup(req, 'DELETE', `Yedek kaydı silindi (#${row.id})`, { runId: row.id, fileName: row.file_name });
    return res.json(jsonOk({ deleted: true, id: row.id }));
  } catch (e) {
    if (e && e.code === 'BACKUP_RUNNING') {
      return res.status(409).json(jsonError('CONFLICT', 'Çalışan yedek silinemez', null, 'api.admin.backup.running_delete'));
    }
    // eslint-disable-next-line no-console
    console.error('[deleteBackupRun]', e);
    return res.status(500).json(jsonError('INTERNAL', 'Silinemedi', null, 'api.admin.backup.delete_failed'));
  }
}

module.exports = {
  getBackupRuns,
  postBackupRun,
  getBackupDownload,
  deleteBackupRun: deleteBackupRunHandler,
};
