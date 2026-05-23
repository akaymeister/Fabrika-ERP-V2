const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const JSZip = require('jszip');
const { pool } = require('../config/database');
const { BACKUP_ROOT, UPLOADS_ROOT } = require('../utils/paths');
const { logActivityFireAndForget } = require('./activityLogService');

let jobRunning = false;

function getMysqldumpPath() {
  return process.env.MYSQLDUMP_PATH || 'mysqldump';
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }
}

function buildFileBaseName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const db = process.env.DB_NAME || 'fabrika_erp';
  return `${db}_${stamp}`;
}

function resolveBackupPath(relativePath) {
  const rel = String(relativePath || '').replace(/^[/\\]+/, '');
  const full = path.resolve(BACKUP_ROOT, rel);
  const rootResolved = path.resolve(BACKUP_ROOT);
  if (!full.startsWith(rootResolved + path.sep) && full !== rootResolved) {
    const e = new Error('INVALID_PATH');
    e.code = 'INVALID_PATH';
    throw e;
  }
  return full;
}

function checkMysqldumpAvailable(mysqldumpBin) {
  return new Promise((resolve) => {
    const proc = spawn(mysqldumpBin, ['--version'], { windowsHide: true });
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    proc.on('error', () => done(false));
    proc.on('close', (code) => done(code === 0));
    setTimeout(() => {
      try {
        proc.kill();
      } catch (_) {
        /* ignore */
      }
      done(false);
    }, 8000);
  });
}

function runMysqldump(mysqldumpBin, outFile) {
  return new Promise((resolve, reject) => {
    const cnfPath = path.join(os.tmpdir(), `fabrika-mysqldump-${Date.now()}.cnf`);
    const cnf = `[client]
host=${process.env.DB_HOST || '127.0.0.1'}
port=${Number(process.env.DB_PORT) || 3306}
user=${process.env.DB_USER || ''}
password=${process.env.DB_PASSWORD || ''}
`;
    fs.writeFileSync(cnfPath, cnf, { encoding: 'utf8', mode: 0o600 });

    const args = [
      `--defaults-extra-file=${cnfPath}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      '--set-gtid-purged=OFF',
      process.env.DB_NAME,
    ];

    const out = fs.createWriteStream(outFile, { flags: 'w' });
    const proc = spawn(mysqldumpBin, args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    proc.on('error', (err) => {
      out.close();
      try {
        fs.unlinkSync(cnfPath);
      } catch (_) {
        /* ignore */
      }
      reject(err);
    });
    proc.stdout.pipe(out);
    out.on('error', reject);

    proc.on('close', (code) => {
      out.close(() => {
        try {
          fs.unlinkSync(cnfPath);
        } catch (_) {
          /* ignore */
        }
        if (code === 0) {
          resolve();
        } else {
          const e = new Error(stderr.trim() || `mysqldump exit ${code}`);
          e.code = 'DUMP_FAILED';
          reject(e);
        }
      });
    });
  });
}

async function zipUploadsIntoArchive(zipPath, sqlFileName, sqlFullPath) {
  const zip = new JSZip();
  const sqlBuf = fs.readFileSync(sqlFullPath);
  zip.file(sqlFileName, sqlBuf);

  if (fs.existsSync(UPLOADS_ROOT)) {
    const addDir = (dir, zipFolder) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const abs = path.join(dir, ent.name);
        const rel = zipFolder ? `${zipFolder}/${ent.name}` : ent.name;
        if (ent.isDirectory()) {
          addDir(abs, rel);
        } else if (ent.isFile()) {
          zip.file(`uploads/${rel}`, fs.readFileSync(abs));
        }
      }
    };
    addDir(UPLOADS_ROOT, '');
  }

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(zipPath, content);
}

async function hasRunningBackup() {
  const [rows] = await pool.query(
    `SELECT id FROM backup_runs WHERE status = 'running' ORDER BY id DESC LIMIT 1`
  );
  return rows.length > 0;
}

async function createRunRow(userId, fileName, relativePath, includesUploads) {
  const uid = userId != null && Number(userId) > 0 ? Number(userId) : null;
  const [r] = await pool.query(
    `INSERT INTO backup_runs (
      triggered_by, user_id, status, file_name, file_path, includes_uploads
    ) VALUES ('manual', ?, 'running', ?, ?, ?)`,
    [uid, fileName, relativePath, includesUploads ? 1 : 0]
  );
  return r.insertId;
}

async function finishRunRow(runId, status, fileSizeBytes, errorMessage) {
  await pool.query(
    `UPDATE backup_runs SET status = ?, file_size_bytes = ?, error_message = ?, finished_at = NOW() WHERE id = ?`,
    [status, fileSizeBytes != null ? fileSizeBytes : null, errorMessage || null, runId]
  );
}

async function assertCanStartBackup() {
  if (jobRunning) {
    const e = new Error('BACKUP_BUSY');
    e.code = 'BACKUP_BUSY';
    throw e;
  }
  if (await hasRunningBackup()) {
    const e = new Error('BACKUP_BUSY');
    e.code = 'BACKUP_BUSY';
    throw e;
  }
  const mysqldumpBin = getMysqldumpPath();
  const available = await checkMysqldumpAvailable(mysqldumpBin);
  if (!available) {
    const e = new Error('MYSQLDUMP_NOT_FOUND');
    e.code = 'MYSQLDUMP_NOT_FOUND';
    throw e;
  }
  return mysqldumpBin;
}

async function executeBackupJob(runId, { includesUploads }) {
  const mysqldumpBin = getMysqldumpPath();
  ensureBackupDir();
  const base = buildFileBaseName();
  const sqlFileName = `${base}.sql`;
  const sqlRelative = sqlFileName;
  const sqlFull = path.join(BACKUP_ROOT, sqlRelative);

  let finalName = sqlFileName;
  let finalRelative = sqlRelative;
  let finalFull = sqlFull;

  if (includesUploads) {
    finalName = `${base}.zip`;
    finalRelative = finalName;
    finalFull = path.join(BACKUP_ROOT, finalRelative);
  }

  const row = await getBackupRunById(runId);
  if (!row) return;

  try {
    await runMysqldump(mysqldumpBin, sqlFull);

    if (includesUploads) {
      await zipUploadsIntoArchive(finalFull, sqlFileName, sqlFull);
      try {
        fs.unlinkSync(sqlFull);
      } catch (_) {
        /* ignore */
      }
      await pool.query(`UPDATE backup_runs SET file_name = ?, file_path = ? WHERE id = ?`, [
        finalName,
        finalRelative,
        runId,
      ]);
    }

    const stat = fs.statSync(finalFull);
    await finishRunRow(runId, 'success', stat.size, null);
    const done = await getBackupRunById(runId);
    logActivityFireAndForget(null, {
      action_type: 'CREATE',
      module_name: 'admin',
      table_name: 'backup_runs',
      record_id: runId,
      description: `Manuel veritabanı yedeği tamamlandı (#${runId})`,
      new_data: { fileName: done?.file_name, fileSizeBytes: stat.size },
      actor: {
        userId: done?.user_id,
        username: done?.triggered_by_username,
        fullName: null,
      },
    });
  } catch (err) {
    const msg = err && err.message ? String(err.message).slice(0, 4000) : 'Yedekleme başarısız';
    try {
      if (fs.existsSync(sqlFull)) fs.unlinkSync(sqlFull);
      if (finalFull !== sqlFull && fs.existsSync(finalFull)) fs.unlinkSync(finalFull);
    } catch (_) {
      /* ignore */
    }
    await finishRunRow(runId, 'failed', null, msg);
    const failed = await getBackupRunById(runId);
    logActivityFireAndForget(null, {
      action_type: 'UPDATE',
      module_name: 'admin',
      table_name: 'backup_runs',
      record_id: runId,
      description: `Manuel veritabanı yedeği başarısız (#${runId})`,
      new_data: { error: msg },
      actor: {
        userId: failed?.user_id,
        username: failed?.triggered_by_username,
        fullName: null,
      },
    });
  } finally {
    jobRunning = false;
  }
}

/**
 * Yedek işini kuyruğa alır; runId hemen döner, işlem arka planda sürer.
 */
async function startBackupJob({ userId, includesUploads }) {
  const mysqldumpBin = await assertCanStartBackup();

  ensureBackupDir();
  const base = buildFileBaseName();
  const placeholderName = includesUploads ? `${base}.zip` : `${base}.sql`;
  const runId = await createRunRow(userId, placeholderName, placeholderName, includesUploads);

  jobRunning = true;
  setImmediate(() => {
    executeBackupJob(runId, { includesUploads }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[executeBackupJob]', e);
      jobRunning = false;
    });
  });

  return { runId, status: 'running', mysqldumpBin };
}

async function listBackupRuns({ page = 1, pageSize = 20 } = {}) {
  const p = Math.max(1, parseInt(String(page), 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(String(pageSize), 10) || 20));
  const offset = (p - 1) * ps;

  const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM backup_runs');
  const total = Number(countRows[0]?.total) || 0;

  const [rows] = await pool.query(
    `SELECT br.id, br.triggered_by, br.user_id, u.username AS triggered_by_username,
            br.status, br.file_name, br.file_path, br.file_size_bytes, br.includes_uploads,
            br.error_message, br.started_at, br.finished_at
     FROM backup_runs br
     LEFT JOIN users u ON u.id = br.user_id
     ORDER BY br.id DESC
     LIMIT ${ps} OFFSET ${offset}`
  );

  return { items: rows, page: p, pageSize: ps, total, totalPages: total > 0 ? Math.ceil(total / ps) : 0 };
}

async function getBackupRunById(id) {
  const runId = parseInt(String(id), 10);
  if (!Number.isFinite(runId) || runId < 1) return null;
  const [rows] = await pool.query(
    `SELECT br.*, u.username AS triggered_by_username
     FROM backup_runs br
     LEFT JOIN users u ON u.id = br.user_id
     WHERE br.id = ?`,
    [runId]
  );
  return rows[0] || null;
}

async function deleteBackupRun(id) {
  const row = await getBackupRunById(id);
  if (!row) return null;
  if (row.status === 'running') {
    const e = new Error('BACKUP_RUNNING');
    e.code = 'BACKUP_RUNNING';
    throw e;
  }
  const full = resolveBackupPath(row.file_path);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
  }
  await pool.query('DELETE FROM backup_runs WHERE id = ?', [row.id]);
  return row;
}

function getDownloadStream(relativePath) {
  const full = resolveBackupPath(relativePath);
  if (!fs.existsSync(full)) {
    const e = new Error('FILE_NOT_FOUND');
    e.code = 'FILE_NOT_FOUND';
    throw e;
  }
  return { full, stream: fs.createReadStream(full) };
}

function isJobRunning() {
  return jobRunning;
}

module.exports = {
  startBackupJob,
  listBackupRuns,
  getBackupRunById,
  deleteBackupRun,
  getDownloadStream,
  isJobRunning,
  BACKUP_ROOT,
};
