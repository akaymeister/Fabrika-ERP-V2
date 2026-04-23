const { pool } = require('../config/database');
const { err } = require('../utils/serviceError');
const { toUpperTr } = require('../utils/textNormalize');
const {
  formatProjectCodeWithShort,
  normalizeProjectShort,
} = require('../utils/projectCodeFormat');

function defaultCompanyCode() {
  return String(process.env.DEFAULT_PROJECT_COMPANY_CODE || 'AHKFC').trim().toUpperCase() || 'AHKFC';
}

async function tableExists(name) {
  const [r] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name]
  );
  return r[0].c > 0;
}

async function listProjects() {
  if (!(await tableExists('projects'))) {
    return [];
  }
  const [rows] = await pool.query(
    'SELECT id, project_code, company_code, short_code, year, name, status, created_at, updated_at FROM projects ORDER BY id DESC'
  );
  return rows;
}

/**
 * Stok modülü için: yalnızca aktif projeler (açılır menü)
 * @returns {Promise<Array<{ id: number, name: string, project_code: string }>>}
 */
async function listActiveProjectsBrief() {
  if (!(await tableExists('projects'))) {
    return [];
  }
  const [rows] = await pool.query(
    `SELECT id, name, project_code FROM projects WHERE status = 'active' ORDER BY name ASC`
  );
  return rows;
}

/**
 * Otomatik kod: {şirket_küçük}-{kısatanım}{YY}-NNN — ör. ahkfc-dnm26-001
 * @param {{ name: string, shortName?: string }} param0
 */
async function createProject({ name, shortName } = {}) {
  if (!(await tableExists('projects'))) {
    return err('Proje tablosu yok: npm run db:migrate', 'api.project.migration');
  }
  const n = toUpperTr(name);
  if (!n) {
    return err('Proje adı gerekli', 'api.project.name_required');
  }
  const short = normalizeProjectShort(shortName);
  if (!short) {
    return err('Proje kısa adı gerekli (2–8 harf veya rakam)', 'api.project.short_required');
  }
  const [[nameDup]] = await pool.query('SELECT id FROM projects WHERE name = ?', [n]);
  if (nameDup) {
    return err('Bu isimde bir proje zaten var', 'api.project.name_exists');
  }
  const year = new Date().getFullYear();
  const companyCode = defaultCompanyCode();

  const [[mx]] = await pool.query(
    'SELECT COALESCE(MAX(sequence_no), 0) + 1 AS s FROM projects WHERE year = ? AND company_code = ? AND short_code = ?',
    [year, companyCode, short]
  );
  let seq = mx && Number(mx.s) > 0 ? Number(mx.s) : 1;

  for (let i = 0; i < 30; i += 1) {
    const code = formatProjectCodeWithShort(companyCode, short, year, seq);
    if (!code) {
      return err('Proje kodu üretilemedi; kısa adı kontrol edin', 'api.project.code_failed');
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const [r] = await pool.query(
        `INSERT INTO projects (project_code, company_code, short_code, sequence_no, year, name, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [code, companyCode, short, seq, year, n]
      );
      return { id: r.insertId, projectCode: code, name: n, shortCode: short };
    } catch (e) {
      const dup = e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062);
      if (dup) {
        seq += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      throw e;
    }
  }
  return err('Proje kodu üretilemedi; tekrar deneyin', 'api.project.code_failed');
}

/**
 * @param {number} id
 * @param {{ name: string }} param0
 */
async function updateProject(id, { name } = {}) {
  if (!(await tableExists('projects'))) {
    return err('Proje tablosu yok: npm run db:migrate', 'api.project.migration');
  }
  const n = toUpperTr(name);
  if (!n) {
    return err('Proje adı gerekli', 'api.project.name_required');
  }
  const [[nameDup]] = await pool.query('SELECT id FROM projects WHERE name = ? AND id != ?', [n, id]);
  if (nameDup) {
    return err('Bu isimde bir proje zaten var', 'api.project.name_exists');
  }
  const [r] = await pool.query('UPDATE projects SET name = ? WHERE id = ?', [n, id]);
  if (r.affectedRows === 0) {
    return err('Proje bulunamadı', 'api.project.not_found');
  }
  return { id, name: n };
}

/**
 * @param {number} id
 * @param {string} status 'active' | 'on_hold'
 */
async function setProjectStatus(id, status) {
  if (!(await tableExists('projects'))) {
    return err('Proje tablosu yok: npm run db:migrate', 'api.project.migration');
  }
  const s = String(status || '').trim().toLowerCase();
  if (s !== 'active' && s !== 'on_hold') {
    return err('Geçersiz durum; active veya on_hold', 'api.project.status_invalid');
  }
  const [r] = await pool.query('UPDATE projects SET status = ? WHERE id = ?', [s, id]);
  if (r.affectedRows === 0) {
    return err('Proje bulunamadı', 'api.project.not_found');
  }
  return { id, status: s };
}

/**
 * @param {number} id
 */
async function deleteProject(id) {
  if (!(await tableExists('projects'))) {
    return err('Proje tablosu yok: npm run db:migrate', 'api.project.migration');
  }
  const [r] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);
  if (r.affectedRows === 0) {
    return err('Proje bulunamadı', 'api.project.not_found');
  }
  return { id };
}

module.exports = {
  listProjects,
  listActiveProjectsBrief,
  createProject,
  updateProject,
  setProjectStatus,
  deleteProject,
};
